"""
At-Risk / Dropout Predictor — rule-based, explainable.

Adapted from LearnFlow-AI/src/lib/adaptive/prediction.ts. Pure-function so
it works with whatever data we already have in Firestore (no training set
needed). Run on demand from a teacher dashboard, or schedule as a daily
batch over `users/{uid}` documents.

Five risk factors, weighted, aggregated to a 0–100 risk score:

    long_absence       weight 1.5   "no activity in N days"
    engagement_drop    weight 1.3   "minutes/day fell ≥ 40 %"
    performance_decline weight 1.2  "recent accuracy ≤ 70 % of overall"
    difficulty_spike   weight 1.0   "incorrect streak ≥ 3 with low accuracy"
    pace_mismatch      weight 0.8   "time per topic 2× expected"

Returns:
    {
        risk_score: 0..100,
        risk_factors: [{ type, severity, description, data_points }],
        predicted_outcome: "complete" | "at_risk" | "likely_dropout",
        confidence: 0..1,
        recommendations: [{ priority, action, reason, automated_action? }],
        should_intervene: { trigger, type, urgency }
    }

The `confidence` value reflects HOW MUCH DATA we have to base the
prediction on — not how confident the model is in its label.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ─── Inputs ──────────────────────────────────────────────────────────────────

@dataclass
class DailyActivity:
    date: datetime
    minutes_spent: float
    questions_answered: int
    correct_count: int


@dataclass
class StudentSnapshot:
    user_id: str
    last_active_at: Optional[datetime]
    completed_subtopic_count: int
    overall_accuracy_pct: float
    incorrect_streak: int
    current_difficulty: int                 # 1..5 (Focus-AI scale, lower = harder)
    daily_activity: List[DailyActivity]


# ─── Weights ─────────────────────────────────────────────────────────────────

_WEIGHTS = {
    "long_absence": 1.5,
    "engagement_drop": 1.3,
    "performance_decline": 1.2,
    "difficulty_spike": 1.0,
    "pace_mismatch": 0.8,
}


# ─── Public API ──────────────────────────────────────────────────────────────

class RiskService:
    """Pure-function risk service. Stateless — safe to call concurrently."""

    EXPECTED_TIME_PER_TOPIC_MIN = 20.0

    def assess(self, snap: StudentSnapshot) -> Dict[str, Any]:
        factors = self._identify_factors(snap)
        risk_score = self._aggregate(factors)
        outcome = self._classify(risk_score)
        confidence = self._confidence(snap)
        recs = self._recommend(factors)
        intervene = self._intervention(risk_score, confidence)

        return {
            "user_id": snap.user_id,
            "risk_score": round(risk_score, 1),
            "predicted_outcome": outcome,
            "confidence": round(confidence, 2),
            "risk_factors": [self._factor_dict(f) for f in factors],
            "recommendations": recs,
            "should_intervene": intervene,
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── Indicator checks ───────────────────────────────────────────────

    def _identify_factors(self, snap: StudentSnapshot) -> List["_RiskFactor"]:
        out: List[_RiskFactor] = []

        if (f := self._engagement_drop(snap)): out.append(f)
        if (f := self._performance_decline(snap)): out.append(f)
        if (f := self._long_absence(snap)): out.append(f)
        if (f := self._difficulty_spike(snap)): out.append(f)
        if (f := self._pace_mismatch(snap)): out.append(f)

        return out

    def _engagement_drop(self, snap: StudentSnapshot) -> Optional["_RiskFactor"]:
        days = sorted(snap.daily_activity, key=lambda d: d.date)
        if len(days) < 7:
            return None
        recent = days[-3:]
        previous = days[-10:-3]
        if not previous:
            return None

        recent_avg = sum(d.minutes_spent for d in recent) / len(recent)
        prev_avg = sum(d.minutes_spent for d in previous) / len(previous)
        if prev_avg <= 0:
            return None
        drop = (prev_avg - recent_avg) / prev_avg
        if drop > 0.4:
            sev = min(1.0, drop)
            return _RiskFactor(
                type="engagement_drop",
                severity=sev,
                description=f"Engagement down {round(drop * 100)}% in the last 3 days",
                data_points={
                    "previous_minutes_per_day": round(prev_avg, 1),
                    "recent_minutes_per_day": round(recent_avg, 1),
                },
            )
        return None

    def _performance_decline(self, snap: StudentSnapshot) -> Optional["_RiskFactor"]:
        days = sorted(snap.daily_activity, key=lambda d: d.date)
        recent = [d for d in days[-5:] if d.questions_answered > 0]
        if len(recent) < 2:
            return None
        recent_acc = (
            sum(d.correct_count for d in recent) /
            sum(d.questions_answered for d in recent)
        ) * 100
        overall = snap.overall_accuracy_pct
        if overall <= 0:
            return None
        if recent_acc < overall * 0.7:
            decline = (overall - recent_acc) / overall
            return _RiskFactor(
                type="performance_decline",
                severity=min(1.0, decline * 2),
                description=f"Recent accuracy {round(recent_acc, 1)}% vs overall {round(overall, 1)}%",
                data_points={
                    "overall_accuracy": round(overall, 1),
                    "recent_accuracy": round(recent_acc, 1),
                    "incorrect_streak": snap.incorrect_streak,
                },
            )
        if snap.incorrect_streak >= 3:
            return _RiskFactor(
                type="performance_decline",
                severity=0.6,
                description=f"Incorrect streak of {snap.incorrect_streak}",
                data_points={"incorrect_streak": snap.incorrect_streak},
            )
        return None

    def _long_absence(self, snap: StudentSnapshot) -> Optional["_RiskFactor"]:
        if snap.last_active_at is None:
            return _RiskFactor(
                type="long_absence",
                severity=0.9,
                description="No activity recorded yet",
                data_points={},
            )
        days_since = (datetime.now(timezone.utc) - snap.last_active_at).days
        if days_since >= 14:
            return _RiskFactor(
                type="long_absence",
                severity=min(1.0, days_since / 30),
                description=f"Inactive for {days_since} days",
                data_points={"days_since_active": days_since},
            )
        if days_since >= 7:
            return _RiskFactor(
                type="long_absence",
                severity=days_since / 14,
                description=f"Inactive for {days_since} days",
                data_points={"days_since_active": days_since},
            )
        return None

    def _difficulty_spike(self, snap: StudentSnapshot) -> Optional["_RiskFactor"]:
        # Focus-AI: lower number = harder; 1 = expert, 5 = friendly analogy
        # "Difficulty spike" = student is on hard content (1-2) but failing
        if snap.current_difficulty <= 2 and snap.overall_accuracy_pct < 40 and snap.incorrect_streak >= 2:
            return _RiskFactor(
                type="difficulty_spike",
                severity=0.8,
                description="Stuck on hard content with low accuracy",
                data_points={
                    "current_difficulty": snap.current_difficulty,
                    "accuracy": round(snap.overall_accuracy_pct, 1),
                    "incorrect_streak": snap.incorrect_streak,
                },
            )
        if snap.incorrect_streak >= 5 and snap.overall_accuracy_pct < 50:
            return _RiskFactor(
                type="difficulty_spike",
                severity=0.7,
                description=f"{snap.incorrect_streak} incorrect in a row",
                data_points={"incorrect_streak": snap.incorrect_streak},
            )
        return None

    def _pace_mismatch(self, snap: StudentSnapshot) -> Optional["_RiskFactor"]:
        days = sorted(snap.daily_activity, key=lambda d: d.date)
        recent = days[-7:]
        if len(recent) < 7:
            return None
        total_min = sum(d.minutes_spent for d in recent)
        total_topics = sum(d.questions_answered for d in recent)
        if total_topics == 0:
            return None
        avg = total_min / max(1, total_topics)
        expected = self.EXPECTED_TIME_PER_TOPIC_MIN

        # Too slow + low accuracy = struggling
        if avg > expected * 2 and snap.overall_accuracy_pct < 70:
            return _RiskFactor(
                type="pace_mismatch",
                severity=0.6,
                description=f"Spending {round(avg, 1)} min/question (expected ~{int(expected)})",
                data_points={"avg_minutes_per_question": round(avg, 1)},
            )
        # Too fast + low accuracy = rushing
        if avg < expected * 0.5 and snap.overall_accuracy_pct < 60:
            return _RiskFactor(
                type="pace_mismatch",
                severity=0.5,
                description="Rushing through content with low accuracy",
                data_points={"avg_minutes_per_question": round(avg, 1)},
            )
        return None

    # ── Aggregation ────────────────────────────────────────────────────

    @staticmethod
    def _aggregate(factors: List["_RiskFactor"]) -> float:
        if not factors:
            return 0.0
        weighted = 0.0
        total_w = 0.0
        for f in factors:
            w = _WEIGHTS.get(f.type, 1.0)
            weighted += f.severity * w
            total_w += w
        if total_w == 0:
            return 0.0
        return min(100.0, (weighted / total_w) * 100)

    @staticmethod
    def _classify(score: float) -> str:
        if score < 30:
            return "complete"
        if score < 70:
            return "at_risk"
        return "likely_dropout"

    @staticmethod
    def _confidence(snap: StudentSnapshot) -> float:
        c = 0.0
        days = len(snap.daily_activity)
        if days >= 14: c += 0.4
        elif days >= 7: c += 0.25
        elif days >= 3: c += 0.1
        if snap.completed_subtopic_count >= 10: c += 0.3
        elif snap.completed_subtopic_count >= 5: c += 0.2
        elif snap.completed_subtopic_count >= 1: c += 0.1
        if snap.overall_accuracy_pct > 0: c += 0.2
        return min(1.0, c)

    # ── Recommendations ────────────────────────────────────────────────

    @staticmethod
    def _recommend(factors: List["_RiskFactor"]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for f in factors:
            if f.type == "long_absence":
                out.append({
                    "priority": "high" if f.severity > 0.7 else "medium",
                    "action": "Send a gentle re-engagement reminder",
                    "reason": "Student has been absent for an extended period.",
                    "automated_action": {
                        "type": "send_reminder",
                        "payload": {"include_progress": True},
                    },
                })
            elif f.type == "engagement_drop":
                out.append({
                    "priority": "medium",
                    "action": "Send a check-in / motivational message",
                    "reason": "Engagement has decreased significantly.",
                    "automated_action": {"type": "send_reminder", "payload": {"offer_support": True}},
                })
            elif f.type == "performance_decline":
                out.append({
                    "priority": "high",
                    "action": "Offer review of weak concepts",
                    "reason": "Recent accuracy is well below the student's average.",
                    "automated_action": {"type": "suggest_review", "payload": {"review_concepts": True}},
                })
                if f.severity > 0.6:
                    out.append({
                        "priority": "high",
                        "action": "Lower content difficulty temporarily",
                        "reason": "Sustained drop suggests content is too hard.",
                        "automated_action": {"type": "adjust_difficulty", "payload": {"adjustment": +1}},
                    })
            elif f.type == "difficulty_spike":
                out.append({
                    "priority": "high",
                    "action": "Move to friendlier explanation level",
                    "reason": "Student is overwhelmed by current difficulty.",
                    "automated_action": {"type": "adjust_difficulty", "payload": {"adjustment": +2}},
                })
            elif f.type == "pace_mismatch":
                rushing = "Rushing" in f.description
                out.append({
                    "priority": "medium",
                    "action": "Encourage slower reading" if rushing else "Offer additional support",
                    "reason": "Pacing pattern suggests "
                              + ("rushing through content." if rushing
                                 else "the student is taking too long."),
                    "automated_action": {"type": "offer_help", "payload": {}},
                })
        if not out:
            out.append({"priority": "low", "action": "Continue monitoring", "reason": "Student appears on track."})
        return out

    @staticmethod
    def _intervention(risk: float, confidence: float) -> Dict[str, Any]:
        if risk >= 70 and confidence >= 0.5:
            return {"trigger": True, "type": "critical_support", "urgency": "immediate"}
        if risk >= 50 and confidence >= 0.4:
            return {"trigger": True, "type": "proactive_support", "urgency": "soon"}
        if risk >= 30:
            return {"trigger": True, "type": "wellness_check", "urgency": "scheduled"}
        return {"trigger": False, "type": "none", "urgency": "scheduled"}

    @staticmethod
    def _factor_dict(f: "_RiskFactor") -> Dict[str, Any]:
        return {
            "type": f.type,
            "severity": round(f.severity, 2),
            "description": f.description,
            "data_points": f.data_points,
        }


@dataclass
class _RiskFactor:
    type: str
    severity: float                 # 0..1
    description: str
    data_points: Dict[str, Any]


# Singleton
risk_service = RiskService()
