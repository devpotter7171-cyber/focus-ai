from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import get_db
from firebase_admin import firestore
import logging
import random

router = APIRouter()
logger = logging.getLogger(__name__)

# ============== Assessment Questions ==============
# 5 MCQ questions for DBMS domain (used for both pre and post test)

ASSESSMENT_QUESTIONS = [
    {
        "id": "q1",
        "question": "What does ACID stand for in database transactions?",
        "options": [
            "Atomicity, Consistency, Isolation, Durability",
            "Automatic, Consistent, Independent, Durable",
            "Atomicity, Concurrent, Isolated, Distributed",
            "Asynchronous, Consistent, Isolated, Durable"
        ],
        "correct": 0
    },
    {
        "id": "q2",
        "question": "Which normal form eliminates transitive dependencies?",
        "options": [
            "First Normal Form (1NF)",
            "Second Normal Form (2NF)",
            "Third Normal Form (3NF)",
            "Boyce-Codd Normal Form (BCNF)"
        ],
        "correct": 2
    },
    {
        "id": "q3",
        "question": "What is the primary purpose of an index in a database?",
        "options": [
            "To enforce data integrity",
            "To speed up data retrieval",
            "To normalize data",
            "To create relationships between tables"
        ],
        "correct": 1
    },
    {
        "id": "q4",
        "question": "Which SQL statement is used to remove a table from a database?",
        "options": [
            "DELETE TABLE",
            "REMOVE TABLE",
            "DROP TABLE",
            "TRUNCATE TABLE"
        ],
        "correct": 2
    },
    {
        "id": "q5",
        "question": "What type of relationship allows multiple records in one table to be associated with multiple records in another?",
        "options": [
            "One-to-One",
            "One-to-Many",
            "Many-to-Many",
            "Hierarchical"
        ],
        "correct": 2
    }
]

# ============== Request/Response Models ==============

class AssessmentQuestion(BaseModel):
    id: str
    question: str
    options: List[str]

class GetQuestionsResponse(BaseModel):
    test_type: str
    questions: List[AssessmentQuestion]

class SubmitAnswersRequest(BaseModel):
    user_id: str
    test_type: str  # "pre" or "post"
    group: str  # "control" or "adaptive"
    answers: List[int]  # List of selected option indices (in order of returned questions)
    question_ids: Optional[List[str]] = None  # List of question IDs in the same order as answers (optional for backward compatibility)

class SubmitAnswersResponse(BaseModel):
    score: int
    total: int
    percentage: float
    stored: bool

# ============== Endpoints ==============

@router.get("/questions/{test_type}", response_model=GetQuestionsResponse)
async def get_assessment_questions(test_type: str):
    """
    Get assessment questions for pre-test or post-test.
    Post-test questions are shuffled.
    """
    questions = ASSESSMENT_QUESTIONS.copy()
    
    if test_type == "post":
        random.shuffle(questions)
    
    # Return questions without correct answers
    safe_questions = [
        AssessmentQuestion(
            id=q["id"],
            question=q["question"],
            options=q["options"]
        )
        for q in questions
    ]
    
    return GetQuestionsResponse(
        test_type=test_type,
        questions=safe_questions
    )

@router.post("/submit", response_model=SubmitAnswersResponse)
async def submit_assessment(request: SubmitAnswersRequest, db = Depends(get_db)):
    """
    Submit assessment answers and store results.
    """
    # Calculate score by matching question IDs (if provided) or by index (backward compatibility)
    if request.question_ids and len(request.question_ids) == len(request.answers):
        # Use question ID matching (handles shuffled questions correctly)
        question_map = {q["id"]: q["correct"] for q in ASSESSMENT_QUESTIONS}
        score = 0
        for i, answer in enumerate(request.answers):
            question_id = request.question_ids[i]
            if question_id in question_map:
                if answer == question_map[question_id]:
                    score += 1
    else:
        # Fallback to index-based matching (for backward compatibility)
        # Note: This will fail if questions were shuffled for post-test
        score = 0
        for i, answer in enumerate(request.answers):
            if i < len(ASSESSMENT_QUESTIONS):
                if answer == ASSESSMENT_QUESTIONS[i]["correct"]:
                    score += 1
    
    total = len(ASSESSMENT_QUESTIONS)
    percentage = (score / total) * 100 if total > 0 else 0
    
    # Store in Firestore
    try:
        # Check if user already has an assessment record
        existing = db.collection("learning_assessment").where(
            "user_id", "==", request.user_id
        ).limit(1).stream()
        
        existing_doc = None
        for doc in existing:
            existing_doc = doc
            break
        
        if existing_doc:
            # Update existing record
            update_data = {
                f"{request.test_type}_score": score,
                f"{request.test_type}_percentage": percentage,
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            db.collection("learning_assessment").document(existing_doc.id).update(update_data)
            logger.info(f"Updated {request.test_type} score for user {request.user_id}")
        else:
            # Create new record
            doc_data = {
                "user_id": request.user_id,
                "group": request.group,
                "pre_score": score if request.test_type == "pre" else None,
                "post_score": score if request.test_type == "post" else None,
                "pre_percentage": percentage if request.test_type == "pre" else None,
                "post_percentage": percentage if request.test_type == "post" else None,
                "timestamp": firestore.SERVER_TIMESTAMP
            }
            db.collection("learning_assessment").add(doc_data)
            logger.info(f"Created assessment record for user {request.user_id}")
        
        stored = True
    except Exception as e:
        logger.error(f"Failed to store assessment: {e}")
        stored = False
    
    return SubmitAnswersResponse(
        score=score,
        total=total,
        percentage=percentage,
        stored=stored
    )

@router.get("/results/{user_id}")
async def get_assessment_results(user_id: str, db = Depends(get_db)):
    """
    Get assessment results for a user.
    """
    try:
        docs = db.collection("learning_assessment").where(
            "user_id", "==", user_id
        ).limit(1).stream()
        
        for doc in docs:
            data = doc.to_dict()
            return {
                "user_id": user_id,
                "group": data.get("group"),
                "pre_score": data.get("pre_score"),
                "post_score": data.get("post_score"),
                "learning_gain": (data.get("post_score") or 0) - (data.get("pre_score") or 0),
                "timestamp": str(data.get("timestamp"))
            }
        
        return {"user_id": user_id, "message": "No assessment found"}
    except Exception as e:
        logger.error(f"Failed to fetch results: {e}")
        return {"error": str(e)}
