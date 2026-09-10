"""
Backend Router: Answer Submission

Handles quiz answer submissions and updates mastery.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import logging
from database import get_db
from firebase_admin import firestore
from starlette.concurrency import run_in_threadpool
from services.genai_service import genai_service
from services.bkt_service import bkt_service

logger = logging.getLogger(__name__)

router = APIRouter()


class AnswerSubmission(BaseModel):
    """Request body for answer submission."""
    user_id: str
    question_id: str
    answer: int  # Index of selected option
    time_taken_ms: int = Field(ge=0)
    attempts: int = Field(default=1, ge=1)
    is_hint_used: bool = False


class AnswerResponse(BaseModel):
    """Response after answer evaluation."""
    correct: bool
    correct_answer: Optional[int] = None  # Revealed after submission
    updated_mastery: Dict[str, float]
    recommended_explanation: str
    feedback_message: Optional[str] = None

class QuizSubmission(BaseModel):
    """Request body for full quiz submission."""
    user_id: str
    unit_id: str
    subtopic_id: str
    subtopic_title: Optional[str] = None
    score: int
    total_questions: int
    current_level: int = 1  # Current content level the user was on
    confusion_detected: bool = False  # Whether ML detected confusion during quiz
    metrics: Optional[Dict[str, int]] = None

class QuizHistoryResponse(BaseModel):
    """Response model for quiz history."""
    attempts: list

# In a real 100% migration, this should be fetched from Firestore 'questions' collection too.
# But for latency, caching this or keeping it in code for fixed quizzes is acceptable.
# We will verify if question exists in DB though.

@router.post("/submit", response_model=AnswerResponse)
async def submit_answer(submission: AnswerSubmission, db = Depends(get_db)):
    """
    Submit an answer to a quiz question.
    
    Evaluates correctness, updates mastery estimates, and returns
    a recommended explanation type based on performance.
    """
    question_id = submission.question_id
    
    # 1. Fetch Question from Firestore (Source of Truth)
    # Trying generic 'quiz' collection path used in questions.py
    q_ref = (db.collection("quiz")
             .document("dbms")
             .collection("questions")
             .document(question_id))
    
    q_doc = await run_in_threadpool(q_ref.get)
    
    if q_doc.exists:
        q_data = q_doc.to_dict() or {}
        correct_raw = q_data.get("correct_answer")
        options = q_data.get("options", [])
        # The seed JSON stores correct_answer as either an int index (most cases)
        # or as the option text string. Normalize both into a 0-based index.
        if isinstance(correct_raw, bool):
            correct_index = 0
        elif isinstance(correct_raw, int) and 0 <= correct_raw < len(options):
            correct_index = correct_raw
        elif isinstance(correct_raw, str):
            try:
                correct_index = options.index(correct_raw)
            except ValueError:
                correct_index = 0
        else:
            correct_index = 0
    else:
        # Question not in Firestore — return a clear error so the FE can handle it.
        logger.warning(f"Question {question_id} not found in DB.")
        q_data = {}
        options = []
        correct_index = 0

    is_correct = (submission.answer == correct_index)
    
    # 2. Log Answer to Firestore
    # Path: users/{uid}/answers/{auto_id}
    ans_ref = db.collection("users").document(submission.user_id).collection("answers").document()
    await run_in_threadpool(lambda: ans_ref.set({
        "question_id": question_id,
        "selected_answer": submission.answer,
        "is_correct": is_correct,
        "time_taken_ms": submission.time_taken_ms,
        "attempts": submission.attempts,
        "is_hint_used": submission.is_hint_used,
        "timestamp": firestore.SERVER_TIMESTAMP
    }))

    # 3. Bayesian Knowledge Tracing (BKT) Mastery Update
    # Instead of a simple +/- 0.1, we use probabilistic inference.
    skill = question_id.split("_")[1] if "_" in question_id else "general"
    
    mastery_ref = db.collection("users").document(submission.user_id).collection("mastery").document(skill)
    mastery_doc = await run_in_threadpool(mastery_ref.get)
    
    if mastery_doc.exists:
        m_data = mastery_doc.to_dict()
        current_p = m_data.get("p_mastery", 0.3)
        attempts = m_data.get("attempts", 0)
    else:
        initial_state = bkt_service.get_initial_state()
        current_p = initial_state["p_mastery"]
        attempts = 0
        m_data = initial_state

    # Update probability using BKT
    new_mastery = bkt_service.update_mastery(
        current_p_mastery=current_p,
        is_correct=is_correct
    )
    
    # Save back to Firestore
    m_data.update({
        "p_mastery": new_mastery,
        "attempts": attempts + 1,
        "last_updated": firestore.SERVER_TIMESTAMP
    })
    await run_in_threadpool(lambda: mastery_ref.set(m_data))
    
    logger.info(f"BKT Update: user={submission.user_id}, skill={skill}, old={current_p}, new={new_mastery}")
    
    # Determine recommended explanation
    if is_correct:
        if submission.time_taken_ms < 15000:  
            explanation = "harder" 
        else:
            explanation = "example"  
    else:
        if submission.attempts > 2:
            explanation = "easier"  
        elif submission.is_hint_used:
            explanation = "step"  
        else:
            explanation = "visual"  
    
    # Generate feedback message
    feedback = None
    if is_correct:
        if submission.time_taken_ms < 10000:
            feedback = "Excellent! You're mastering this concept quickly."
        else:
            feedback = "Correct! Take your time to fully understand."
    else:
        # Initial feedback fallback
        if submission.attempts >= 2:
            feedback = "Not quite. Let's try a simpler explanation."
        else:
            feedback = "That's not right, but don't worry. Review the material and try again."

        # Call GenAI for deeper analysis
        # In a real async app we might want to background this or await it.
        # Since we are in an async route, we can await if the service was async, 
        # but our service wrapper is sync (google-genai native client).
        # We'll run it and see. If latency is high, we might want to make it optional.
        try:
             # We need question text and options. We have them in q_data or fallback.
             q_text = q_data.get("text", "Unknown Question") if 'q_data' in locals() else "Unknown Question"
             
             # Get selected option text
             valid_options = q_data.get("options", []) if 'q_data' in locals() else []
             if 0 <= submission.answer < len(valid_options):
                 selected_text = valid_options[submission.answer]
             else:
                 selected_text = "Unknown Option"
                 
             if 0 <= correct_index < len(valid_options):
                 correct_text = valid_options[correct_index]
             else:
                 correct_text = "Unknown Correct Option"

             ai_feedback = await genai_service.analyze_mistake(q_text, selected_text, correct_text)
             if ai_feedback:
                 feedback = ai_feedback
        except Exception as e:
            logger.error(f"Error getting AI feedback: {e}")
            # Fallback to the static message is already set.

    return AnswerResponse(
        correct=is_correct,
        correct_answer=correct_index if not is_correct else None,
        updated_mastery={skill: round(new_mastery, 3)},
        recommended_explanation=explanation,
        feedback_message=feedback
    )


@router.get("/history/{user_id}")
async def get_answer_history(user_id: str, limit: int = 50, db = Depends(get_db)):
    """
    Get recent answer history for a user from Firestore.
    """
    answers_ref = (db.collection("users")
                   .document(user_id)
                   .collection("answers")
                   .order_by("timestamp", direction="DESCENDING")
                   .limit(limit))
                   
    docs = await run_in_threadpool(lambda: list(answers_ref.stream()))
    recent_answers = []
    correct_count = 0
    total = 0
    
    for doc in docs:
        d = doc.to_dict()
        total += 1
        if d.get("is_correct"):
            correct_count += 1
        # Convert timestamp to string
        ts = d.get("timestamp")
        if ts:
            d["timestamp"] = str(ts)
        recent_answers.append(d)
        
    correct_rate = (correct_count / total) if total > 0 else 0.0

    return {
        "user_id": user_id,
        "total_answers": total,
        "correct_rate": round(correct_rate, 2),
        "recent_answers": recent_answers
    }

@router.post("/submit-quiz")
async def submit_quiz_result(submission: QuizSubmission, db = Depends(get_db)):
    """
    Submit a completed quiz result to Firestore.
    Returns the recommended content level for the next session.
    """
    from services.adaptive_service import adaptive_service

    try:
        # Calculate the recommended next level immediately
        recommended_level = adaptive_service.calculate_post_quiz_level(
            score=submission.score,
            total_questions=submission.total_questions,
            current_level=submission.current_level,
            confusion_detected=submission.confusion_detected,
        )

        pct = (submission.score / submission.total_questions) * 100 if submission.total_questions > 0 else 0

        doc_ref = db.collection("quiz_results").document()
        await run_in_threadpool(lambda: doc_ref.set({
            "user_id": submission.user_id,
            "unit_id": submission.unit_id,
            "subtopic_id": submission.subtopic_id,
            "subtopic_title": submission.subtopic_title,
            "score": submission.score,
            "total_questions": submission.total_questions,
            "percentage": pct,
            "previous_level": submission.current_level,
            "recommended_level": recommended_level,
            "confusion_detected": submission.confusion_detected,
            "metrics": submission.metrics,
            "timestamp": firestore.SERVER_TIMESTAMP
        }))

        # Also store the recommended level in the user's preferences so the
        # next content load picks it up even without the explicit ?adaptation param
        pref_ref = db.collection("users").document(submission.user_id).collection("preferences").document("adaptive")
        await run_in_threadpool(lambda: pref_ref.set({
            f"level_{submission.unit_id}": recommended_level,
            "last_updated": firestore.SERVER_TIMESTAMP,
        }, merge=True))

        return {
            "status": "success",
            "id": doc_ref.id,
            "recommended_level": recommended_level,
            "score_pct": round(pct, 1),
            "level_changed": recommended_level != submission.current_level,
            "level_direction": "easier" if recommended_level > submission.current_level else "harder" if recommended_level < submission.current_level else "same",
        }
    except Exception as e:
        logger.error(f"Failed to save quiz result: {e}")
        raise HTTPException(status_code=500, detail="Failed to save quiz result")

@router.get("/quiz-history/{user_id}", response_model=QuizHistoryResponse)
async def get_quiz_history(user_id: str, limit: int = 20, db = Depends(get_db)):
    """
    Get recent quiz history for a user.
    """
    try:
        # NOTE: Removed .order_by("timestamp") to avoid needing a Composite Index for now.
        # We fetch all (or a larger limit) and sort in Python.
        # This is a temporary fix for smoother DX without manual console setup.
        docs = (db.collection("quiz_results")
                .where(field_path="user_id", op_string="==", value=user_id)
                .limit(limit * 2)) # Fetch slightly more to ensure we get recent ones after sort
        
        docs = await run_in_threadpool(lambda: list(docs.stream()))
        
        attempts = []
        for doc in docs:
            d = doc.to_dict()
            # Convert timestamp to string for serialization
            if "timestamp" in d and d["timestamp"]:
                # Handle DatetimeWithNanoseconds if present
                ts = d["timestamp"]
                d["timestamp"] = str(ts)
                # Keep raw timestamp for sorting
                d["_sort_ts"] = ts.timestamp() if hasattr(ts, 'timestamp') else 0
            else:
                d["_sort_ts"] = 0
                
            d["id"] = doc.id
            attempts.append(d)
            
        # Sort in memory (descending)
        attempts.sort(key=lambda x: x.get("_sort_ts", 0), reverse=True)
        
        # Clean up internal sort key and limit
        for a in attempts:
            a.pop("_sort_ts", None)
            
        return QuizHistoryResponse(attempts=attempts[:limit])
    except Exception as e:
        logger.error(f"Failed to fetch quiz history: {e}")
        return QuizHistoryResponse(attempts=[])


# ============== Mastery Snapshot ==============

@router.get("/mastery/{user_id}")
async def get_user_mastery(user_id: str, db = Depends(get_db)):
    """
    Return the current BKT mastery snapshot for a user.

    Each document under ``users/{uid}/mastery/{skill}`` carries a
    ``p_mastery`` probability and an ``attempts`` counter; we expose
    them grouped by unit (the skill prefix used in question IDs) plus
    a flat list of weak skills below 0.5.
    """
    def _load():
        snap = []
        try:
            mastery_ref = (db.collection("users")
                           .document(user_id)
                           .collection("mastery"))
            for doc in mastery_ref.stream():
                d = doc.to_dict() or {}
                snap.append({
                    "skill": doc.id,
                    "p_mastery": float(d.get("p_mastery", 0.3)),
                    "attempts": int(d.get("attempts", 0)),
                })
        except Exception as e:
            logger.error(f"mastery load failed: {e}")
        return snap

    snap = await run_in_threadpool(_load)

    # Group by unit (skill prefix). Skill IDs look like "rel_001" / "sql_004"
    # in the seed data, so the prefix before the underscore is the unit key.
    by_unit: Dict[str, Dict[str, float]] = {}
    for item in snap:
        prefix = item["skill"].split("_")[0] if "_" in item["skill"] else item["skill"]
        bucket = by_unit.setdefault(prefix, {"sum": 0.0, "count": 0})
        bucket["sum"] += item["p_mastery"]
        bucket["count"] += 1

    unit_mastery = [
        {
            "unit": prefix.upper(),
            "mastery": round((b["sum"] / b["count"]) * 100, 1) if b["count"] else 0.0,
        }
        for prefix, b in by_unit.items()
    ]
    unit_mastery.sort(key=lambda x: x["unit"])

    weak_skills = [
        {
            "skill": s["skill"],
            "score": round(s["p_mastery"] * 100, 1),
            "attempts": s["attempts"],
        }
        for s in snap
        if s["p_mastery"] < 0.5
    ]
    weak_skills.sort(key=lambda x: x["score"])

    overall = (
        round((sum(s["p_mastery"] for s in snap) / len(snap)) * 100, 1)
        if snap else 0.0
    )

    return {
        "user_id": user_id,
        "overall_mastery": overall,
        "by_unit": unit_mastery,
        "weak_skills": weak_skills,
        "total_skills_tracked": len(snap),
    }
