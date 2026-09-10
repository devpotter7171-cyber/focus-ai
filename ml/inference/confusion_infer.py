"""
ML Inference: Confusion Detection

Wrapper for loading and running the trained confusion detection model.
"""
import pickle
import os
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "confusion_model.pkl")


class ConfusionInferenceService:
    """Service for predicting confusion probability from behavioral features."""
    
    def __init__(self):
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the trained XGBoost confusion model."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Confusion model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load confusion model: {e}")
        else:
            logger.warning(f"Confusion model not found at {MODEL_PATH}")
    
    def predict(self, behavior_data: dict) -> float:
        """
        Predict confusion probability from behavioral signals.
        
        Args:
            behavior_data: Dictionary containing:
                - time_on_question_ms: int
                - hesitation_ms: int
                - tab_switches: int
                - scroll_depth_pct: float (0-100)
                - attempts: int
                - hint_requests: int
        
        Returns:
            Confusion probability (0.0 to 1.0)
        """
        if self.model is None:
            # Fallback heuristic when no model available
            hesitation = behavior_data.get("hesitation_ms", 0)
            tab_switches = behavior_data.get("tab_switches", 0)
            
            # Simple rule-based fallback
            # Tweaked: Increased thresholds to account for reading time (5s moderate, 10s high)
            if hesitation > 10000 or tab_switches > 3:
                return 0.85
            elif hesitation > 5000 or tab_switches > 1:
                return 0.45
            return 0.15
        
        try:
            # Prepare features for model
            features = pd.DataFrame([{
                "hesitation_time": behavior_data.get("hesitation_ms", 0),
                "tab_switches": behavior_data.get("tab_switches", 0),
                "scroll_depth": behavior_data.get("scroll_depth_pct", 0),
            }])
            
            # Get probability of confusion (class 1)
            proba = self.model.predict_proba(features)[0][1]
            return float(proba)
            
        except Exception as e:
            logger.error(f"Confusion inference error: {e}")
            # Fallback to heuristic when model prediction fails
            hesitation = behavior_data.get("hesitation_ms", 0)
            tab_switches = behavior_data.get("tab_switches", 0)
            
            # Simple rule-based fallback
            if hesitation > 5000 or tab_switches > 3:
                return 0.85
            elif hesitation > 2000 or tab_switches > 1:
                return 0.45
            return 0.15
    
    def get_feature_importance(self) -> dict:
        """Return feature importance from the model."""
        if self.model is None:
            return {}
        
        try:
            importance = self.model.feature_importances_
            # Model only uses 3 features: hesitation_time, tab_switches, scroll_depth
            features = ["hesitation_time", "tab_switches", "scroll_depth"]
            return dict(zip(features, importance.tolist()))
        except Exception:
            return {}


# Singleton instance
confusion_service = ConfusionInferenceService()


def predict_confusion(behavior_data: dict) -> float:
    """Convenience function for confusion prediction."""
    return confusion_service.predict(behavior_data)
