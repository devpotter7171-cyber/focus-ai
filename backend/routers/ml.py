"""
Backend Router: ML Inference Endpoints

Provides API endpoints for real-time ML model inference.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
import sys
import os

# Add ml directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "ml"))

router = APIRouter()


# ============== Pydantic Schemas ==============

class BehaviorPayload(BaseModel):
    """Input for confusion prediction."""
    user_id: str
    question_id: Optional[str] = None
    time_on_question_ms: int = Field(default=0, ge=0)
    hesitation_ms: int = Field(default=0, ge=0)
    tab_switches: int = Field(default=0, ge=0)
    scroll_depth_pct: float = Field(default=0, ge=0, le=100)
    attempts: int = Field(default=1, ge=1)
    hint_requests: int = Field(default=0, ge=0)
    wrong_option_hover_count: int = Field(default=0, ge=0)


class ConfusionResponse(BaseModel):
    """Output for confusion prediction."""
    confusion_score: float
    is_confused: bool
    confidence: float
    feature_contributions: Optional[Dict[str, float]] = None


class RecommendationRequest(BaseModel):
    """Input for recommendation."""
    user_id: str
    confusion_score: Optional[float] = 0.5
    avg_mastery: Optional[float] = 0.5
    learning_style: Optional[str] = "Balanced"
    current_skill: Optional[str] = None


class RecommendationResponse(BaseModel):
    """Output for recommendation."""
    explanation_type: str
    arm_id: int
    reason: str
    next_question_id: Optional[str] = None
    all_arm_scores: Optional[List[Dict]] = None


class MasteryRequest(BaseModel):
    """Input for mastery prediction."""
    user_id: str
    interaction_history: List[Dict[str, Any]]


class MasteryResponse(BaseModel):
    """Output for mastery prediction."""
    mastery_by_skill: Dict[str, float]
    weak_skills: List[str]
    overall_mastery: float


class TrainRequest(BaseModel):
    """Input for model training trigger."""
    use_synthetic: bool = True
    n_samples: int = 10000


# ============== Endpoints ==============

@router.post("/infer/confusion", response_model=ConfusionResponse)
async def infer_confusion(payload: BehaviorPayload):
    """
    Predict confusion probability from behavioral signals.
    
    This endpoint is called in real-time during learning sessions
    to detect when a student is struggling.
    """
    try:
        from inference.confusion_infer import predict_confusion, confusion_service
        
        behavior_data = {
            "time_on_question_ms": payload.time_on_question_ms,
            "hesitation_ms": payload.hesitation_ms,
            "tab_switches": payload.tab_switches,
            "scroll_depth_pct": payload.scroll_depth_pct,
            "attempts": payload.attempts,
            "hint_requests": payload.hint_requests,
            "wrong_option_hover_count": payload.wrong_option_hover_count
        }
        
        confusion_score = predict_confusion(behavior_data)
        feature_importance = confusion_service.get_feature_importance()
        
        return ConfusionResponse(
            confusion_score=round(confusion_score, 4),
            is_confused=confusion_score > 0.5,
            confidence=0.85 if confusion_service.model else 0.5,
            feature_contributions=feature_importance if feature_importance else None
        )
        
    except ImportError as e:
        # Fallback if ML module not available
        hesitation = payload.hesitation_ms
        tabs = payload.tab_switches
        hovers = payload.wrong_option_hover_count
        
        score = 0.15
        if hesitation > 3000:
            score += 0.3
        if tabs > 2:
            score += 0.25
        if payload.attempts > 2:
            score += 0.2
        if hovers > 2:
            score += 0.25
            
        return ConfusionResponse(
            confusion_score=min(1.0, score),
            is_confused=score > 0.5,
            confidence=0.4,
            feature_contributions=None
        )


@router.post("/infer/recommend", response_model=RecommendationResponse)
async def infer_recommendation(request: RecommendationRequest):
    """
    Get personalized content recommendation using LinUCB bandit.
    
    Returns the optimal explanation type based on user context.
    """
    try:
        from inference.bandit_logic import select_explanation
        
        user_context = {
            "user_id": request.user_id,
            "confusion_score": request.confusion_score,
            "avg_mastery": request.avg_mastery,
            "learning_style": request.learning_style,
            "time_on_question_norm": 0.5  # Default normalized value
        }
        
        result = select_explanation(user_context)
        
        return RecommendationResponse(
            explanation_type=result["arm_name"],
            arm_id=result["arm_id"],
            reason=result["reason"],
            next_question_id=None,  # Would be filled by question selector
            all_arm_scores=result.get("all_scores")
        )
        
    except ImportError:
        # Fallback to random selection
        import random
        arms = ["visual", "step", "example", "analogy", "easier", "harder"]
        selected = random.choice(arms)
        
        return RecommendationResponse(
            explanation_type=selected,
            arm_id=arms.index(selected),
            reason="Random selection (ML module unavailable)",
            next_question_id=None
        )


@router.post("/infer/mastery", response_model=MasteryResponse)
async def infer_mastery(request: MasteryRequest):
    """
    Predict skill mastery using Deep Knowledge Tracing.
    """
    try:
        from inference.dkt_infer import predict_mastery, get_weak_skills
        
        mastery = predict_mastery(request.interaction_history)
        weak = get_weak_skills(mastery, threshold=0.5)
        
        overall = sum(mastery.values()) / len(mastery) if mastery else 0.5
        
        return MasteryResponse(
            mastery_by_skill=mastery,
            weak_skills=weak,
            overall_mastery=round(overall, 4)
        )
        
    except ImportError:
        # Fallback
        return MasteryResponse(
            mastery_by_skill={},
            weak_skills=[],
            overall_mastery=0.5
        )


@router.post("/train/{model_name}")
async def trigger_training(model_name: str, request: TrainRequest):
    """
    Trigger model retraining (admin only).
    
    Args:
        model_name: One of 'confusion', 'profiler', 'bandit', 'dkt'
        request: Training configuration
    """
    valid_models = ["confusion", "profiler", "bandit", "dkt"]
    
    if model_name not in valid_models:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid model. Choose from: {valid_models}"
        )
    
    # In production, this would queue a background training job
    return {
        "status": "queued",
        "model": model_name,
        "use_synthetic": request.use_synthetic,
        "n_samples": request.n_samples,
        "message": f"Training job for {model_name} has been queued."
    }


@router.get("/models/status")
async def get_model_status():
    """
    Check which models are loaded and available.
    Returns detailed status for the ML Monitor dashboard.
    """
    from datetime import datetime
    
    def get_model_info(name: str, model_obj, default_samples: int = 5000):
        """Helper to build model info dict."""
        if model_obj is not None:
            return {
                "name": name,
                "status": "loaded",
                "last_trained": "2024-01-15",  # Could be stored in model metadata
                "version": "1.0.0",
                "accuracy": 0.87,  # Could be loaded from training metrics
                "samples_trained": default_samples
            }
        return {
            "name": name,
            "status": "not_loaded"
        }
    
    models = {}
    
    # Check Confusion Model
    try:
        from inference.confusion_infer import confusion_service
        models["confusion"] = get_model_info("Confusion Detector", confusion_service.model, 10000)
    except Exception as e:
        models["confusion"] = {"name": "Confusion Detector", "status": "error"}
    
    # Check Profiler Model
    try:
        from inference.profiler_infer import profiler_service  
        models["profiler"] = get_model_info("Cognitive Profiler", profiler_service.model, 5000)
    except Exception:
        models["profiler"] = {"name": "Cognitive Profiler", "status": "error"}
    
    # Check DKT Model
    try:
        from inference.dkt_infer import dkt_service
        models["dkt"] = get_model_info("Deep Knowledge Tracing", dkt_service.model, 8000)
    except Exception:
        models["dkt"] = {"name": "Deep Knowledge Tracing", "status": "error"}
    
    # Check Bandit Model
    try:
        from inference.bandit_logic import bandit
        models["bandit"] = get_model_info("Bandit (LinUCB)", bandit, 1000)
    except Exception:
        models["bandit"] = {"name": "Bandit (LinUCB)", "status": "error"}
    
    return {"models": models}



# ─── Live monitoring endpoints (for /admin/ml-monitor) ───────────────────────


@router.get("/metrics/latency")
async def get_latency_metrics():
    """In-memory latency snapshot (per-route P50/P95/P99 + global)."""
    from services.latency_metrics import latency_metrics
    return latency_metrics.snapshot()


@router.get("/metrics/bandit")
async def get_bandit_state():
    """
    Current bandit arm scores under a neutral context.

    Useful for the ML monitor to show which arms LinUCB currently
    favours without having to wait for the next learner request.
    """
    from inference.bandit_logic import select_explanation
    from services.bandit_service import bandit_service

    neutral = {
        "user_id": "monitor",
        "confusion_score": 0.5,
        "avg_mastery": 0.5,
        "learning_style": "Balanced",
        "time_on_question_norm": 0.5,
    }
    try:
        result = select_explanation(neutral)
        return {
            "arms": bandit_service.EXPLANATION_TYPES,
            "selected": result.get("arm_name"),
            "selected_arm_id": result.get("arm_id"),
            "all_scores": result.get("all_scores", []),
            "reason": result.get("reason", ""),
        }
    except Exception as exc:  # pragma: no cover — keep the dashboard up
        return {
            "arms": bandit_service.EXPLANATION_TYPES,
            "selected": None,
            "selected_arm_id": None,
            "all_scores": [],
            "reason": f"Bandit unavailable: {exc}",
        }


@router.get("/metrics/confusion-distribution")
async def get_confusion_distribution(hours: int = 24):
    """
    Histogram of confusion scores recorded in the last ``hours``
    (default 24). Returns 10 bins from 0..1.
    """
    from database import get_db
    db = get_db()

    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, min(hours, 24 * 7)))

    bins = [0] * 10
    total = 0
    score_sum = 0.0
    by_arm: dict[str, int] = {}

    try:
        q = (db.collection("confusion_events")
             .where(field_path="timestamp", op_string=">=", value=cutoff)
             .limit(500))
        for doc in q.stream():
            d = doc.to_dict() or {}
            score = float(d.get("confusion_score", 0) or 0)
            score = max(0.0, min(1.0, score))
            idx = min(9, int(score * 10))
            bins[idx] += 1
            score_sum += score
            total += 1
    except Exception:
        # On a fresh DB or rules error, return zeroes — UI handles it.
        pass

    return {
        "horizon_hours": hours,
        "total_events": total,
        "avg_confusion": round(score_sum / total, 3) if total else 0.0,
        "bins": [
            {"lo": round(i / 10, 1), "hi": round((i + 1) / 10, 1), "count": c}
            for i, c in enumerate(bins)
        ],
        "by_arm": by_arm,
    }
