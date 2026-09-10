import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum

class FlashcardState(str, Enum):
    NEW = "NEW"
    LEARNING = "LEARNING"
    REVIEW = "REVIEW"
    RELEARNING = "RELEARNING"
    MASTERED = "MASTERED"

class ReviewAnswer(str, Enum):
    AGAIN = "AGAIN"   # Score 0 (Complete failure)
    HARD = "HARD"    # Score 1 (Correct, but difficult)
    GOOD = "GOOD"    # Score 2 (Correct, comfortable)
    EASY = "EASY"    # Score 3 (Correct, very easy)

class SRSService:
    """
    Spaced Repetition System (SRS) implementing the SM-2 algorithm.
    Adapted for Python from BrainStack's implementation.
    """
    
    # Defaults
    DEFAULT_EASE = 2.5
    MIN_EASE = 1.3
    MASTERED_THRESHOLD = 21 # days
    LEARNING_STEPS = [1, 10] # minutes
    RELEARNING_STEPS = [10]   # minutes
    GRADUATING_INTERVAL = 1 # day
    EASY_INTERVAL = 4       # days

    @staticmethod
    def calculate_next_review(
        current_state: str,
        interval: int,
        ease_factor: float,
        repetition: int,
        step_index: int,
        answer: ReviewAnswer,
        now: datetime = None
    ) -> Dict:
        """
        Calculates the next state of a flashcard using the SM-2 algorithm.
        Returns a dictionary with updated SRS fields.
        """
        if now is None:
            now = datetime.utcnow()

        state = FlashcardState(current_state)
        next_review_at = now
        
        # 1. NEW / LEARNING Phase (Minute-based)
        if state == FlashcardState.NEW or state == FlashcardState.LEARNING:
            state = FlashcardState.LEARNING
            
            if answer == ReviewAnswer.AGAIN:
                step_index = 0
                next_review_at = now + timedelta(minutes=SRSService.LEARNING_STEPS[0])
            
            elif answer == ReviewAnswer.HARD:
                # Stay on step but wait 50% longer
                wait_time = SRSService.LEARNING_STEPS[step_index] * 1.5
                next_review_at = now + timedelta(minutes=wait_time)
                
            elif answer == ReviewAnswer.GOOD:
                step_index += 1
                if step_index >= len(SRSService.LEARNING_STEPS):
                    # Graduate to REVIEW
                    state = FlashcardState.REVIEW
                    interval = SRSService.GRADUATING_INTERVAL
                    repetition = 1
                    step_index = 0
                    next_review_at = now + timedelta(days=interval)
                else:
                    next_review_at = now + timedelta(minutes=SRSService.LEARNING_STEPS[step_index])
                    
            elif answer == ReviewAnswer.EASY:
                # Graduate immediately
                state = FlashcardState.REVIEW
                interval = SRSService.EASY_INTERVAL
                repetition = 1
                step_index = 0
                ease_factor = max(SRSService.MIN_EASE, ease_factor + 0.15)
                next_review_at = now + timedelta(days=interval)

        # 2. RELEARNING Phase (Back from REVIEW failure)
        elif state == FlashcardState.RELEARNING:
            if answer == ReviewAnswer.AGAIN:
                step_index = 0
                next_review_at = now + timedelta(minutes=SRSService.RELEARNING_STEPS[0])
            
            elif answer == ReviewAnswer.HARD:
                wait_time = SRSService.RELEARNING_STEPS[step_index] * 1.5
                next_review_at = now + timedelta(minutes=wait_time)
                
            elif answer == ReviewAnswer.GOOD:
                step_index += 1
                if step_index >= len(SRSService.RELEARNING_STEPS):
                    state = FlashcardState.REVIEW
                    repetition += 1
                    step_index = 0
                    next_review_at = now + timedelta(days=interval)
                else:
                    next_review_at = now + timedelta(minutes=SRSService.RELEARNING_STEPS[step_index])
            
            elif answer == ReviewAnswer.EASY:
                state = FlashcardState.REVIEW
                step_index = 0
                interval = max(interval + 1, SRSService.EASY_INTERVAL)
                repetition += 1
                ease_factor = max(SRSService.MIN_EASE, ease_factor + 0.15)
                next_review_at = now + timedelta(days=interval)

        # 3. REVIEW / MASTERED Phase (Day-based)
        else:
            if answer == ReviewAnswer.AGAIN:
                state = FlashcardState.RELEARNING
                step_index = 0
                ease_factor = max(SRSService.MIN_EASE, ease_factor - 0.2)
                next_review_at = now + timedelta(minutes=SRSService.RELEARNING_STEPS[0])
                
            elif answer == ReviewAnswer.HARD:
                interval = max(interval + 1, round(interval * 1.2))
                ease_factor = max(SRSService.MIN_EASE, ease_factor - 0.15)
                repetition += 1
                next_review_at = now + timedelta(days=interval)
                
            elif answer == ReviewAnswer.GOOD:
                interval = max(interval + 1, round(interval * ease_factor))
                repetition += 1
                next_review_at = now + timedelta(days=interval)
                
            elif answer == ReviewAnswer.EASY:
                interval = max(interval + 1, round(interval * ease_factor * 1.3))
                ease_factor = max(SRSService.MIN_EASE, ease_factor + 0.15)
                repetition += 1
                next_review_at = now + timedelta(days=interval)

        # Update MASTERED status
        if state in [FlashcardState.REVIEW, FlashcardState.MASTERED] and interval >= SRSService.MASTERED_THRESHOLD:
            state = FlashcardState.MASTERED

        return {
            "state": state.value,
            "interval": int(interval),
            "ease_factor": float(ease_factor),
            "repetition": int(repetition),
            "step_index": int(step_index),
            "next_review_at": next_review_at,
            "last_reviewed_at": now
        }

    @staticmethod
    def spawn_card(
        db,
        user_id: str,
        topic_id: str,
        question: str,
        answer: str,
        course_id: str = None,
        unit_id: str = None,
        recommended_arm: str = None,
        confusion_score: float = None,
        mastery: float = None,
    ) -> str:
        """
        Spawns a new flashcard for a user.

        ``recommended_arm`` / ``confusion_score`` / ``mastery`` are
        optional but enable the SRS review loop to feed long-term
        retention signal back into LinUCB. Stored on the per-user
        progress document (not the global card) because the arm
        depends on the original learner context.
        """
        import hashlib
        card_slug = hashlib.md5(f"{topic_id}_{question}".encode()).hexdigest()[:12]
        
        # 1. Ensure global card exists
        card_ref = db.collection("flashcards").document(card_slug)
        if not card_ref.get().exists:
            card_ref.set({
                "question": question,
                "answer": answer,
                "topic_id": topic_id,
                "unit_id": unit_id,
                "course_id": course_id,
                "created_at": datetime.utcnow()
            })
            
        # 2. Link to user
        prog_ref = db.collection("users").document(user_id).collection("flashcard_progress").document(card_slug)
        if not prog_ref.get().exists:
            doc = {
                "card_id": card_slug,
                "state": FlashcardState.NEW.value,
                "interval": 0,
                "ease_factor": SRSService.DEFAULT_EASE,
                "repetition": 0,
                "step_index": 0,
                "next_review_at": datetime.utcnow(),
                "last_reviewed_at": None,
            }
            if recommended_arm:
                doc["recommended_arm"] = recommended_arm
            if confusion_score is not None:
                doc["spawn_confusion_score"] = float(confusion_score)
            if mastery is not None:
                doc["spawn_mastery"] = float(mastery)
            prog_ref.set(doc)
            
        return card_slug

# Singleton instance
srs_service = SRSService()
