from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any

class UserBase(BaseModel):
    email: str
    role: str = "student"

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    model_config = ConfigDict(from_attributes=True)

class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None

class CourseCreate(CourseBase):
    id: str

class SubtopicSummary(BaseModel):
    id: str
    title: str
    model_config = ConfigDict(from_attributes=True)

class Unit(BaseModel):
    id: str
    title: str
    order: int
    subtopics: List[SubtopicSummary] = []
    model_config = ConfigDict(from_attributes=True)

class Course(CourseBase):
    id: str
    units: List[Unit] = []
    model_config = ConfigDict(from_attributes=True)

class UnitCreate(BaseModel):
    id: str
    title: str
    order: int

class SubtopicCreate(BaseModel):
    id: str
    title: str
    content: str
    references: str

class BehaviorLog(BaseModel):
    user_id: str
    event_type: str
    data: Dict[str, Any]
    timestamp: str

# --- SRS / Flashcard Schemas ---

class Flashcard(BaseModel):
    id: str
    question: str
    answer: str
    topic_id: str
    unit_id: Optional[str] = None
    course_id: Optional[str] = None

class FlashcardReview(BaseModel):
    answer: str # AGAIN, HARD, GOOD, EASY
    # Optional: arm whose explanation produced this card.
    # When supplied, the SRS review outcome also feeds the bandit
    # so LinUCB learns from long-term recall, not just quiz answers.
    recommended_arm: Optional[str] = None
    confusion_score: Optional[float] = None
    mastery: Optional[float] = None

class FlashcardProgress(BaseModel):
    id: str
    state: str
    interval: int
    ease_factor: float
    repetition: int
    step_index: int
    next_review_at: Any
    last_reviewed_at: Any
    card: Optional[Flashcard] = None
