"""
ML Inference Package

Provides inference wrappers for all trained models.
"""
from .confusion_infer import predict_confusion, confusion_service
from .profiler_infer import predict_profile, profiler_service
from .dkt_infer import predict_mastery, get_weak_skills, dkt_service
from .bandit_logic import select_explanation, update_bandit, get_available_arms, bandit

__all__ = [
    # Confusion
    "predict_confusion",
    "confusion_service",
    # Profiler
    "predict_profile", 
    "profiler_service",
    # DKT
    "predict_mastery",
    "get_weak_skills",
    "dkt_service",
    # Bandit
    "select_explanation",
    "update_bandit",
    "get_available_arms",
    "bandit"
]
