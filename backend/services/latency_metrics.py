"""
Lightweight in-memory latency metrics buffer.

Wraps a deque keyed by route path so the admin dashboard can render live
P50 / P95 / P99 stats for every endpoint *without* shipping a Prometheus
sidecar. Bounded memory — at most ``MAX_PER_ROUTE`` samples per path.

Stats are best-effort and reset whenever the process restarts. Powers
the LatencyMiddleware in main.py and GET /api/v1/ml/metrics/latency.
"""
from __future__ import annotations

import threading
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional, Tuple


MAX_PER_ROUTE = 200          # how many samples per path we keep
LATENCY_BUDGET_MS = 200       # SLA threshold (200ms for real-time responses)


class LatencyMetrics:
    """Thread-safe ring-buffer of (timestamp, ms) tuples per route."""

    def __init__(self, max_per_route: int = MAX_PER_ROUTE) -> None:
        self._lock = threading.Lock()
        self._max = max_per_route
        self._by_route: Dict[str, Deque[Tuple[float, float]]] = defaultdict(
            lambda: deque(maxlen=self._max)
        )
        self._violations = 0
        self._total = 0

    # ── recording ────────────────────────────────────────────────────

    def record(self, route: str, ms: float, ts: Optional[float] = None) -> None:
        if ts is None:
            ts = datetime.now(timezone.utc).timestamp()
        with self._lock:
            self._by_route[route].append((ts, ms))
            self._total += 1
            if ms > LATENCY_BUDGET_MS:
                self._violations += 1

    # ── reads ────────────────────────────────────────────────────────

    @staticmethod
    def _percentile(samples: List[float], pct: float) -> float:
        if not samples:
            return 0.0
        sorted_samples = sorted(samples)
        k = max(0, min(len(sorted_samples) - 1, int(round(pct / 100 * (len(sorted_samples) - 1)))))
        return sorted_samples[k]

    def snapshot(self) -> Dict[str, object]:
        """Return per-route stats + global counters."""
        with self._lock:
            routes = []
            for route, buf in self._by_route.items():
                if not buf:
                    continue
                ms_values = [m for _, m in buf]
                routes.append({
                    "route": route,
                    "samples": len(ms_values),
                    "avg_ms": round(sum(ms_values) / len(ms_values), 2),
                    "p50_ms": round(self._percentile(ms_values, 50), 2),
                    "p95_ms": round(self._percentile(ms_values, 95), 2),
                    "p99_ms": round(self._percentile(ms_values, 99), 2),
                    "max_ms": round(max(ms_values), 2),
                    "violations": sum(1 for v in ms_values if v > LATENCY_BUDGET_MS),
                })
            routes.sort(key=lambda r: r["p95_ms"], reverse=True)

            # All samples flattened for a global picture.
            all_ms = [m for buf in self._by_route.values() for _, m in buf]
            return {
                "budget_ms": LATENCY_BUDGET_MS,
                "total_requests": self._total,
                "violations": self._violations,
                "violation_pct": round(
                    (self._violations / self._total * 100) if self._total else 0.0,
                    2,
                ),
                "global": {
                    "samples": len(all_ms),
                    "avg_ms": round(sum(all_ms) / len(all_ms), 2) if all_ms else 0.0,
                    "p50_ms": round(self._percentile(all_ms, 50), 2),
                    "p95_ms": round(self._percentile(all_ms, 95), 2),
                    "p99_ms": round(self._percentile(all_ms, 99), 2),
                    "max_ms": round(max(all_ms), 2) if all_ms else 0.0,
                },
                "routes": routes,
            }

    def reset(self) -> None:
        with self._lock:
            self._by_route.clear()
            self._violations = 0
            self._total = 0


# Singleton — one buffer per process is enough.
latency_metrics = LatencyMetrics()
