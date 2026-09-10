import numpy as np
import pickle
import os

# REPRODUCIBILITY: Fixed seed for IEEE paper experiments
np.random.seed(42)

class LinUCB:
    def __init__(self, n_arms, n_features, alpha=0.1):
        self.n_arms = n_arms
        self.n_features = n_features
        self.alpha = alpha
        self.A = [np.identity(n_features) for _ in range(n_arms)]
        self.b = [np.zeros((n_features, 1)) for _ in range(n_arms)]

    def select_arm(self, context):
        p = []
        for a in range(self.n_arms):
            theta = np.linalg.inv(self.A[a]).dot(self.b[a])
            p_a = theta.T.dot(context) + self.alpha * np.sqrt(context.T.dot(np.linalg.inv(self.A[a])).dot(context))
            p.append(p_a[0][0])
        return np.argmax(p)

    def update(self, arm, context, reward):
        self.A[arm] += context.dot(context.T)
        self.b[arm] += reward * context

def train_bandit(model_path="ml/models/bandit_model.pkl"):
    print("Initializing Contextual Bandit...")

    # 6 Arms: visual, step, example, analogy, easier, harder
    # Must match services/bandit_service.EXPLANATION_TYPES and
    # ml/inference/bandit_logic.LinUCBBandit.ARMS (see AGENTS.md don't #6).
    bandit = LinUCB(n_arms=6, n_features=10)
    
    try:
        # Save model
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        # Save model parameters instead of the class instance for portability
        model_params = {
            'alpha': bandit.alpha,
            'A': bandit.A, 
            'b': bandit.b
        }
        
        with open(model_path, 'wb') as f:
            pickle.dump(model_params, f)
            
        print(f"Bandit model parameters saved to {model_path}")
    except Exception as e:
        print(f"Error saving model: {e}")

if __name__ == "__main__":
    train_bandit()
