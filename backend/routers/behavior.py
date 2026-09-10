from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from database import get_db
from schemas import common
from starlette.concurrency import run_in_threadpool
import logging
from firebase_admin import firestore

router = APIRouter()
logger = logging.getLogger(__name__)

from services.ml_service import ml_service

# ============== Response Models ==============

class ConfusionResult(BaseModel):
    confusion_score: float
    is_confused: bool
    confidence: float
    feature_contributions: Optional[Dict[str, float]] = None

class BanditArmScore(BaseModel):
    name: str
    score: float
    is_selected: bool

class AdaptiveDecision(BaseModel):
    selected_arm: Dict[str, Any]
    context: Dict[str, Any]
    all_arm_scores: Optional[List[BanditArmScore]] = None
    reason: str
    timestamp: str

class BehaviorResponse(BaseModel):
    status: str
    confusion: Optional[ConfusionResult] = None
    recommendation: Optional[AdaptiveDecision] = None
    intervention_triggered: bool = False
    intervention_type: Optional[str] = None

# ============== Intervention Logging ==============

async def log_intervention(
    db,
    user_id: str,
    subtopic: str,
    confusion_score: float,
    bandit_arm: str,
    arm_confidence: float,
    all_arm_scores: List[Dict],
    reason: str
):
    """Log intervention decisions to Firestore."""
    try:
        await run_in_threadpool(lambda: db.collection("intervention_logs").add({
            "user_id": user_id,
            "subtopic": subtopic,
            "confusion_score": confusion_score,
            "bandit_arm_selected": bandit_arm,
            "arm_confidence": arm_confidence,
            "all_arm_scores": all_arm_scores,
            "reason": reason,
            "timestamp": firestore.SERVER_TIMESTAMP
        }))
        logger.info(f"Intervention logged: user={user_id}, arm={bandit_arm}")
    except Exception as e:
        logger.error(f"Failed to log intervention: {e}")

# ============== Main Behavior Processing ==============

async def process_behavior_with_ml(event: common.BehaviorLog, db) -> BehaviorResponse:
    """Process behavior event and return explicit ML decisions."""
    
    # Save raw behavior to Firestore
    # Collection: behavior_logs
    try:
        await run_in_threadpool(lambda: db.collection("behavior_logs").add({
            "user_id": event.user_id,
            "event_type": event.event_type,
            "data": event.data,
            "timestamp": firestore.SERVER_TIMESTAMP
        }))
    except Exception as e:
        logger.error(f"Failed to save behavior log: {e}")
    
    response = BehaviorResponse(status="logged")
    
    # Only run ML for behavior_snapshot or page_view events
    if event.event_type not in ["behavior_snapshot", "page_view", "question_attempt"]:
        return response
    
    try:
        # 1. Confusion Detection
        confusion_score = await run_in_threadpool(ml_service.predict_confusion, event.model_dump())
        
        # Feature contributions
        raw_data = event.data or {}
        feature_contributions = {
            "hesitation_ms": min(1.0, (raw_data.get("hesitation_ms", 0) / 10000)),
            "tab_switches": min(1.0, (raw_data.get("tab_switches", 0) / 5)),
            "scroll_depth": raw_data.get("scroll_depth", 0) / 100 if raw_data.get("scroll_depth") else 0,
            "time_on_question": min(1.0, (raw_data.get("time_ms", 0) / 60000)),
            "attempts": min(1.0, (raw_data.get("attempts", 1) / 5)),
            "wrong_option_hover_count": min(1.0, (raw_data.get("wrong_option_hover_count", 0) / 5))
        }
        
        response.confusion = ConfusionResult(
            confusion_score=round(confusion_score, 4),
            is_confused=confusion_score > 0.5,
            confidence=0.85 if ml_service.confusion_model else 0.5,
            feature_contributions=feature_contributions
        )
        
        logger.info(f"User {event.user_id} Confusion: {confusion_score:.2f}")
        
        # 2. Bandit Recommendation
        if confusion_score > 0.4:
            # Get learner profile
            profile = await run_in_threadpool(ml_service.predict_profile, [event.model_dump()])
            
            # Context
            context = {
                "user_id": event.user_id,
                "confusion_score": confusion_score,
                "avg_mastery": 0.5,
                "learning_style": profile,
                "context": raw_data.get("screen", "general")
            }
            
            bandit_result = await run_in_threadpool(ml_service.predict_bandit, context)

            # Bandit now returns one of the 6 canonical string arms
            # (see services.bandit_service.EXPLANATION_TYPES).
            arms = ["visual", "step", "example", "analogy", "easier", "harder"]
            if bandit_result not in arms:
                logger.warning(
                    f"Unexpected bandit arm '{bandit_result}', falling back to 'visual'"
                )
                bandit_result = "visual"

            all_arm_scores = [
                BanditArmScore(
                    name=arm,
                    score=0.5 + (0.3 if arm == bandit_result else -0.1),
                    is_selected=(arm == bandit_result)
                )
                for arm in arms
            ]

            selected_arm_idx = arms.index(bandit_result)
            
            response.recommendation = AdaptiveDecision(
                selected_arm={
                    "name": bandit_result,
                    "id": selected_arm_idx,
                    "confidence": 0.75 if ml_service.bandit_model else 0.5
                },
                context={
                    "confusion_score": round(confusion_score, 4),
                    "mastery": 0.5,
                    "learning_style": profile,
                    "time_on_question_norm": min(1.0, raw_data.get("time_ms", 0) / 60000)
                },
                all_arm_scores=all_arm_scores,
                reason=f"Based on {profile} profile with {confusion_score:.0%} confusion, recommending {bandit_result} approach.",
                timestamp=datetime.now(timezone.utc).isoformat()
            )
            
            # Trigger Intervention
            if confusion_score > 0.6:
                response.intervention_triggered = True
                response.intervention_type = bandit_result
                
                from services.srs_service import srs_service
                # Severe Confusion Intervention: Spawn SRS Flashcard
                if confusion_score > 0.7:
                    try:
                        srs_service.spawn_card(
                            db=db,
                            user_id=event.user_id,
                            topic_id=raw_data.get("screen", "unknown"),
                            question=f"Key concept from {raw_data.get('screen', 'topic')}",
                            answer=f"You expressed confusion during this topic. Review the core concepts and try explaining them in your own words.",
                            course_id=raw_data.get("course_id"),
                            unit_id=raw_data.get("unit_id"),
                            recommended_arm=bandit_result,
                            confusion_score=confusion_score,
                            mastery=0.5,
                        )
                        logger.info(f"SRS Flashcard spawned for user {event.user_id} due to high confusion.")
                    except Exception as srs_err:
                        logger.error(f"Failed to spawn SRS card: {srs_err}")

                await log_intervention(
                    db=db,
                    user_id=event.user_id,
                    subtopic=raw_data.get("screen", "unknown"),
                    confusion_score=confusion_score,
                    bandit_arm=bandit_result,
                    arm_confidence=0.75,
                    all_arm_scores=[s.model_dump() for s in all_arm_scores],
                    reason=response.recommendation.reason
                )

                # NEW: Save detailed confusion context for later analysis/retrieval
                try:
                    await run_in_threadpool(lambda: db.collection("confusion_events").add({
                        "user_id": event.user_id,
                        "subtopic_id": raw_data.get("screen", "unknown"),
                        "question_id": raw_data.get("question_id", "unknown"),
                        "confusion_score": confusion_score,
                        "metrics": {
                            "hesitation_ms": raw_data.get("hesitation_ms", 0),
                            "tab_switches": raw_data.get("tab_switches", 0),
                            "wrong_option_hover_count": raw_data.get("wrong_option_hover_count", 0),
                            "attempts": raw_data.get("attempts", 0)
                        },
                        "timestamp": firestore.SERVER_TIMESTAMP,
                        "human_readable_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }))
                except Exception as ex:
                    logger.error(f"Failed to save confusion event: {ex}")

                logger.warning(f"INTERVENTION: User {event.user_id} - switching to {bandit_result}")
        
    except Exception as e:
        logger.error(f"ML Processing Error: {e}")
    
    return response

@router.post("", response_model=BehaviorResponse)
async def log_behavior(
    event: common.BehaviorLog, 
    background_tasks: BackgroundTasks, 
    db = Depends(get_db)
):
    logger.debug(f"Received behavior log for user: {event.user_id}")
    return await process_behavior_with_ml(event, db)


class FeedbackRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    subtopic_id: Optional[str] = None
    is_confused: bool
    feedback_text: Optional[str] = None
    recommended_arm: Optional[str] = None  # NEW: Track which content type was shown

@router.post("/feedback")
async def submit_feedback(
    feedback: FeedbackRequest,
    db = Depends(get_db)
):
    try:
        # 1. Log to Firestore
        await run_in_threadpool(lambda: db.collection("user_feedback").add({
            "user_id": feedback.user_id,
            "session_id": feedback.session_id,
            "subtopic_id": feedback.subtopic_id,
            "is_confused": 1 if feedback.is_confused else 0,
            "feedback_text": feedback.feedback_text,
            "recommended_arm": feedback.recommended_arm,
            "timestamp": firestore.SERVER_TIMESTAMP
        }))
        
        # 2. Update Contextual Bandit (Reinforcement Learning)
        # If we recommended an arm, and the user gave feedback:
        # - Not Confused (Helpful) -> Reward = 1.0
        # - Confused (Not Helpful) -> Reward = 0.0
        if feedback.recommended_arm:
            reward = 0.0 if feedback.is_confused else 1.0
            
            # Run in threadpool to avoid blocking
            from fastapi.concurrency import run_in_threadpool
            await run_in_threadpool(
                ml_service.update_bandit,
                arm_name=feedback.recommended_arm,
                context={"user_id": feedback.user_id},
                reward=reward
            )
            logger.info(f"RL Loop: Updated {feedback.recommended_arm} with reward {reward}")

        return {"status": "recorded", "thank_you": True}
    except Exception as e:
        logger.error(f"Feedback submission error: {e}")
        return {"status": "error", "message": str(e)}

class PreferenceRequest(BaseModel):
    user_id: str
    level: int

@router.post("/preference")
async def update_preference(
    req: PreferenceRequest,
    db = Depends(get_db)
):
    """
    Update the user's preferred content level (Stickiness).
    """
    try:
        if req.level < 1 or req.level > 5:
             raise HTTPException(status_code=400, detail="Level must be between 1 and 5")

        # Save to Firestore User Profile
        # Save to Firestore User Profile
        user_ref = db.collection('users').document(req.user_id)
        await run_in_threadpool(lambda: user_ref.set({
            "preferred_level": req.level,
            "last_active": firestore.SERVER_TIMESTAMP
        }, merge=True))
        
        logger.info(f"Preference Saved: User {req.user_id} -> Level {req.level}")
        return {"status": "updated", "level": req.level}
    except Exception as e:
        logger.error(f"Preference update warning: {e}")
        # Return success for MVP robustness even if DB write fails (e.g. permission)
        return {"status": "fallback", "level": req.level}
