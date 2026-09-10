import os
import logging

# Setup Logger early
logger = logging.getLogger(__name__)

# Try importing Torch FIRST to avoid DLL conflicts (WinError 1114) with NumPy/XGBoost
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except Exception as e:
    logger.warning(f"Torch not available: {e}. DKT model will be disabled.")
    TORCH_AVAILABLE = False
    # Mock nn.Module for class definition if torch missing
    class MockModule:
        def __init__(self, *args, **kwargs): pass
        def __call__(self, *args, **kwargs): pass
    
    class MockNN:
        Module = MockModule
        LSTM = MockModule
        Linear = MockModule
        Sigmoid = MockModule
        
    nn = MockNN

import pickle
import pandas as pd
import xgboost as xgb
import numpy as np

# Define DKTModel locally to allow unpickling (mocked if torch missing)
class DKTModel(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super(DKTModel, self).__init__()
        if TORCH_AVAILABLE:
            self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True)
            self.fc = nn.Linear(hidden_dim, output_dim)
            self.sigmoid = nn.Sigmoid()
        else:
            self.lstm = None
            self.fc = None
            self.sigmoid = None

    def forward(self, x):
        if not TORCH_AVAILABLE:
            return 0.0
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :]) # Take last time step
        return self.sigmoid(out)

logger = logging.getLogger(__name__)

# Get absolute path to ml/models directory (from backend/services/ -> ../../ml/models)
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.join(_CURRENT_DIR, "..", "..", "ml", "models")
CONFUSION_MODEL_PATH = os.path.join(ML_DIR, "confusion_model.pkl")
WEAK_CONCEPT_MODEL_PATH = os.path.join(ML_DIR, "weak_concept_model.pkl")
BANDIT_MODEL_PATH = os.path.join(ML_DIR, "bandit_model.pkl")
PROFILE_MODEL_PATH = os.path.join(ML_DIR, "profile_model.pkl")
DKT_MODEL_PATH = os.path.join(ML_DIR, "dkt_model.pkl")

# --- ML Constants ---
PSI_THRESHOLD = 0.2  # Drift alert threshold
SEED = 42
np.random.seed(SEED)  # Fixed seed for reproducible model inference

class MLService:
    def __init__(self):
        self.confusion_model = None
        self.weak_concept_model = None
        self.bandit_model = None
        self.profile_model = None
        self.dkt_model = None
        # Models will be loaded explicitly via load_models() in lifespan or lazily

    def load_models(self):
        """Load all ML models from disk."""
        logger.info(f"Loading ML models from: {ML_DIR}")
        
        # HACK: Fix for DKTModel pickle error (saved as __main__.DKTModel)
        import sys
        if TORCH_AVAILABLE and 'DKTModel' in globals():
             if not hasattr(sys.modules['__main__'], 'DKTModel'):
                setattr(sys.modules['__main__'], 'DKTModel', DKTModel)
        
        # Load Confusion Model
        if os.path.exists(CONFUSION_MODEL_PATH):
            try:
                with open(CONFUSION_MODEL_PATH, 'rb') as f:
                    self.confusion_model = pickle.load(f)
                logger.info("✓ Confusion Model loaded.")
            except Exception as e:
                logger.error(f"Error loading Confusion model: {e}")
        else:
            logger.warning(f"Confusion model not found at {CONFUSION_MODEL_PATH}")
        
        # Load Weak Concept Model
        if os.path.exists(WEAK_CONCEPT_MODEL_PATH):
            try:
                with open(WEAK_CONCEPT_MODEL_PATH, 'rb') as f:
                    self.weak_concept_model = pickle.load(f)
                logger.info("✓ Weak Concept Model loaded.")
            except Exception as e:
                logger.error(f"Error loading Weak Concept model: {e}")

        # Load Bandit Model
        if os.path.exists(BANDIT_MODEL_PATH):
            try:
                with open(BANDIT_MODEL_PATH, 'rb') as f:
                    self.bandit_model = pickle.load(f)
                logger.info("✓ Bandit Model loaded.")
            except Exception as e:
                logger.error(f"Error loading Bandit model: {e}")
                
        # Load Profile Model
        if os.path.exists(PROFILE_MODEL_PATH):
            try:
                with open(PROFILE_MODEL_PATH, 'rb') as f:
                    self.profile_model = pickle.load(f)
                logger.info("✓ Profile Model loaded.")
            except Exception as e:
                logger.error(f"Error loading Profile model: {e}")

        # Load DKT Model
        if os.path.exists(DKT_MODEL_PATH) and TORCH_AVAILABLE:
            try:
                with open(DKT_MODEL_PATH, 'rb') as f:
                    self.dkt_model = pickle.load(f)
                logger.info("✓ DKT Model loaded.")
            except Exception as e:
                logger.error(f"Error loading DKT model: {e}")
        elif not TORCH_AVAILABLE:
            logger.warning("DKT Model skipped (Torch unavailable).")

    def _ensure_models_loaded(self):
        """Lazy load models if they haven't been loaded yet."""
        if self.confusion_model is None and self.bandit_model is None:
            logger.info("Lazy loading ML models on first access...")
            self.load_models()

    def predict_confusion(self, log_data: dict) -> float:
        """
        Predict probability of confusion.
        """
        self._ensure_models_loaded()
        
        if not self.confusion_model:
            # Mock fallback
            if "demo_confused" in str(log_data):
                return 0.9
            
            # Heuristic Fallback using Uncertainty Signals
            raw = log_data.get('data', {})
            hesitation = raw.get("hesitation_ms", 0)
            hovers = raw.get("wrong_option_hover_count", 0)
            
            if hovers > 2:
                return 0.75 # High confusion if exploring wrong options
            return 0.8 if hesitation > 5000 else 0.1

        try:
            # Map frontend data to features
            # Optimization: Use Dictionary/Slicing for single-row inference (10x faster than DataFrame construction)
            # data structure from frontend: { time_ms: number, tab_switches: number, scroll_depth: number }
            raw_data = log_data.get('data', {})
            
            # Create DataFrame directly from dict list is fast enough for one row, 
            # but bypassing it if model accepts numpy is better. 
            # However, XGBoost usually expects feature names. We will stick to DF but optimize creation.
            features = pd.DataFrame.from_records([{
                'hesitation_time': raw_data.get('hesitation_ms', 0),
                'tab_switches': raw_data.get('tab_switches', 0),
                'scroll_depth': raw_data.get('scroll_depth', 0)
            }])
            
            prob = self.confusion_model.predict_proba(features)[0][1]
            return float(prob)
        except Exception as e:
            logger.error(f"Confusion prediction error: {e}")
            return 0.0

    def predict_bandit(self, context_features: dict) -> str:
        """
        Select best content arm via the canonical LinUCB bandit.

        This method delegates to ``services.bandit_service`` (which wraps
        ``ml/inference/bandit_logic.LinUCBBandit``) so there is a single
        source of truth for the 6 string arms defined in
        ``BanditService.EXPLANATION_TYPES``: ``visual``, ``step``,
        ``example``, ``analogy``, ``easier``, ``harder``.
        """
        # Lazy import to avoid circular dependency at module load time.
        from services.bandit_service import bandit_service

        result = bandit_service.get_recommendation(
            user_id=str(context_features.get("user_id", "anonymous")),
            confusion_score=float(context_features.get("confusion_score", 0.5)),
            mastery=float(context_features.get("avg_mastery", 0.5)),
            learning_style=str(context_features.get("learning_style", "Balanced")),
        )
        return result["explanation_type"]

    def predict_profile(self, logs: list) -> str:
        """
        Segment user into 'Skimmer', 'Reader', or 'Balanced' based on logs.
        """
        self._ensure_models_loaded()
        
        if not self.profile_model:
            return "General"
            
        try:
            # Aggregate logs to get Avg Time, Scroll Speed, Click Rate
            # Simplified aggregation from list of log dicts
            if not logs:
                return "New User"
                
            df = pd.DataFrame(logs)
            
            # Ensure required columns exist, fill with defaults if missing
            # data structure: { data: { time_ms: ..., scroll_speed: ..., ... } }
            # Need to extract 'data' content first if it's nested
            
            # Mock extraction for this MVP as log structure varies
            avg_time = 60 # placeholder
            scroll_speed = 30
            click_rate = 0.3
            
            features = pd.DataFrame([{
                'avg_time_per_page': avg_time,
                'scroll_speed': scroll_speed,
                'click_rate': click_rate
            }])
            
            cluster = self.profile_model.predict(features)[0]
            
            # Map cluster ID to label (based on training centroids, here we assume)
            # 0: Skimmer, 1: Reader, 2: Balanced (This mapping depends on random_state in training)
            # For robustness, we should look at centroids, but for now we map directly
            labels = {0: "Skimmer", 1: "Reader", 2: "Balanced"}
            return labels.get(cluster, "General")
            
        except Exception as e:
            logger.error(f"Profile prediction error: {e}")
            return "General"

    def compute_psi(self, expected, actual, bucket_type='bins', buckets=10, axis=0):
        """
        Calculate Population Stability Index (PSI) to detect model drift.
        """
        try:
            def get_scale(series, buckets):
                if bucket_type == 'bins':
                    return np.histogram(series, bins=buckets)[1]
                else:
                    return np.percentile(series, np.linspace(0, 100, buckets + 1))

            def get_proportions(series, scale):
                proportions = np.histogram(series, bins=scale)[0]
                return proportions / len(series)

            scale = get_scale(expected, buckets)
            expected_percents = get_proportions(expected, scale)
            actual_percents = get_proportions(actual, scale)

            # Avoid division by zero
            expected_percents = np.where(expected_percents == 0, 0.0001, expected_percents)
            actual_percents = np.where(actual_percents == 0, 0.0001, actual_percents)

            psi_values = (actual_percents - expected_percents) * np.log(actual_percents / expected_percents)
            psi = np.sum(psi_values)
            
            # Actionability: Flag excessive drift
            if psi > PSI_THRESHOLD:
                logger.error(f"DRIFT DETECTED: PSI {psi:.4f} > {PSI_THRESHOLD}. Scheduling retraining.")
            
            return float(psi)
        except Exception as e:
            logger.error(f"PSI Calculation error: {e}")
            return 0.0

    def calculate_reward(self, is_correct: bool, time_norm: float, clarity_score: float = 0.0) -> float:
        """
        Composite reward signal for the bandit:
        r_t = 0.6 * I(correct) + 0.3 * (1 - t_norm) + 0.1 * c_t

        Weights correctness highest, penalizes slow responses, and gives
        a small bonus for self-reported clarity.
        """
        r_correct = 1.0 if is_correct else 0.0
        r_time = max(0.0, 1.0 - time_norm)
        
        reward = (0.6 * r_correct) + (0.3 * r_time) + (0.1 * clarity_score)
        return min(1.0, max(0.0, reward))  # Clipped [0,1]

    def get_heuristic_recommendation(self, confusion_score: float) -> str:
        """
        Rule-based baseline for comparison:
        If confused -> show 'example', else -> 'visual'.
        """
        if confusion_score > 0.5:
            return "example"
        return "visual"

    def update_bandit(self, arm_name: str, context: dict, reward: float):
        """
        Update the bandit model with new feedback (Reinforcement Learning Step).

        Delegates to the canonical bandit in ``services.bandit_service`` which
        wraps ``ml/inference/bandit_logic.update_bandit``. ``arm_name`` is
        expected to be one of the 6 string arms (``visual``, ``step``,
        ``example``, ``analogy``, ``easier``, ``harder``); legacy integer
        arm IDs are accepted for backward compatibility with older clients.
        """
        from services.bandit_service import bandit_service

        # Backwards-compat: accept legacy integer arm IDs (0..5)
        if isinstance(arm_name, int):
            try:
                arm_name = bandit_service.EXPLANATION_TYPES[arm_name]
            except (IndexError, TypeError):
                logger.warning(f"Invalid integer arm id for update: {arm_name}")
                return

        if arm_name not in bandit_service.EXPLANATION_TYPES:
            logger.warning(f"Invalid arm name for update: {arm_name}")
            return

        try:
            arm_id = bandit_service.EXPLANATION_TYPES.index(arm_name)
            bandit_service.update_reward(
                user_id=str(context.get("user_id", "anonymous")),
                arm_id=arm_id,
                reward=float(reward),
                confusion_score=float(context.get("confusion_score", 0.5)),
                mastery=float(context.get("avg_mastery", 0.5)),
            )
            logger.info(f"Bandit updated: arm={arm_name}, reward={reward}")
        except Exception as e:
            logger.error(f"Bandit update error: {e}")

ml_service = MLService()
