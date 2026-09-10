"""
ML Inference: LinUCB Contextual Bandit

Selects optimal explanation type based on user context.
"""
import pickle
import os
import numpy as np
import hashlib
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "bandit_model.pkl")


class LinUCBBandit:
    """LinUCB Contextual Bandit for content recommendation."""
    
    # Available arms (explanation types)
    ARMS = ["visual", "step", "example", "analogy", "easier", "harder"]
    
    def __init__(self, n_features: int = 10, alpha: float = 0.1):
        self.n_features = n_features
        self.alpha = alpha
        self.n_arms = len(self.ARMS)
        
        # Initialize A matrices (n_features x n_features) and b vectors (n_features x 1)
        self.A = [np.eye(n_features) for _ in range(self.n_arms)]
        self.b = [np.zeros((n_features, 1)) for _ in range(self.n_arms)]
        
        self.load_model()
    
    def load_model(self):
        """Load pre-trained bandit parameters."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    saved = pickle.load(f)
                
                if isinstance(saved, dict):
                    self.alpha = saved.get('alpha', self.alpha)
                    loaded_A = saved.get('A', [])
                    loaded_b = saved.get('b', [])
                    
                    # Validate loaded data
                    if (len(loaded_A) == self.n_arms and len(loaded_b) == self.n_arms and
                        all(isinstance(a, np.ndarray) and a.shape == (self.n_features, self.n_features) for a in loaded_A) and
                        all(isinstance(b, np.ndarray) and b.shape == (self.n_features, 1) for b in loaded_b)):
                        self.A = loaded_A
                        self.b = loaded_b
                        logger.info("Bandit model loaded successfully.")
                    else:
                        logger.warning(f"Bandit model mismatch: Expected {self.n_arms} arms with shape ({self.n_features}, {self.n_features}), got {len(loaded_A)}. Using fresh initialization.")
                        # Ensure fresh initialization is used
                        self.A = [np.eye(self.n_features) for _ in range(self.n_arms)]
                        self.b = [np.zeros((self.n_features, 1)) for _ in range(self.n_arms)]
                else:
                    logger.warning(f"Bandit model has unexpected format. Using fresh initialization.")
                    # Ensure fresh initialization is used
                    self.A = [np.eye(self.n_features) for _ in range(self.n_arms)]
                    self.b = [np.zeros((self.n_features, 1)) for _ in range(self.n_arms)]
            except Exception as e:
                logger.error(f"Failed to load bandit model: {e}. Using fresh initialization.")
                # Ensure fresh initialization is used on error
                self.A = [np.eye(self.n_features) for _ in range(self.n_arms)]
                self.b = [np.zeros((self.n_features, 1)) for _ in range(self.n_arms)]
        else:
            logger.warning(f"Bandit model not found, using fresh initialization.")
            # Ensure fresh initialization is used
            self.A = [np.eye(self.n_features) for _ in range(self.n_arms)]
            self.b = [np.zeros((self.n_features, 1)) for _ in range(self.n_arms)]
    
    def build_context(self, user_context: dict) -> np.ndarray:
        """
        Build context feature vector from user state.
        
        Args:
            user_context: Dictionary with:
                - user_id: str
                - confusion_score: float (0-1)
                - avg_mastery: float (0-1)
                - learning_style: str (Skimmer/Reader/Balanced)
                - time_on_question_norm: float (0-1)
        
        Returns:
            numpy array of shape (n_features, 1)
        """
        ctx = np.zeros((self.n_features, 1))
        
        # Feature 0: Bias term
        ctx[0] = 1.0
        
        # Feature 1: Confusion score
        ctx[1] = user_context.get("confusion_score", 0.5)
        
        # Feature 2: Average mastery
        ctx[2] = user_context.get("avg_mastery", 0.5)
        
        # Feature 3: Normalized time on question
        ctx[3] = user_context.get("time_on_question_norm", 0.5)
        
        # Features 4-6: Learning style one-hot
        style = user_context.get("learning_style", "Balanced")
        ctx[4] = 1.0 if style == "Skimmer" else 0.0
        ctx[5] = 1.0 if style == "Deep Reader" else 0.0
        ctx[6] = 1.0 if style == "Balanced" else 0.0
        
        # Feature 7: User hash feature (for personalization)
        user_id = user_context.get("user_id", "default")
        h = hashlib.sha256(user_id.encode()).hexdigest()
        ctx[7] = (int(h[:8], 16) % 100) / 100.0
        
        # Features 8-9: Reserved for future use
        ctx[8] = 0.0
        ctx[9] = 0.0
        
        return ctx
    
    def select_arm(self, user_context: dict) -> dict:
        """
        Select the best arm using LinUCB Upper Confidence Bound.
        
        Returns:
            Dictionary with arm_id, arm_name, and ucb_score
        """
        ctx = self.build_context(user_context)
        
        scores = []
        for arm_idx in range(self.n_arms):
            A_inv = np.linalg.inv(self.A[arm_idx])
            theta = A_inv.dot(self.b[arm_idx])
            
            # UCB = theta^T * x + alpha * sqrt(x^T * A_inv * x)
            exploitation = float(theta.T.dot(ctx).item())
            exploration = self.alpha * np.sqrt(float(ctx.T.dot(A_inv).dot(ctx).item()))
            ucb = exploitation + exploration
            
            scores.append({
                "arm_idx": arm_idx,
                "arm_name": self.ARMS[arm_idx],
                "ucb_score": ucb,
                "exploitation": exploitation,
                "exploration": exploration
            })
        
        # Select arm with highest UCB
        best = max(scores, key=lambda x: x["ucb_score"])
        
        return {
            "arm_id": best["arm_idx"],
            "arm_name": best["arm_name"],
            "ucb_score": best["ucb_score"],
            "reason": f"UCB={best['ucb_score']:.3f} (exploit={best['exploitation']:.3f}, explore={best['exploration']:.3f})",
            "all_scores": scores
        }
    
    def update(self, arm_idx: int, context: np.ndarray, reward: float):
        """
        Update bandit parameters after observing reward.
        
        Args:
            arm_idx: Index of the arm that was played
            context: Context vector used for selection
            reward: Observed reward (0 or 1)
        """
        self.A[arm_idx] += context.dot(context.T)
        self.b[arm_idx] += reward * context
    
    def save_model(self, path: str = MODEL_PATH):
        """Save current bandit state."""
        with open(path, 'wb') as f:
            pickle.dump({
                'alpha': self.alpha,
                'A': self.A,
                'b': self.b
            }, f)
        logger.info(f"Bandit model saved to {path}")


# Singleton
bandit = LinUCBBandit()


def select_explanation(user_context: dict) -> dict:
    """Convenience function for arm selection."""
    return bandit.select_arm(user_context)


def update_bandit(arm_idx: int, context: dict, reward: float):
    """Convenience function for bandit update."""
    ctx = bandit.build_context(context)
    bandit.update(arm_idx, ctx, reward)


def get_available_arms() -> list:
    """Return list of available explanation types."""
    return LinUCBBandit.ARMS
