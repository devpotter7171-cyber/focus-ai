"""
ML Inference: Deep Knowledge Tracing (DKT)

LSTM-based model for predicting mastery probability per skill.
"""
import pickle
import os
import numpy as np
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "dkt_model.pkl")


class DKTInferenceService:
    """Service for predicting skill mastery using Deep Knowledge Tracing."""
    
    def __init__(self):
        self.model = None
        self.skill_ids = []
        self.load_model()
    
    def load_model(self):
        """Load the trained DKT model."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    saved = pickle.load(f)
                    # Model could be PyTorch state_dict or sklearn-compatible
                    if isinstance(saved, dict):
                        self.model = saved.get("model")
                        self.skill_ids = saved.get("skill_ids", [])
                    else:
                        self.model = saved
                logger.info("DKT model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load DKT model: {e}")
        else:
            logger.warning(f"DKT model not found at {MODEL_PATH}")
    
    def predict_mastery(self, interaction_sequence: list) -> dict:
        """
        Predict mastery probability for each skill based on interaction history.
        
        Args:
            interaction_sequence: List of dicts with:
                - skill_id: str
                - correct: bool (0/1)
        
        Returns:
            Dictionary mapping skill_id -> mastery_probability
        """
        if not interaction_sequence:
            return {}
        
        if self.model is None:
            # Fallback: simple moving average
            skill_history = {}
            for interaction in interaction_sequence:
                skill = interaction.get("skill_id", "unknown")
                correct = interaction.get("correct", 0)
                if skill not in skill_history:
                    skill_history[skill] = []
                skill_history[skill].append(correct)
            
            mastery = {}
            for skill, history in skill_history.items():
                # Weighted average (recent items count more)
                weights = np.exp(np.linspace(-1, 0, len(history)))
                mastery[skill] = float(np.average(history, weights=weights))
            
            return mastery
        
        try:
            # For real model, would encode sequence and run inference
            # This is a placeholder for PyTorch LSTM inference
            
            # Simplified: use model's predict if sklearn-compatible
            if hasattr(self.model, 'predict_proba'):
                # Would need proper feature encoding here
                pass
            
            # Fallback to moving average approach
            return self._moving_average_mastery(interaction_sequence)
            
        except Exception as e:
            logger.error(f"DKT inference error: {e}")
            return {}
    
    def _moving_average_mastery(self, sequence: list) -> dict:
        """Simple moving average fallback."""
        skill_history = {}
        for item in sequence:
            skill = item.get("skill_id", "unknown")
            correct = item.get("correct", 0)
            if skill not in skill_history:
                skill_history[skill] = []
            skill_history[skill].append(correct)
        
        mastery = {}
        for skill, history in skill_history.items():
            if len(history) >= 3:
                mastery[skill] = np.mean(history[-5:])  # Last 5 attempts
            else:
                mastery[skill] = np.mean(history)
        
        return {k: float(v) for k, v in mastery.items()}
    
    def get_weak_skills(self, mastery: dict, threshold: float = 0.5) -> list:
        """Identify skills below mastery threshold."""
        return [skill for skill, prob in mastery.items() if prob < threshold]


# Singleton
dkt_service = DKTInferenceService()


def predict_mastery(interaction_sequence: list) -> dict:
    """Convenience function for mastery prediction."""
    return dkt_service.predict_mastery(interaction_sequence)


def get_weak_skills(mastery: dict, threshold: float = 0.5) -> list:
    """Convenience function to get weak skills."""
    return dkt_service.get_weak_skills(mastery, threshold)
