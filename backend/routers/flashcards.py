from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from schemas import common
from services.srs_service import srs_service, ReviewAnswer
from routers.auth import get_current_user
from firebase_admin import firestore
from datetime import datetime, timedelta
from typing import List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/due", response_model=List[common.FlashcardProgress])
def get_due_flashcards(user=Depends(get_current_user), db=Depends(get_db)):
    """
    Fetch flashcards that are due for review for the current user.
    """
    user_id = user["uid"]
    now = datetime.utcnow()
    
    # Query: users/{uid}/flashcard_progress where next_review_at <= now
    progress_ref = (db.collection("users")
                    .document(user_id)
                    .collection("flashcard_progress")
                    .where(field_path="next_review_at", op_string="<=", value=now))
    
    docs = progress_ref.stream()
    due_cards = []
    
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        
        # Fetch the actual card content (denormalized for speed or join here)
        # For now, let's assume we store card content in a root collection 'flashcards'
        card_id = data.get("card_id")
        card_doc = db.collection("flashcards").document(card_id).get()
        
        if card_doc.exists:
            data["card"] = card_doc.to_dict()
            data["card"]["id"] = card_doc.id
            due_cards.append(data)
            
    return due_cards

@router.post("/{card_id}/review")
def review_flashcard(
    card_id: str, 
    review: common.FlashcardReview,
    user=Depends(get_current_user), 
    db=Depends(get_db)
):
    """
    Submit a review result for a flashcard and update its SRS state.
    """
    user_id = user["uid"]
    now = datetime.utcnow()
    
    progress_ref = (db.collection("users")
                    .document(user_id)
                    .collection("flashcard_progress")
                    .document(card_id))
    
    doc = progress_ref.get()
    
    if not doc.exists:
        # Initialize new card progress if it doesn't exist
        current_state = "NEW"
        interval = 0
        ease_factor = 2.5
        repetition = 0
        step_index = 0
        stored_arm = None
        stored_confusion = None
        stored_mastery = None
    else:
        data = doc.to_dict()
        current_state = data.get("state")
        interval = data.get("interval")
        ease_factor = data.get("ease_factor")
        repetition = data.get("repetition")
        step_index = data.get("step_index")
        stored_arm = data.get("recommended_arm")
        stored_confusion = data.get("spawn_confusion_score")
        stored_mastery = data.get("spawn_mastery")
        
    try:
        ans = ReviewAnswer(review.answer.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid review answer. Use AGAIN, HARD, GOOD, or EASY.")
        
    # Calculate next state
    next_state = srs_service.calculate_next_review(
        current_state=current_state,
        interval=interval,
        ease_factor=ease_factor,
        repetition=repetition,
        step_index=step_index,
        answer=ans,
        now=now
    )
    
    # Save back to Firestore
    next_state["card_id"] = card_id
    # Preserve the originating bandit context across reviews so the
    # SRS reward loop keeps working after the first review.
    if stored_arm:
        next_state["recommended_arm"] = stored_arm
    if stored_confusion is not None:
        next_state["spawn_confusion_score"] = stored_confusion
    if stored_mastery is not None:
        next_state["spawn_mastery"] = stored_mastery
    progress_ref.set(next_state)

    # ── Long-term recall reward feedback to LinUCB ─────────────────
    # When the client supplies the arm whose explanation produced
    # this card, treat the SM-2 outcome as additional bandit signal
    # so LinUCB learns from RETAINED recall, not just immediate quiz
    # accuracy. AGAIN=0 punishes the arm; EASY=1 reinforces it.
    SRS_REWARD_MAP = {
        "AGAIN": 0.0,
        "HARD": 0.4,
        "GOOD": 0.8,
        "EASY": 1.0,
    }
    arm = review.recommended_arm or stored_arm
    if arm:
        try:
            from services.ml_service import ml_service
            reward = SRS_REWARD_MAP.get(ans.value, 0.5)
            ml_service.update_bandit(
                arm_name=arm,
                context={
                    "user_id": user_id,
                    "confusion_score":
                        review.confusion_score
                        if review.confusion_score is not None
                        else (stored_confusion if stored_confusion is not None else 0.5),
                    "mastery":
                        review.mastery
                        if review.mastery is not None
                        else (stored_mastery if stored_mastery is not None else 0.5),
                },
                reward=reward,
            )
            logger.info(
                "SRS-RL: arm=%s answer=%s reward=%.2f card=%s",
                arm, ans.value, reward, card_id,
            )
        except Exception as e:  # never let RL break the review write
            logger.error(f"SRS bandit update failed: {e}")

    return {"status": "success", "next_review_at": next_state["next_review_at"]}

@router.post("/spawn-from-confusion")
def spawn_flashcard_from_confusion(
    topic_id: str,
    question: str,
    answer: str,
    course_id: str = None,
    unit_id: str = None,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Creates a new flashcard in the global library and links it to the user.
    """
    card_slug = srs_service.spawn_card(
        db=db,
        user_id=user["uid"],
        topic_id=topic_id,
        question=question,
        answer=answer,
        course_id=course_id,
        unit_id=unit_id
    )
    return {"status": "spawned", "card_id": card_slug}


@router.get("/forecast")
def get_review_forecast(
    days: int = 30,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    14- or 30-day spaced-repetition workload forecast for the *calling* user.

    Buckets that user's flashcard_progress documents by the calendar day of
    their ``next_review_at`` timestamp and returns:

      - per-day counts (oldest → newest) for the next ``days`` days
      - count of cards already overdue
      - count of cards due today
      - state breakdown (NEW/LEARNING/REVIEW/RELEARNING/MASTERED)

    The L3 calendar heatmap on /review consumes this directly.
    """
    user_id = user["uid"]
    days = max(1, min(60, int(days or 30)))
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end = today + timedelta(days=days)

    # Initialise empty buckets so the heatmap always has a stable grid.
    buckets: dict[str, int] = {
        (today + timedelta(days=i)).date().isoformat(): 0
        for i in range(days)
    }
    state_counts: dict[str, int] = {
        "NEW": 0,
        "LEARNING": 0,
        "REVIEW": 0,
        "RELEARNING": 0,
        "MASTERED": 0,
    }
    overdue = 0
    due_today = 0
    total = 0

    try:
        prog_ref = (
            db.collection("users")
            .document(user_id)
            .collection("flashcard_progress")
        )
        for doc in prog_ref.stream():
            data = doc.to_dict() or {}
            total += 1
            state = str(data.get("state", "NEW"))
            if state in state_counts:
                state_counts[state] += 1

            nxt = data.get("next_review_at")
            if nxt is None:
                continue
            # Firestore returns timezone-aware datetimes; normalise.
            if hasattr(nxt, "timestamp"):
                ts = datetime.utcfromtimestamp(nxt.timestamp())
            else:
                ts = nxt
            day = ts.replace(hour=0, minute=0, second=0, microsecond=0)

            if ts < today:
                overdue += 1
            elif day == today:
                due_today += 1
                key = day.date().isoformat()
                if key in buckets:
                    buckets[key] += 1
            elif day < end:
                key = day.date().isoformat()
                if key in buckets:
                    buckets[key] += 1
    except Exception as e:  # pragma: no cover — keep the dashboard resilient
        logger.error(f"forecast failed for {user_id}: {e}")

    return {
        "user_id": user_id,
        "today": today.date().isoformat(),
        "horizon_days": days,
        "total_cards": total,
        "overdue": overdue,
        "due_today": due_today,
        "by_day": [
            {"date": d, "count": c}
            for d, c in sorted(buckets.items())
        ],
        "by_state": state_counts,
    }
