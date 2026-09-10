from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class BKTService:
    """
    Bayesian Knowledge Tracing (BKT) Service.
    Used to estimate the probability that a student has mastered a specific skill/subtopic.
    Standard algorithm used in Intelligent Tutoring Systems (e.g., OATutor, Cognitive Tutor).
    """

    # Standard BKT Defaults (can be tuned per subtopic)
    DEFAULT_PRIOR = 0.3     # P(L0): Initial probability of mastery
    DEFAULT_TRANSIT = 0.1   # P(T): Probability of learning after an attempt
    DEFAULT_SLIP = 0.1      # P(S): Probability of a slip (knowing but failing)
    DEFAULT_GUESS = 0.2     # P(G): Probability of a guess (not knowing but succeeding)

    @staticmethod
    def update_mastery(
        current_p_mastery: float,
        is_correct: bool,
        p_transit: float = DEFAULT_TRANSIT,
        p_slip: float = DEFAULT_SLIP,
        p_guess: float = DEFAULT_GUESS
    ) -> float:
        """
        Updates the mastery probability based on a student's attempt.
        
        Formula:
        1. Calculate P(L | Result) using Bayes' Theorem
        2. Account for Transition P(T) (learning that happened during the attempt)
        """
        p_l = current_p_mastery
        
        # 1. Calculate Posterior Probability P(L | Result)
        if is_correct:
            # P(L | Correct) = (P(L) * (1 - P(S))) / (P(L) * (1 - P(S)) + (1 - P(L)) * P(G))
            p_l_given_result = (p_l * (1 - p_slip)) / (p_l * (1 - p_slip) + (1 - p_l) * p_guess)
        else:
            # P(L | Incorrect) = (P(L) * P(S)) / (P(L) * P(S) + (1 - P(L)) * (1 - P(G)))
            p_l_given_result = (p_l * p_slip) / (p_l * p_slip + (1 - p_l) * (1 - p_guess))
            
        # 2. Account for learning (Transition)
        # P(L_new) = P(L | Result) + (1 - P(L | Result)) * P(T)
        p_l_new = p_l_given_result + (1 - p_l_given_result) * p_transit
        
        return round(p_l_new, 4)

    @staticmethod
    def get_initial_state() -> Dict:
        """Returns the default BKT state for a new skill."""
        return {
            "p_mastery": BKTService.DEFAULT_PRIOR,
            "p_transit": BKTService.DEFAULT_TRANSIT,
            "p_slip": BKTService.DEFAULT_SLIP,
            "p_guess": BKTService.DEFAULT_GUESS,
            "last_updated": datetime.utcnow().isoformat(),
            "attempts": 0
        }

# Singleton instance
bkt_service = BKTService()
