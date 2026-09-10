from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Firebase UID
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True) # Added for profile sync
    role = Column(String, default="student")
    profile_segment = Column(String, nullable=True)  # e.g., "Skimmer", "Reader"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    description = Column(String, nullable=True)
    
    units = relationship("Unit", back_populates="course", cascade="all, delete-orphan")

class Unit(Base):
    __tablename__ = "units"

    id = Column(String, primary_key=True, index=True)
    course_id = Column(String, ForeignKey("courses.id"), index=True)
    title = Column(String)
    order = Column(Integer)
    
    course = relationship("Course", back_populates="units")
    subtopics = relationship("Subtopic", back_populates="unit", cascade="all, delete-orphan")

class Subtopic(Base):
    __tablename__ = "subtopics"

    id = Column(String, primary_key=True, index=True)
    unit_id = Column(String, ForeignKey("units.id"), index=True)
    title = Column(String)
    content = Column(Text) # Markdown content
    references = Column(String)
    
    unit = relationship("Unit", back_populates="subtopics")
    questions = relationship("Question", back_populates="subtopic", cascade="all, delete-orphan")

class BehaviorLog(Base):
    __tablename__ = "behavior_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=True) # FK Added
    event_type = Column(String)
    data = Column(JSON)  # Stores hesitation, scroll depth, etc.
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, index=True)
    subtopic_id = Column(String, ForeignKey("subtopics.id"), index=True)
    text = Column(Text)
    options = Column(JSON) # List of strings
    correct_answer = Column(String)
    difficulty = Column(Float, default=0.5)
    
    subtopic = relationship("Subtopic", back_populates="questions")

class UserAnswer(Base):
    __tablename__ = "user_answers"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(String, index=True, nullable=True)
    unit_id = Column(String, index=True, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=True) # FK Added
    subtopic_id = Column(String, index=True, nullable=True)
    question_id = Column(String, index=True, nullable=True)
    selected_answer = Column(String)
    is_correct = Column(Integer)  # 0 or 1
    time_taken_ms = Column(Integer)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class InterventionLog(Base):
    """
    Logs every adaptive intervention for analytics.
    
    This table is critical for:
    - A/B experiment analysis
    - Bandit reward computation
    - Learning gain correlation studies
    - Confusion vs intervention effectiveness reporting
    """
    __tablename__ = "intervention_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=True) # FK Added
    subtopic = Column(String, index=True)
    
    # Confusion state at intervention time
    confusion_score = Column(Float)

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True) # FK Added
    course_id = Column(String, index=True, nullable=True)
    unit_id = Column(String, index=True, nullable=True)
    subtopic_id = Column(String, index=True)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Bandit decision
    bandit_arm_selected = Column(String)  # visual, step, example, analogy, easier, harder
    arm_confidence = Column(Float)
    all_arm_scores = Column(JSON)  # Full transparency of bandit state
    
    # Reasoning
    reason = Column(Text)
    
    # Outcome tracking (filled after user response)
    answer_correct = Column(Integer, nullable=True)  # 0 or 1, filled later
    time_to_answer_ms = Column(Integer, nullable=True)
    post_confusion_score = Column(Float, nullable=True)  # Did confusion reduce?
    
    # Experiment tracking
    experiment_id = Column(String, nullable=True, index=True)  # For A/B tests
    is_control_group = Column(Integer, nullable=True)  # 0 = adaptive, 1 = control
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class UserFeedback(Base):
    """
    Ground truth labels for confusion detection validation.
    """
    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    
    # Context
    session_id = Column(String, nullable=True)
    subtopic_id = Column(String, nullable=True)
    
    # Feedback
    is_confused = Column(Integer)  # 1=Yes, 0=No
    feedback_text = Column(String, nullable=True)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


