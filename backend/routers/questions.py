from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from database import get_db
from firebase_admin import firestore
from starlette.concurrency import run_in_threadpool
import random
from services.genai_service import genai_service

router = APIRouter()

# Schema duplicated for now or import shared
class QuestionCreate(BaseModel):
    id: str
    subtopic_id: str
    text: str
    options: List[str]
    correct_answer: str
    hints: List[str] = [] # Level-based hints
    difficulty: float = 0.5

class AnswerSubmit(BaseModel):
    user_id: str
    question_id: str
    selected_answer: str
    time_taken_ms: int

@router.post("/")
async def create_question(question: QuestionCreate, db = Depends(get_db)):
    # Validate subtopic exists
    # Path: courses/{course_id}/units/{unit_id}/subtopics/{subtopic_id} is hard to find without knowing course/unit
    # Firestore structure makes reverse lookup (find parent of subtopic) hard unless we store parent IDs in question or subtopic ID is unique across system.
    # Assuming standard path: quiz/dbms/questions/{question_id} per seed service.
    
    # For now, just write to separate Questions collection or Quiz collection
    # Seed service uses: db.collection("quiz").document("dbms").collection("questions").document(question["id"])
    
    q_ref = (db.collection("quiz")
             .document("dbms") # Hardcoded to 'dbms' course for MVP as per seed logic
             .collection("questions")
             .document(question.id))
             
    await run_in_threadpool(q_ref.set, question.model_dump())
    return {"status": "created", "id": question.id}

@router.get("/{subtopic_id}")
async def get_questions_by_subtopic(subtopic_id: str, user_id: str | None = None, db = Depends(get_db)):
    # Query: quiz/dbms/questions where subtopic_id == X
    q_ref = (db.collection("quiz")
             .document("dbms")
             .collection("questions")
             .where(field_path="subtopic_id", op_string="==", value=subtopic_id))

    # Wrap blocking stream consumption
    docs = await run_in_threadpool(lambda: list(q_ref.stream()))
    all_questions = [d.to_dict() for d in docs]

    # Stable order: by id (deterministic). Then if more than 3, sample
    # deterministically per (user, subtopic) so the user sees the same
    # 3 questions on reload until they finish them.
    all_questions.sort(key=lambda q: q.get("id", ""))
    if len(all_questions) > 3:
        seed = f"{user_id or 'anon'}::{subtopic_id}"
        rng = random.Random(seed)
        return rng.sample(all_questions, 3)
    return all_questions

@router.post("/answer")
async def submit_answer(answer: AnswerSubmit, db = Depends(get_db)):
    # 0. Validate User
    user_ref = db.collection("users").document(answer.user_id)
    user_doc = await run_in_threadpool(user_ref.get)
    if not user_doc.exists:
         # raise HTTPException(status_code=404, detail="User not found")
         pass # Allow for now

    # 1. Check correctness
    # Fetch Question
    q_ref = (db.collection("quiz")
             .document("dbms")
             .collection("questions")
             .document(answer.question_id))
    
    q_doc = await run_in_threadpool(q_ref.get)
    if not q_doc.exists:
        raise HTTPException(status_code=404, detail="Question not found")
        
    question = q_doc.to_dict()
    is_correct = 1 if answer.selected_answer == question.get("correct_answer") else 0
    
    # 2. Save Answer
    # Save to users/{uid}/answers/{question_id} (or generic answers collection)
    ans_ref = (db.collection("users")
               .document(answer.user_id)
               .collection("answers")
               .document()) # Auto ID
               
    answer_data = {
        "user_id": answer.user_id,
        "question_id": answer.question_id,
        "selected_answer": answer.selected_answer,
        "is_correct": is_correct,
        "time_taken_ms": answer.time_taken_ms,
        "timestamp": firestore.SERVER_TIMESTAMP
    }
    await run_in_threadpool(ans_ref.set, answer_data)

    explanation = "Great job!"
    if not is_correct:
         try:
             # Generate dynamic explanation for wrong answer
             from services.genai_service import genai_service
             explanation = await genai_service.analyze_mistake(
                 question_text=question.get("text"),
                 selected_option=answer.selected_answer,
                 correct_option=question.get("correct_answer")
             ) or "Review the concept again."
         except Exception as e:
             explanation = "Review the concept again."
    
    return {
        "is_correct": bool(is_correct),
        "correct_answer": question.get("correct_answer") if not is_correct else None,
        "explanation": explanation
    }

@router.get("/hint/{question_id}/{level}")
async def get_hint(question_id: str, level: int, db = Depends(get_db)):
    """
    Get a specific level of hint for a question.
    If no static hint exists, generate one dynamically.
    """
    q_ref = (db.collection("quiz")
             .document("dbms")
             .collection("questions")
             .document(question_id))
    
    q_doc = await run_in_threadpool(q_ref.get)
    if not q_doc.exists:
        raise HTTPException(status_code=404, detail="Question not found")
        
    question = q_doc.to_dict()
    hints = question.get("hints", [])
    
    # 1. Try to get predefined hint
    if 0 <= level - 1 < len(hints):
        return {"hint": hints[level - 1], "type": "static"}
        
    # 2. Fallback to Dynamic GenAI Hint (Artemis 'Iris' style)
    try:
        q_text = question.get("text")
        correct_answer = question.get("correct_answer")
        
        # Level 1: Conceptual hint
        # Level 2: Logical hint
        # Level 3: Near-answer hint
        prompt = f"The student is stuck on this question: '{q_text}'. The correct answer is '{correct_answer}'. Provide a Level {level} hint (where 1 is conceptual and 3 is very specific). DO NOT give the answer directly."
        
        dynamic_hint = await genai_service.generate_hint(q_text, correct_answer, level)
        return {"hint": dynamic_hint, "type": "dynamic"}
    except Exception as e:
        logger.error(f"Error generating dynamic hint: {e}")
        return {"hint": "Think about the core properties of the concept mentioned.", "type": "fallback"}
