from google import genai
from google.genai import types
import os
import hashlib
import logging
from collections import OrderedDict
from starlette.concurrency import run_in_threadpool
from typing import Optional, Dict, Any, List

from services.model_router import model_router

logger = logging.getLogger(__name__)

# Default Gemini model. Kept centralised so we can flip it in one place.
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

# ─── Token budget constants ──────────────────────────────────────────────────
MAX_OUTPUT_TOKENS_HINT = 60
MAX_OUTPUT_TOKENS_MISTAKE = 120
MAX_OUTPUT_TOKENS_TUTOR = 300
MAX_OUTPUT_TOKENS_VOICE = 150
MAX_LESSON_CONTEXT_CHARS = 3000
MAX_LESSON_CONTEXT_VOICE = 1500


# ─── LRU Response Cache ──────────────────────────────────────────────────────

class _LRUCache(OrderedDict):
    """Simple bounded LRU dict."""
    def __init__(self, maxsize: int = 256):
        super().__init__()
        self._maxsize = maxsize

    def get_cached(self, key: str) -> Optional[str]:
        if key in self:
            self.move_to_end(key)
            return self[key]
        return None

    def put(self, key: str, value: str) -> None:
        if key in self:
            self.move_to_end(key)
        self[key] = value
        while len(self) > self._maxsize:
            self.popitem(last=False)


_response_cache = _LRUCache(maxsize=512)


def _cache_key(*parts: str) -> str:
    """Stable hash from prompt parts."""
    raw = "||".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class GenAIService:
    """
    Unified AI service that routes through the ModelRouter fallback chain.

    All methods build OpenAI-style messages and delegate to
    `model_router.complete()`, which handles:
      - Free model selection (OpenRouter)
      - Automatic fallback on failure/rate-limit
      - Token accounting & daily budgets
      - Paid Gemini as last resort

    The response cache sits above the router — a cache hit skips the
    entire chain, costing zero tokens.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GenAIService, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if self.initialized:
            return

        # Legacy: keep a direct Gemini client for course_gen_service which
        # uses response_mime_type (not supported via OpenRouter).
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                self.client = genai.Client(api_key=api_key)
                logger.info("GenAI Service initialized (Gemini direct + ModelRouter).")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
        else:
            self.client = None
            logger.info("GenAI Service initialized (ModelRouter only, no Gemini key).")

        self.initialized = True

    @property
    def available(self) -> bool:
        """True if at least one provider is configured."""
        return bool(
            os.getenv("OPENROUTER_API_KEY") or os.getenv("GEMINI_API_KEY")
        )

    async def _routed_call(
        self,
        messages: List[Dict[str, str]],
        *,
        task_type: str,
        max_output_tokens: int,
        temperature: float = 0.4,
        cache_key_parts: Optional[tuple] = None,
    ) -> Optional[str]:
        """
        Core method: check cache → route through model chain → cache result.
        """
        if not self.available:
            return None

        # Cache check
        if cache_key_parts:
            ck = _cache_key(*cache_key_parts)
            cached = _response_cache.get_cached(ck)
            if cached is not None:
                return cached

        try:
            result = await model_router.complete(
                messages=messages,
                task_type=task_type,
                max_output_tokens=max_output_tokens,
                temperature=temperature,
            )
            text = result["text"]

            # Cache the result
            if cache_key_parts and text:
                ck = _cache_key(*cache_key_parts)
                _response_cache.put(ck, text)

            return text
        except Exception as e:
            logger.error(f"All models failed for task={task_type}: {e}")
            return None

    async def analyze_mistake(self, question_text: str, selected_option: str, correct_option: str) -> Optional[str]:
        """Concise explanation for wrong answer. Token-optimized."""
        messages = [
            {"role": "system", "content": "You are a concise tutor. Explain in 2 sentences why the student's answer is wrong and what concept they need. Be encouraging."},
            {"role": "user", "content": f"Q: {question_text}\nChose: {selected_option}\nCorrect: {correct_option}"},
        ]
        return await self._routed_call(
            messages,
            task_type="mistake_analysis",
            max_output_tokens=MAX_OUTPUT_TOKENS_MISTAKE,
            temperature=0.3,
            cache_key_parts=("mistake", question_text, selected_option, correct_option),
        )

    async def generate_hint(self, question_text: str, correct_answer: str, level: int) -> Optional[str]:
        """Progressive hint. 1 sentence max."""
        level_focus = {
            1: "high-level concept nudge",
            2: "logical next step",
            3: "specific pointer to the answer",
        }.get(level, "concept nudge")

        messages = [
            {"role": "system", "content": f"Give a Level {level} hint ({level_focus}). 1 sentence. Don't reveal the answer. Be encouraging."},
            {"role": "user", "content": f"Q: {question_text}\nAnswer: {correct_answer}"},
        ]
        return await self._routed_call(
            messages,
            task_type="hint",
            max_output_tokens=MAX_OUTPUT_TOKENS_HINT,
            temperature=0.4,
            cache_key_parts=("hint", question_text, str(level)),
        )

    async def lesson_tutor(
        self,
        question: str,
        course_title: str,
        lesson_title: str,
        lesson_text: str,
        selected_excerpt: Optional[str] = None,
        voice_mode: bool = False,
    ) -> Optional[str]:
        """Lesson-scoped tutor reply with tiered context budget."""
        if voice_mode:
            max_context = MAX_LESSON_CONTEXT_VOICE
            max_output = MAX_OUTPUT_TOKENS_VOICE
            system = (
                "You are a concise voice tutor. Answer in 1-2 spoken sentences. "
                "Use the lesson context when relevant. Be clear and direct."
            )
        else:
            max_context = MAX_LESSON_CONTEXT_CHARS
            max_output = MAX_OUTPUT_TOKENS_TUTOR
            system = (
                "You are a concise tutor in an adaptive learning app. "
                "Use the lesson context when relevant. Answer clearly. "
                "Match the user's language. No fake citations. Keep under ~150 words."
            )

        lesson_excerpt = (lesson_text or "")[:max_context]
        user_parts = [f"[{course_title} > {lesson_title}]"]
        if lesson_excerpt:
            user_parts.append(f"Context: {lesson_excerpt}")
        if selected_excerpt:
            user_parts.append(f"Highlighted: {selected_excerpt.strip()[:800]}")
        user_parts.append(f"Q: {question.strip()}")

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": "\n".join(user_parts)},
        ]

        task = "voice" if voice_mode else "tutor"
        return await self._routed_call(
            messages,
            task_type=task,
            max_output_tokens=max_output,
            temperature=0.5,
            cache_key_parts=("tutor", lesson_title, question.strip()[:200]),
        )

    async def voice_answer(
        self,
        question: str,
        lesson_title: Optional[str] = None,
        lesson_snippet: Optional[str] = None,
    ) -> Optional[str]:
        """Ultra-compact voice-first answer. Cheapest possible AI call."""
        system = (
            "You are a voice assistant for a DBMS learning app. "
            "Answer in 1-2 spoken sentences. Be clear and direct. "
            "If you don't know, say so briefly."
        )
        parts = []
        if lesson_title:
            parts.append(f"Lesson: {lesson_title}")
        if lesson_snippet:
            parts.append(f"Context: {lesson_snippet[:800]}")
        parts.append(f"Student asks: {question}")

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": "\n".join(parts)},
        ]
        return await self._routed_call(
            messages,
            task_type="voice",
            max_output_tokens=MAX_OUTPUT_TOKENS_VOICE,
            temperature=0.4,
            cache_key_parts=("voice", lesson_title or "", question.strip()[:150]),
        )


genai_service = GenAIService()

