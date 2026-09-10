

import logging
from firebase_admin import firestore
from google.cloud.firestore import FieldFilter
from datetime import datetime, timedelta
from starlette.concurrency import run_in_threadpool
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# ─── Content Level Definitions ───────────────────────────────────────────────
# Level 1: Expert / canonical (hardest)
# Level 2: Detailed standard (textbook)
# Level 3: Concise key points (summary)
# Level 4: Real-world application (worked example)
# Level 5: Friendly analogy (simplest, first-principles)

LEVEL_NAMES = {
    1: "Expert",
    2: "Detailed",
    3: "Key Points",
    4: "Real World",
    5: "Analogy",
}


class AdaptiveService:
    """
    Determines the optimal content difficulty level for a user based on:
      1. Quiz performance (most recent scores for this unit)
      2. Behavioral signals (confusion detected by ML)
      3. Explicit user preference (from settings)
      4. Per-question performance within the current quiz

    The level is recalculated on every content request so the user sees
    the adaptation immediately after a quiz — not on the next session.
    """

    def __init__(self):
        pass

    async def get_user_level(self, user_id: str, unit_id: str, db) -> int:
        """
        Calculate user's adaptive level (1-5) for a specific unit.

        Uses a weighted approach:
          - Most recent quiz score has highest weight (60%)
          - Previous quiz scores decay (30%, 10%)
          - If no quiz data, check BKT mastery for the unit

        Mapping (more aggressive than before — drops faster on failure):
          - 90-100% → Level 1 (Expert)
          - 70-89%  → Level 2 (Detailed)
          - 50-69%  → Level 3 (Key Points)
          - 25-49%  → Level 4 (Real World)
          - 0-24%   → Level 5 (Analogy / Simplest)
        """
        try:
            # Query quiz results for this user & unit
            query = (
                db.collection("quiz_results")
                .where(filter=FieldFilter("unit_id", "==", unit_id))
                .where(filter=FieldFilter("user_id", "==", user_id))
                .limit(20)
            )

            results = await run_in_threadpool(lambda: list(query.stream()))

            # Sort by timestamp descending (in memory to avoid composite index)
            def _sort_key(doc):
                ts = doc.to_dict().get("timestamp")
                if ts is None:
                    return 0
                return ts.timestamp() if hasattr(ts, "timestamp") else float(ts)

            results.sort(key=_sort_key, reverse=True)
            results = results[:5]  # Keep last 5 attempts

            if not results:
                # No quiz data — check BKT mastery as fallback
                return await self._level_from_mastery(user_id, unit_id, db)

            # Weighted average: most recent = 60%, second = 25%, rest = 15% split
            weights = [0.60, 0.25, 0.10, 0.03, 0.02]
            weighted_score = 0.0
            total_weight = 0.0

            for i, res in enumerate(results):
                data = res.to_dict()
                score = data.get("score", 0)
                total_q = data.get("total_questions", 1)
                if total_q == 0:
                    total_q = 1
                pct = (score / total_q) * 100

                w = weights[i] if i < len(weights) else 0.01
                weighted_score += pct * w
                total_weight += w

            if total_weight == 0:
                return 1

            avg_pct = weighted_score / total_weight
            return self._pct_to_level(avg_pct)

        except Exception as e:
            logger.error(f"Error calculating adaptive level: {e}")
            return 1  # Default to expert on error

    async def _level_from_mastery(self, user_id: str, unit_id: str, db) -> int:
        """Fallback: derive level from BKT mastery or onboarding preference."""
        try:
            # First check if the user has an onboarding-set initial level
            user_doc = await run_in_threadpool(
                lambda: db.collection("users").document(user_id).get()
            )
            if user_doc.exists:
                user_data = user_doc.to_dict() or {}
                initial = user_data.get("initial_content_level")
                if initial and isinstance(initial, int) and 1 <= initial <= 5:
                    # Use the onboarding level as the starting point for new users
                    # (they haven't taken any quizzes yet, so this is the best signal)
                    return initial

            mastery_ref = db.collection("users").document(user_id).collection("mastery")
            docs = await run_in_threadpool(lambda: list(mastery_ref.stream()))

            if not docs:
                return 2  # New user with no data → start at Detailed (not hardest)

            # Filter to skills matching this unit prefix
            unit_prefix = unit_id.replace("u", "").strip("_")
            relevant = []
            for d in docs:
                skill_id = d.id
                p = float((d.to_dict() or {}).get("p_mastery", 0.3))
                # Skills are like "rel_001", "sql_004" — match by prefix
                if skill_id.startswith(unit_prefix) or not unit_prefix:
                    relevant.append(p)

            if not relevant:
                return 2  # No relevant skills → Detailed

            avg_mastery = sum(relevant) / len(relevant)
            # Convert 0-1 mastery to percentage
            return self._pct_to_level(avg_mastery * 100)

        except Exception as e:
            logger.error(f"Error in mastery fallback: {e}")
            return 2

    def _pct_to_level(self, pct: float) -> int:
        """
        Map a percentage score to a content level.

        More aggressive than typical — drops to simpler content faster
        because it's better to over-scaffold than to leave a confused
        student on expert content they can't understand.
        """
        if pct >= 90:
            return 1  # Expert
        elif pct >= 70:
            return 2  # Detailed
        elif pct >= 50:
            return 3  # Key Points
        elif pct >= 25:
            return 4  # Real World
        else:
            return 5  # Analogy (simplest)

    def calculate_post_quiz_level(
        self,
        score: int,
        total_questions: int,
        current_level: int,
        confusion_detected: bool = False,
    ) -> int:
        """
        Immediately calculate the new content level after a quiz completes.

        Called by the frontend after quiz submission to determine what level
        to reload the content at — gives instant feedback without waiting
        for the next page load.

        Rules:
          - Score 0/N → drop 2 levels (or to 5, whichever is less)
          - Score < 33% → drop 1 level
          - Score 33-66% → stay same level
          - Score 67-99% → go up 1 level (harder)
          - Score 100% → go up 2 levels (or to 1)
          - If confusion was detected during the quiz, add 1 extra level drop
        """
        if total_questions == 0:
            return current_level

        pct = (score / total_questions) * 100

        if pct == 0:
            new_level = min(5, current_level + 2)
        elif pct < 33:
            new_level = min(5, current_level + 1)
        elif pct <= 66:
            new_level = current_level  # Stay
        elif pct < 100:
            new_level = max(1, current_level - 1)
        else:
            new_level = max(1, current_level - 2)

        # Confusion penalty: if ML detected confusion during the quiz,
        # push one more level toward simpler content
        if confusion_detected and new_level < 5:
            new_level = min(5, new_level + 1)

        return new_level

    def get_level_for_behavior(
        self,
        confusion_score: float,
        current_level: int,
        consecutive_wrong: int = 0,
        hint_requests: int = 0,
    ) -> int:
        """
        Real-time level adjustment based on behavioral signals.

        Called by the behavior router when confusion is detected mid-lesson.
        More aggressive than the quiz-based adjustment because the user is
        actively struggling RIGHT NOW.

        Signals:
          - confusion_score > 0.7 → drop 2 levels
          - confusion_score > 0.5 → drop 1 level
          - 3+ consecutive wrong answers → drop 1 level
          - 2+ hint requests → drop 1 level (capped at 1 extra drop)
        """
        new_level = current_level

        # Confusion-driven drops
        if confusion_score > 0.7:
            new_level = min(5, new_level + 2)
        elif confusion_score > 0.5:
            new_level = min(5, new_level + 1)

        # Performance-driven drops
        if consecutive_wrong >= 3:
            new_level = min(5, new_level + 1)

        # Hint-seeking behavior
        if hint_requests >= 2 and new_level < 5:
            new_level = min(5, new_level + 1)

        return new_level


adaptive_service = AdaptiveService()
