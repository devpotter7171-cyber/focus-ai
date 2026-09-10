import sys
import os
import logging
import numpy as np

# Add project root to path (assuming backend/tests/verify_rl_loop.py)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.ml_service import MLService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Test")

def test_rl_update():
    print("Testing RL Loop...")
    service = MLService()
    
    # Mock a bandit model if not loaded (unit test style)
    # This simulates the loading that would happen in a real server if the pkl files existed
    # or initializes a fresh one if they don't.
    if not service.bandit_model:
        print("Creating mock bandit model for test...")
        service.bandit_model = {
            'alpha': 0.1,
            'A': [np.eye(10) for _ in range(6)],
            'b': [np.zeros((10, 1)) for _ in range(6)]
        }

    # Context
    obs_context = {"user_id": "test_user_1", "confusion_score": 0.8}
    arm_name = "example"
    reward = 1.0 # Helpful
    
    try:
        service.update_bandit(arm_name, obs_context, reward)
        print("✓ update_bandit executed successfully.")
        
        # Additional check: simulate negative feedback
        service.update_bandit("visual", obs_context, 0.0)
        print("✓ update_bandit (negative) executed successfully.")
        
    except Exception as e:
        print(f"✗ update_bandit failed: {e}")
        raise e

    print("RL Loop Verified.")

if __name__ == "__main__":
    test_rl_update()
