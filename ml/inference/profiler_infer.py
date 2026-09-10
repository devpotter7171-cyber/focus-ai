"""
ML Inference: Cognitive Profiler

Classifies users into learning style clusters based on aggregated behavior.
"""
import pickle
import os
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "profile_model.pkl")


class ProfilerInferenceService:
    """Service for classifying users into cognitive profiles."""
    
    # Profile labels mapped to cluster IDs
    PROFILE_LABELS = {
        0: "Skimmer",      # Fast, low engagement
        1: "Deep Reader",  # Slow, thorough
        2: "Balanced",     # Moderate pace
        3: "Struggler"     # High confusion, many retries
    }
    
    def __init__(self):
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the trained profiler model (KMeans or classifier)."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Profiler model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load profiler model: {e}")
        else:
            logger.warning(f"Profiler model not found at {MODEL_PATH}")
    
    def predict(self, user_behavior_summary: dict) -> dict:
        """
        Classify user into a cognitive profile.
        
        Args:
            user_behavior_summary: Aggregated stats for the user:
                - avg_time_per_question: float (seconds)
                - avg_hesitation: float (ms)
                - avg_tab_switches: float
                - avg_attempts: float
                - total_sessions: int
                - accuracy_rate: float (0-1)
        
        Returns:
            Dictionary with profile_id, profile_label, and confidence
        """
        if self.model is None:
            # Fallback heuristic
            avg_time = user_behavior_summary.get("avg_time_per_question", 30)
            accuracy = user_behavior_summary.get("accuracy_rate", 0.5)
            
            if avg_time < 15 and accuracy > 0.7:
                return {"profile_id": 0, "profile_label": "Skimmer", "confidence": 0.6}
            elif avg_time > 60:
                return {"profile_id": 1, "profile_label": "Deep Reader", "confidence": 0.6}
            elif accuracy < 0.4:
                return {"profile_id": 3, "profile_label": "Struggler", "confidence": 0.6}
            return {"profile_id": 2, "profile_label": "Balanced", "confidence": 0.6}
        
        try:
            features = pd.DataFrame([{
                "avg_time_per_page": user_behavior_summary.get("avg_time_per_question", 30),
                "scroll_speed": user_behavior_summary.get("avg_hesitation", 1000) / 100,  # Normalize
                "click_rate": user_behavior_summary.get("accuracy_rate", 0.5),
            }])
            
            cluster_id = int(self.model.predict(features)[0])
            label = self.PROFILE_LABELS.get(cluster_id, "Unknown")
            
            return {
                "profile_id": cluster_id,
                "profile_label": label,
                "confidence": 0.75  # Could compute from distance to centroid
            }
            
        except Exception as e:
            logger.error(f"Profiler inference error: {e}")
            return {"profile_id": 2, "profile_label": "Balanced", "confidence": 0.0}


# Singleton
profiler_service = ProfilerInferenceService()


def predict_profile(user_behavior_summary: dict) -> dict:
    """Convenience function for profile prediction."""
    return profiler_service.predict(user_behavior_summary)
