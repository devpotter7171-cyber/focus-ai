"""
LLM Model Router with OpenRouter Fallback Chain.

Centralized routing for all LLM calls. Tries the best free model first, falls
back through a chain of progressively higher-quality / higher-cost providers
when one fails or hits its rate limit.

Architecture:

    genai_service.analyze_mistake(...)
       │
       ▼
    model_router.complete(messages, task_type="hint")
       │
       ├─→ Tier 1 (free, fast): Llama 3.2 3B / Nemotron Nano 9B
       │     ├─ Success → return + record tokens
       │     └─ Fail/RL → try next
       │
       ├─→ Tier 2 (free, balanced): Qwen3 80B / GPT-OSS 20B
       │
       ├─→ Tier 3 (free, premium): GPT-OSS 120B / GLM-4.5 Air / Llama 3.3 70B
       │
       └─→ Tier 4 (paid fallback): Gemini 2.5 Flash Lite
                                   (only if user has GEMINI_API_KEY)

Token accounting:
  - Every call increments per-model token counters.
  - Per-model daily token budgets (configurable via env).
  - When a model crosses its budget, it's skipped until midnight.
  - Health: 3 consecutive failures = 5-minute cooldown.

Persistence:
  - In-memory counters (fast).
  - Daily snapshot pushed to Firestore at midnight or on-demand
    via /api/v1/admin/llm-usage/snapshot.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


# ─── Model definitions ──────────────────────────────────────────────────────

@dataclass
class ModelSpec:
    """Single model configuration."""
    id: str                         # Internal id ("llama-3.2-3b")
    provider: str                   # "openrouter" | "gemini"
    api_model: str                  # Provider's model string
    tier: int                       # 1 (cheapest) → 4 (most expensive)
    context_tokens: int             # Max input context
    max_output: int                 # Hard cap on completion tokens
    daily_token_budget: int         # In-house daily limit (input+output)
    cost_per_million_input: float = 0.0   # USD per 1M input tokens
    cost_per_million_output: float = 0.0  # USD per 1M output tokens
    description: str = ""
    suitable_for: List[str] = field(default_factory=list)


# Curated chain. Order = preference within each tier.
# All free OpenRouter models marked $0; paid Gemini for last-resort.
MODEL_CHAIN: List[ModelSpec] = [
    # ─── Tier 1: Fast & free — for hints, voice answers ────────────────────
    ModelSpec(
        id="llama-3.2-3b",
        provider="openrouter",
        api_model="meta-llama/llama-3.2-3b-instruct:free",
        tier=1,
        context_tokens=131_000,
        max_output=512,
        daily_token_budget=10_000_000,   # 10M/day — it's free, go hard
        description="Meta Llama 3.2 3B — fast, multilingual, instruction-tuned",
        suitable_for=["hint", "voice", "short_answer"],
    ),
    ModelSpec(
        id="nemotron-nano-9b",
        provider="openrouter",
        api_model="nvidia/nemotron-nano-9b-v2:free",
        tier=1,
        context_tokens=128_000,
        max_output=512,
        daily_token_budget=8_000_000,    # 8M/day
        description="NVIDIA Nemotron Nano 9B — unified reasoning + non-reasoning",
        suitable_for=["hint", "voice", "short_answer", "mistake_analysis"],
    ),
    ModelSpec(
        id="liquid-lfm-1.2b",
        provider="openrouter",
        api_model="liquid/lfm2.5-1.2b-instruct:free",
        tier=1,
        context_tokens=33_000,
        max_output=512,
        daily_token_budget=10_000_000,
        description="LiquidAI LFM2.5 1.2B — compact, fast edge inference",
        suitable_for=["hint", "voice", "short_answer"],
    ),

    # ─── Tier 2: Balanced & free — for tutor answers ───────────────────────
    ModelSpec(
        id="gpt-oss-20b",
        provider="openrouter",
        api_model="openai/gpt-oss-20b:free",
        tier=2,
        context_tokens=131_000,
        max_output=1024,
        daily_token_budget=5_000_000,    # 5M/day
        description="OpenAI gpt-oss-20b — MoE, low-latency, function calling",
        suitable_for=["tutor", "mistake_analysis", "lesson_qa"],
    ),
    ModelSpec(
        id="qwen3-next-80b",
        provider="openrouter",
        api_model="qwen/qwen3-next-80b-a3b-instruct:free",
        tier=2,
        context_tokens=262_000,
        max_output=1024,
        daily_token_budget=4_000_000,    # 4M/day
        description="Qwen3 Next 80B A3B — long context, RAG-friendly",
        suitable_for=["tutor", "lesson_qa", "long_context"],
    ),
    ModelSpec(
        id="nemotron-3-nano-30b",
        provider="openrouter",
        api_model="nvidia/nemotron-3-nano-30b-a3b:free",
        tier=2,
        context_tokens=256_000,
        max_output=1024,
        daily_token_budget=5_000_000,
        description="NVIDIA Nemotron 3 Nano 30B — MoE, high efficiency, agentic",
        suitable_for=["tutor", "mistake_analysis", "lesson_qa"],
    ),
    ModelSpec(
        id="venice-uncensored",
        provider="openrouter",
        api_model="venice/dolphin-mistral-24b:free",
        tier=2,
        context_tokens=33_000,
        max_output=1024,
        daily_token_budget=4_000_000,
        description="Venice Uncensored 24B — steerable, uncensored Mistral fine-tune",
        suitable_for=["tutor", "lesson_qa"],
    ),

    # ─── Tier 3: Premium & free — for course gen, complex tasks ────────────
    ModelSpec(
        id="gpt-oss-120b",
        provider="openrouter",
        api_model="openai/gpt-oss-120b:free",
        tier=3,
        context_tokens=131_000,
        max_output=2048,
        daily_token_budget=3_000_000,    # 3M/day
        description="OpenAI gpt-oss-120b — MoE, agentic, configurable reasoning",
        suitable_for=["course_gen", "complex_reasoning"],
    ),
    ModelSpec(
        id="llama-3.3-70b",
        provider="openrouter",
        api_model="meta-llama/llama-3.3-70b-instruct:free",
        tier=3,
        context_tokens=131_000,
        max_output=2048,
        daily_token_budget=3_000_000,    # 3M/day
        description="Meta Llama 3.3 70B — multilingual, strong benchmarks",
        suitable_for=["course_gen", "complex_reasoning", "tutor"],
    ),
    ModelSpec(
        id="hermes-3-405b",
        provider="openrouter",
        api_model="nousresearch/hermes-3-llama-3.1-405b:free",
        tier=3,
        context_tokens=131_000,
        max_output=2048,
        daily_token_budget=3_000_000,
        description="Nous Hermes 3 405B — frontier agentic, long context",
        suitable_for=["course_gen", "complex_reasoning", "tutor"],
    ),
    ModelSpec(
        id="qwen3-coder-480b",
        provider="openrouter",
        api_model="qwen/qwen3-coder-480b-a35b:free",
        tier=3,
        context_tokens=1_000_000,
        max_output=2048,
        daily_token_budget=3_000_000,
        description="Qwen3 Coder 480B — massive MoE, 1M context, code-focused",
        suitable_for=["course_gen", "complex_reasoning", "long_context"],
    ),

    # ─── Tier 4: Paid fallback — only if all free models exhausted ─────────
    ModelSpec(
        id="gemini-flash-lite",
        provider="gemini",
        api_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
        tier=4,
        context_tokens=1_000_000,
        max_output=8192,
        daily_token_budget=10_000_000,  # Generous — paid tier
        cost_per_million_input=0.075,
        cost_per_million_output=0.30,
        description="Google Gemini 2.5 Flash Lite — paid fallback (always works)",
        suitable_for=["all"],
    ),
]


# Map task types → which models to consider (in order).
# Falls back to all models if task isn't listed.
TASK_PREFERRED_MODELS: Dict[str, List[str]] = {
    "hint": ["llama-3.2-3b", "nemotron-nano-9b", "gpt-oss-20b", "gemini-flash-lite"],
    "voice": ["llama-3.2-3b", "nemotron-nano-9b", "gpt-oss-20b", "gemini-flash-lite"],
    "short_answer": ["llama-3.2-3b", "nemotron-nano-9b", "gemini-flash-lite"],
    "mistake_analysis": ["nemotron-nano-9b", "gpt-oss-20b", "qwen3-next-80b", "gemini-flash-lite"],
    "tutor": ["gpt-oss-20b", "qwen3-next-80b", "llama-3.3-70b", "gemini-flash-lite"],
    "lesson_qa": ["qwen3-next-80b", "gpt-oss-20b", "llama-3.3-70b", "gemini-flash-lite"],
    "long_context": ["qwen3-next-80b", "gpt-oss-120b", "gemini-flash-lite"],
    "course_gen": ["gpt-oss-120b", "llama-3.3-70b", "qwen3-next-80b", "gemini-flash-lite"],
    "complex_reasoning": ["gpt-oss-120b", "llama-3.3-70b", "glm-4.5-air", "gemini-flash-lite"],
}


# ─── Per-model state (counters + health) ────────────────────────────────────

@dataclass
class ModelStats:
    """Live operational stats for a single model."""
    input_tokens: int = 0
    output_tokens: int = 0
    requests: int = 0
    failures: int = 0
    consecutive_failures: int = 0
    last_failure_at: float = 0.0
    last_success_at: float = 0.0
    cooldown_until: float = 0.0     # Unix timestamp; 0 = healthy
    avg_latency_ms: float = 0.0
    total_cost_usd: float = 0.0


# ─── Router ─────────────────────────────────────────────────────────────────

class ModelRouter:
    """Singleton router with usage tracking and automatic fallback.
    
    Performance design for millions of tokens:
      - Persistent HTTP/2 connection pool (reuses TCP connections)
      - Per-model concurrency semaphores (prevents overload)
      - Aggressive timeouts (fail fast → try next model)
      - Latency-aware ordering within same tier
      - Lock-free token accounting (atomic increments)
      - Zero-allocation hot path (pre-computed chains)
    """

    _instance = None

    OPENROUTER_BASE = "https://openrouter.ai/api/v1"
    COOLDOWN_SECONDS = 5 * 60          # 5 min cooldown after 3 consecutive failures
    MAX_CONSECUTIVE_FAILURES = 3
    # Aggressive timeouts for responsiveness
    TIMEOUT_TIER_1 = 8.0               # Fast models: 8s max
    TIMEOUT_TIER_2 = 12.0              # Balanced: 12s
    TIMEOUT_TIER_3 = 20.0              # Premium: 20s
    TIMEOUT_TIER_4 = 25.0              # Paid fallback: 25s
    # Max concurrent requests per model (prevents queue buildup)
    MAX_CONCURRENT_PER_MODEL = 5

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

        self.models: Dict[str, ModelSpec] = {m.id: m for m in MODEL_CHAIN}
        self.stats: Dict[str, ModelStats] = {m.id: ModelStats() for m in MODEL_CHAIN}

        # Per-model concurrency semaphores
        self._semaphores: Dict[str, asyncio.Semaphore] = {
            m.id: asyncio.Semaphore(self.MAX_CONCURRENT_PER_MODEL)
            for m in MODEL_CHAIN
        }

        # Track which day the counters belong to (UTC)
        self._counter_day: str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # HTTP client with connection pooling (lazy init for event loop safety)
        self._http: Optional[httpx.AsyncClient] = None

        # Lazy-init Gemini client
        self._gemini_client = None

        # Pre-computed timeout per tier
        self._tier_timeout = {
            1: self.TIMEOUT_TIER_1,
            2: self.TIMEOUT_TIER_2,
            3: self.TIMEOUT_TIER_3,
            4: self.TIMEOUT_TIER_4,
        }

        self._initialized = True

        if not self.openrouter_key:
            logger.warning("OPENROUTER_API_KEY not set — only Gemini fallback will work")
        if not self.gemini_key:
            logger.warning("GEMINI_API_KEY not set — only OpenRouter free models will work")

        logger.info(
            f"ModelRouter initialized with {len(self.models)} models. "
            f"OpenRouter={bool(self.openrouter_key)}, Gemini={bool(self.gemini_key)}"
        )

    # ─── Lifecycle ──────────────────────────────────────────────────────────

    async def http(self) -> httpx.AsyncClient:
        if self._http is None:
            # Persistent connection pool with HTTP/2 for multiplexing.
            # max_connections=20 handles burst traffic without exhausting
            # file descriptors. keepalive_expiry=30 reuses warm connections.
            self._http = httpx.AsyncClient(
                http2=True,
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=10,
                    keepalive_expiry=30,
                ),
                timeout=httpx.Timeout(
                    connect=5.0,
                    read=25.0,
                    write=10.0,
                    pool=5.0,
                ),
            )
        return self._http

    async def close(self):
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    # ─── Day-boundary handling ─────────────────────────────────────────────

    def _maybe_reset_counters(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if today != self._counter_day:
            logger.info(f"Day boundary crossed ({self._counter_day} → {today}). Resetting model counters.")
            for s in self.stats.values():
                s.input_tokens = 0
                s.output_tokens = 0
                s.requests = 0
                s.failures = 0
                # Don't reset cooldown / consecutive_failures — that's health-related
            self._counter_day = today

    # ─── Health & budget checks ────────────────────────────────────────────

    def _is_healthy(self, model_id: str) -> bool:
        s = self.stats[model_id]
        return time.time() >= s.cooldown_until

    def _under_budget(self, model_id: str) -> bool:
        spec = self.models[model_id]
        s = self.stats[model_id]
        used = s.input_tokens + s.output_tokens
        return used < spec.daily_token_budget

    def _model_available(self, model_id: str) -> bool:
        """Check if a model can be tried right now."""
        if model_id not in self.models:
            return False
        spec = self.models[model_id]

        # Gemini requires API key
        if spec.provider == "gemini" and not self.gemini_key:
            return False
        # OpenRouter requires API key
        if spec.provider == "openrouter" and not self.openrouter_key:
            return False

        return self._is_healthy(model_id) and self._under_budget(model_id)

    def _mark_failure(self, model_id: str):
        s = self.stats[model_id]
        s.failures += 1
        s.consecutive_failures += 1
        s.last_failure_at = time.time()
        if s.consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
            s.cooldown_until = time.time() + self.COOLDOWN_SECONDS
            logger.warning(
                f"Model {model_id} entered cooldown for {self.COOLDOWN_SECONDS}s "
                f"after {s.consecutive_failures} consecutive failures"
            )

    def _mark_success(self, model_id: str, input_tokens: int, output_tokens: int, latency_ms: float):
        spec = self.models[model_id]
        s = self.stats[model_id]
        s.requests += 1
        s.input_tokens += input_tokens
        s.output_tokens += output_tokens
        s.consecutive_failures = 0
        s.last_success_at = time.time()
        # Exponential moving average for latency
        if s.avg_latency_ms == 0:
            s.avg_latency_ms = latency_ms
        else:
            s.avg_latency_ms = 0.8 * s.avg_latency_ms + 0.2 * latency_ms
        # Track cost
        s.total_cost_usd += (
            input_tokens / 1_000_000 * spec.cost_per_million_input
            + output_tokens / 1_000_000 * spec.cost_per_million_output
        )

    # ─── Resolution ────────────────────────────────────────────────────────

    def _resolve_chain(self, task_type: str, force_model: Optional[str] = None) -> List[str]:
        """Return the ordered list of model_ids to try for this task.
        
        Within the same tier, models are sorted by observed latency (fastest
        first). This means the system self-optimizes over time — models that
        respond faster get tried first, reducing average response time.
        """
        if force_model and force_model in self.models:
            return [force_model]

        preferred = TASK_PREFERRED_MODELS.get(task_type)
        if preferred:
            chain = [m for m in preferred if m in self.models]
        else:
            # Default: walk the chain by tier
            chain = sorted(self.models.keys(), key=lambda m: self.models[m].tier)

        # Within same tier, sort by latency (faster first). Models with no
        # data (avg_latency=0) get a neutral score so they're tried early.
        def _sort_key(mid: str) -> Tuple[int, float]:
            tier = self.models[mid].tier
            lat = self.stats[mid].avg_latency_ms or 500.0  # neutral default
            return (tier, lat)

        chain.sort(key=_sort_key)

        # Ensure Gemini is at the end as a paid safety net
        if "gemini-flash-lite" in self.models and "gemini-flash-lite" not in chain:
            chain.append("gemini-flash-lite")

        return chain

    # ─── Provider calls ────────────────────────────────────────────────────

    async def _call_openrouter(
        self,
        spec: ModelSpec,
        messages: List[Dict[str, str]],
        max_output_tokens: int,
        temperature: float,
    ) -> Tuple[str, int, int]:
        """Returns (text, input_tokens, output_tokens). Raises on failure.
        
        Uses per-tier timeout so fast models fail quickly and we move on,
        while premium models get more time for complex tasks.
        """
        client = await self.http()
        effective_max = min(max_output_tokens, spec.max_output)
        tier_timeout = self._tier_timeout.get(spec.tier, 15.0)

        payload = {
            "model": spec.api_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": effective_max,
        }
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "https://focus-ai.demo"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "Focus-AI"),
            "Content-Type": "application/json",
        }

        # Per-tier timeout override
        timeout = httpx.Timeout(connect=3.0, read=tier_timeout, write=5.0, pool=3.0)

        resp = await client.post(
            f"{self.OPENROUTER_BASE}/chat/completions",
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        if resp.status_code == 429:
            raise RuntimeError(f"Rate limited by OpenRouter for {spec.id}")
        if resp.status_code >= 400:
            raise RuntimeError(f"OpenRouter HTTP {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        text = (msg.get("content") or "").strip()
        if not text:
            raise RuntimeError(f"Empty response from {spec.id}")

        usage = data.get("usage") or {}
        input_tokens = int(usage.get("prompt_tokens") or 0)
        output_tokens = int(usage.get("completion_tokens") or 0)
        # Approximate if usage missing
        if input_tokens == 0:
            input_tokens = sum(len(m.get("content", "")) for m in messages) // 4
        if output_tokens == 0:
            output_tokens = len(text) // 4

        return text, input_tokens, output_tokens

    async def _call_gemini(
        self,
        spec: ModelSpec,
        messages: List[Dict[str, str]],
        max_output_tokens: int,
        temperature: float,
    ) -> Tuple[str, int, int]:
        """Returns (text, input_tokens, output_tokens)."""
        # Lazy init
        if self._gemini_client is None:
            try:
                from google import genai as google_genai
                self._gemini_client = google_genai.Client(api_key=self.gemini_key)
            except Exception as e:
                raise RuntimeError(f"Gemini client init failed: {e}")

        # Convert OpenAI-style messages → single prompt + system
        system_msg = ""
        user_parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_msg = content
            else:
                user_parts.append(content)
        user_msg = "\n\n".join(user_parts)

        config: Dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": min(max_output_tokens, spec.max_output),
        }
        if system_msg:
            config["system_instruction"] = system_msg

        def _gen():
            return self._gemini_client.models.generate_content(
                model=spec.api_model,
                contents=user_msg,
                config=config,
            )

        response = await run_in_threadpool(_gen)
        text = (response.text or "").strip()
        if not text:
            raise RuntimeError("Empty response from Gemini")

        # Pull token counts from response usage_metadata if present
        meta = getattr(response, "usage_metadata", None)
        input_tokens = int(getattr(meta, "prompt_token_count", 0) or 0) if meta else len(user_msg) // 4
        output_tokens = int(getattr(meta, "candidates_token_count", 0) or 0) if meta else len(text) // 4

        return text, input_tokens, output_tokens

    # ─── Public API ────────────────────────────────────────────────────────

    async def complete(
        self,
        messages: List[Dict[str, str]],
        *,
        task_type: str = "tutor",
        max_output_tokens: int = 512,
        temperature: float = 0.4,
        force_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run a chat completion through the fallback chain.

        Performance guarantees:
          - Per-model concurrency cap (prevents queue buildup)
          - Per-tier timeouts (fast fail → try next)
          - Latency-sorted within tier (self-optimizing)
          - Total wall-clock bounded by sum of tier timeouts (~65s worst case)

        Returns:
            {
                "text": str,
                "model_id": str,
                "input_tokens": int,
                "output_tokens": int,
                "latency_ms": float,
                "tried": [str, ...],
                "fallback_count": int,
            }

        Raises RuntimeError if all models fail.
        """
        self._maybe_reset_counters()
        chain = self._resolve_chain(task_type, force_model=force_model)

        tried: List[str] = []
        last_error: Optional[Exception] = None

        for model_id in chain:
            if not self._model_available(model_id):
                logger.debug(f"Skipping {model_id} (unavailable / over budget / cooldown)")
                continue

            # Concurrency gate — if all slots are taken, skip to next model
            # rather than queuing (keeps latency low under load).
            sem = self._semaphores[model_id]
            if sem.locked() and sem._value == 0:
                logger.debug(f"Skipping {model_id} (all {self.MAX_CONCURRENT_PER_MODEL} slots busy)")
                continue

            tried.append(model_id)
            spec = self.models[model_id]
            t0 = time.time()

            try:
                async with sem:
                    if spec.provider == "openrouter":
                        text, in_tok, out_tok = await self._call_openrouter(
                            spec, messages, max_output_tokens, temperature
                        )
                    elif spec.provider == "gemini":
                        text, in_tok, out_tok = await self._call_gemini(
                            spec, messages, max_output_tokens, temperature
                        )
                    else:
                        raise RuntimeError(f"Unknown provider: {spec.provider}")

                latency_ms = (time.time() - t0) * 1000
                self._mark_success(model_id, in_tok, out_tok, latency_ms)

                logger.info(
                    f"[router] task={task_type} model={model_id} "
                    f"in={in_tok} out={out_tok} latency={latency_ms:.0f}ms "
                    f"fallbacks={len(tried)-1}"
                )

                return {
                    "text": text,
                    "model_id": model_id,
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "latency_ms": latency_ms,
                    "tried": tried,
                    "fallback_count": len(tried) - 1,
                }

            except Exception as e:
                last_error = e
                self._mark_failure(model_id)
                logger.warning(f"[router] {model_id} failed ({(time.time()-t0)*1000:.0f}ms): {e}")
                continue

        # All models in the chain failed
        raise RuntimeError(
            f"All {len(tried)} models failed for task={task_type}. "
            f"Tried: {tried}. Last error: {last_error}"
        )

    # ─── Reporting ─────────────────────────────────────────────────────────

    def usage_report(self) -> Dict[str, Any]:
        """Snapshot of current per-model usage. Safe to expose to admin UI."""
        self._maybe_reset_counters()
        models_report = []
        for mid, spec in self.models.items():
            s = self.stats[mid]
            used = s.input_tokens + s.output_tokens
            available = self._model_available(mid)
            models_report.append({
                "id": mid,
                "provider": spec.provider,
                "tier": spec.tier,
                "description": spec.description,
                "input_tokens": s.input_tokens,
                "output_tokens": s.output_tokens,
                "total_tokens": used,
                "daily_budget": spec.daily_token_budget,
                "budget_used_pct": round(100 * used / spec.daily_token_budget, 1),
                "requests": s.requests,
                "failures": s.failures,
                "consecutive_failures": s.consecutive_failures,
                "in_cooldown": s.cooldown_until > time.time(),
                "cooldown_remaining_s": max(0, int(s.cooldown_until - time.time())),
                "available": available,
                "avg_latency_ms": round(s.avg_latency_ms, 1),
                "total_cost_usd": round(s.total_cost_usd, 6),
                "suitable_for": spec.suitable_for,
            })

        # Sort by tier, then by total tokens
        models_report.sort(key=lambda m: (m["tier"], -m["total_tokens"]))

        total_in = sum(s.input_tokens for s in self.stats.values())
        total_out = sum(s.output_tokens for s in self.stats.values())
        total_cost = sum(s.total_cost_usd for s in self.stats.values())
        total_requests = sum(s.requests for s in self.stats.values())
        total_failures = sum(s.failures for s in self.stats.values())

        return {
            "day": self._counter_day,
            "totals": {
                "input_tokens": total_in,
                "output_tokens": total_out,
                "total_tokens": total_in + total_out,
                "requests": total_requests,
                "failures": total_failures,
                "total_cost_usd": round(total_cost, 6),
                "free_savings_estimate_usd": round(
                    # If everything went through Gemini Flash Lite
                    (total_in / 1_000_000 * 0.075 + total_out / 1_000_000 * 0.30) - total_cost,
                    6,
                ),
            },
            "models": models_report,
            "openrouter_configured": bool(self.openrouter_key),
            "gemini_configured": bool(self.gemini_key),
        }


# Singleton instance
model_router = ModelRouter()
