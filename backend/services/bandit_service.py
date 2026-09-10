"""
Backend Service: Bandit Service

Wrapper for the LinUCB contextual bandit for content recommendation.
"""
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Add ML directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "ml"))


class BanditService:
    """
    Service layer for bandit-based content recommendations.
    
    Wraps the ML bandit logic and provides a clean interface for the API.
    """
    
    # Available explanation types (arms)
    EXPLANATION_TYPES = [
        "visual",      # Visual diagrams and infographics
        "step",        # Step-by-step walkthrough
        "example",     # Concrete examples
        "analogy",     # Real-world analogies
        "easier",      # Simpler version of content
        "harder"       # More challenging version
    ]
    
    def __init__(self):
        self.bandit = None
        self._load_bandit()
    
    def _load_bandit(self):
        """Load the bandit model from ML module."""
        try:
            from inference.bandit_logic import bandit
            self.bandit = bandit
            logger.info("Bandit service initialized.")
        except ImportError as e:
            logger.warning(f"Could not load bandit model: {e}")
    
    def get_recommendation(self, user_id: str, confusion_score: float = 0.5,
                          mastery: float = 0.5, learning_style: str = "Balanced") -> dict:
        """
        Get content recommendation for a user.
        
        Args:
            user_id: User identifier
            confusion_score: Current confusion level (0-1)
            mastery: Average mastery across skills (0-1)
            learning_style: One of "Skimmer", "Deep Reader", "Balanced"
        
        Returns:
            Dictionary with recommendation details
        """
        context = {
            "user_id": user_id,
            "confusion_score": confusion_score,
            "avg_mastery": mastery,
            "learning_style": learning_style,
            "time_on_question_norm": 0.5
        }
        
        if self.bandit:
            try:
                result = self.bandit.select_arm(context)
                return {
                    "explanation_type": result["arm_name"],
                    "arm_id": result["arm_id"],
                    "confidence": result["ucb_score"],
                    "reason": result["reason"]
                }
            except Exception as e:
                logger.error(f"Bandit selection failed: {e}")
        
        # Fallback: heuristic-based selection
        return self._heuristic_recommendation(confusion_score, mastery)
    
    def _heuristic_recommendation(self, confusion: float, mastery: float) -> dict:
        """Fallback recommendation using simple heuristics."""
        if confusion > 0.7:
            # High confusion -> simplify
            explanation = "easier"
            reason = "High confusion detected, simplifying content"
        elif confusion > 0.5:
            # Moderate confusion -> visual aids
            explanation = "visual"
            reason = "Moderate confusion, using visual explanation"
        elif mastery > 0.8:
            # High mastery -> challenge
            explanation = "harder"
            reason = "High mastery, increasing difficulty"
        elif mastery < 0.4:
            # Low mastery -> step by step
            explanation = "step"
            reason = "Low mastery, using step-by-step approach"
        else:
            # Default -> examples
            explanation = "example"
            reason = "Balanced state, providing examples"
        
        return {
            "explanation_type": explanation,
            "arm_id": self.EXPLANATION_TYPES.index(explanation),
            "confidence": 0.6,
            "reason": f"[Heuristic] {reason}"
        }
    
    def update_reward(self, user_id: str, arm_id: int, reward: float,
                     confusion_score: float = 0.5, mastery: float = 0.5):
        """
        Update bandit with observed reward.
        
        Called after user interaction to improve future recommendations.
        
        Args:
            user_id: User identifier
            arm_id: Index of the arm that was selected
            reward: Observed reward (0 = incorrect/slow, 1 = correct/fast)
            confusion_score: Confusion at time of selection
            mastery: Mastery at time of selection
        """
        if self.bandit:
            try:
                from inference.bandit_logic import update_bandit
                context = {
                    "user_id": user_id,
                    "confusion_score": confusion_score,
                    "avg_mastery": mastery,
                    "learning_style": "Balanced"
                }
                update_bandit(arm_id, context, reward)
                logger.debug(f"Bandit updated: arm={arm_id}, reward={reward}")
            except Exception as e:
                logger.error(f"Bandit update failed: {e}")
    
    def get_arm_statistics(self) -> dict:
        """Get statistics about each arm's performance."""
        if not self.bandit:
            return {}
        
        stats = {}
        for i, arm_name in enumerate(self.EXPLANATION_TYPES):
            try:
                # Estimate theta for each arm
                import numpy as np
                A_inv = np.linalg.inv(self.bandit.A[i])
                theta = A_inv.dot(self.bandit.b[i])
                stats[arm_name] = {
                    "arm_id": i,
                    "estimated_value": float(theta.mean()),
                    "samples": int(np.trace(self.bandit.A[i]) - self.bandit.n_features)
                }
            except Exception:
                stats[arm_name] = {"arm_id": i, "estimated_value": 0, "samples": 0}
        
        return stats


# Singleton instance
bandit_service = BanditService()


def get_recommendation(user_id: str, **kwargs) -> dict:
    """Convenience function for getting recommendations."""
    return bandit_service.get_recommendation(user_id, **kwargs)
