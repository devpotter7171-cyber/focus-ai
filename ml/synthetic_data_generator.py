"""
Synthetic Data Generator for Focus-AI

Generates realistic behavioral data for training ML models when no real user data is available.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import json
import os

# Seed for reproducibility
np.random.seed(42)
random.seed(42)


class SyntheticDataGenerator:
    """Generate synthetic behavioral logs for ML training."""
    
    # User archetypes with behavioral patterns
    ARCHETYPES = {
        "fast_learner": {
            "confusion_prob": 0.15,
            "avg_time": 15,  # seconds
            "avg_hesitation": 800,  # ms
            "tab_switch_rate": 0.1,
            "accuracy": 0.85
        },
        "steady_learner": {
            "confusion_prob": 0.35,
            "avg_time": 35,
            "avg_hesitation": 2000,
            "tab_switch_rate": 0.25,
            "accuracy": 0.70
        },
        "struggling_learner": {
            "confusion_prob": 0.65,
            "avg_time": 60,
            "avg_hesitation": 4500,
            "tab_switch_rate": 0.5,
            "accuracy": 0.45
        },
        "distracted_learner": {
            "confusion_prob": 0.50,
            "avg_time": 45,
            "avg_hesitation": 3000,
            "tab_switch_rate": 0.8,
            "accuracy": 0.55
        }
    }
    
    def __init__(self, n_users: int = 100, n_sessions_per_user: int = 5, 
                 n_questions_per_session: int = 20):
        self.n_users = n_users
        self.n_sessions = n_sessions_per_user
        self.n_questions = n_questions_per_session
        
        # Skills/topics in DBMS course
        self.skills = [
            "relational_model", "sql_basics", "normalization_1nf",
            "normalization_2nf", "normalization_3nf", "er_diagrams",
            "transactions", "acid_properties", "indexing", "query_optimization"
        ]
        
    def generate_user_profile(self, user_id: str) -> dict:
        """Generate a user with a random archetype."""
        archetype = random.choice(list(self.ARCHETYPES.keys()))
        return {
            "user_id": user_id,
            "archetype": archetype,
            **self.ARCHETYPES[archetype]
        }
    
    def generate_interaction(self, user: dict, question_id: str, skill: str, 
                            session_num: int) -> dict:
        """Generate a single interaction record."""
        profile = user
        
        # Add some noise to base rates
        noise = lambda x, std: max(0, x + np.random.normal(0, std))
        
        # Time on question (with learning effect - gets faster in later sessions)
        session_factor = 1 - (session_num * 0.05)  # 5% faster per session
        time_on_question = noise(profile["avg_time"] * session_factor, 10) * 1000  # to ms
        
        # Hesitation
        hesitation = noise(profile["avg_hesitation"], 500)
        
        # Tab switches (Poisson distributed)
        tab_switches = np.random.poisson(profile["tab_switch_rate"] * 2)
        
        # Scroll depth (higher when confused)
        scroll_depth = min(100, noise(60, 20) + (tab_switches * 5))
        
        # Attempts (more when struggling)
        attempts = 1 + np.random.poisson(0.5 if profile["accuracy"] > 0.6 else 1.5)
        
        # Hint requests
        hint_requests = 1 if random.random() < (1 - profile["accuracy"]) * 0.3 else 0
        
        # Correctness (with learning curve)
        accuracy_boost = session_num * 0.03  # 3% improvement per session
        is_correct = 1 if random.random() < min(0.95, profile["accuracy"] + accuracy_boost) else 0
        
        # Confusion label (ground truth for training)
        confusion_indicators = [
            hesitation > 3000,
            tab_switches > 2,
            attempts > 2,
            time_on_question > 45000
        ]
        is_confused = 1 if sum(confusion_indicators) >= 2 else 0
        
        return {
            "user_id": user["user_id"],
            "session_id": f"sess_{user['user_id']}_{session_num}",
            "question_id": question_id,
            "skill_id": skill,
            "time_on_question_ms": int(time_on_question),
            "hesitation_ms": int(hesitation),
            "tab_switches": int(tab_switches),
            "scroll_depth_pct": float(min(100, max(0, scroll_depth))),
            "attempts": int(attempts),
            "hint_requests": int(hint_requests),
            "is_correct": int(is_correct),
            "is_confused": int(is_confused),  # Ground truth label
            "timestamp": datetime.now().isoformat()
        }
    
    def generate_dataset(self) -> pd.DataFrame:
        """Generate complete synthetic dataset."""
        records = []
        
        for i in range(self.n_users):
            user_id = f"user_{i:04d}"
            user = self.generate_user_profile(user_id)
            
            for session in range(self.n_sessions):
                # Shuffle skills for this session
                session_skills = random.sample(self.skills, min(self.n_questions, len(self.skills)))
                session_skills = session_skills * (self.n_questions // len(session_skills) + 1)
                
                for q in range(self.n_questions):
                    question_id = f"q_{session_skills[q]}_{random.randint(1, 100):03d}"
                    interaction = self.generate_interaction(
                        user, question_id, session_skills[q], session
                    )
                    records.append(interaction)
        
        return pd.DataFrame(records)
    
    def generate_answer_logs(self, behavior_df: pd.DataFrame) -> pd.DataFrame:
        """Generate answer log format from behavior data."""
        answer_records = []
        
        for _, row in behavior_df.iterrows():
            answer_records.append({
                "user_id": row["user_id"],
                "question_id": row["question_id"],
                "skill_id": row["skill_id"],
                "is_correct": row["is_correct"],
                "time_taken_ms": row["time_on_question_ms"],
                "attempts": row["attempts"],
                "hint_used": row["hint_requests"] > 0,
                "timestamp": row["timestamp"]
            })
        
        return pd.DataFrame(answer_records)
    
    def save_to_csv(self, output_dir: str = "."):
        """Generate and save datasets to CSV files."""
        print(f"Generating synthetic data for {self.n_users} users...")
        
        behavior_df = self.generate_dataset()
        answer_df = self.generate_answer_logs(behavior_df)
        
        behavior_path = os.path.join(output_dir, "synthetic_behavior_logs.csv")
        answer_path = os.path.join(output_dir, "synthetic_answer_logs.csv")
        
        behavior_df.to_csv(behavior_path, index=False)
        answer_df.to_csv(answer_path, index=False)
        
        print(f"Saved {len(behavior_df)} behavior records to {behavior_path}")
        print(f"Saved {len(answer_df)} answer records to {answer_path}")
        
        # Print class distribution
        confusion_rate = behavior_df["is_confused"].mean()
        accuracy_rate = behavior_df["is_correct"].mean()
        print(f"\nDataset stats:")
        print(f"  Confusion rate: {confusion_rate:.2%}")
        print(f"  Accuracy rate: {accuracy_rate:.2%}")
        print(f"  Unique users: {behavior_df['user_id'].nunique()}")
        print(f"  Unique sessions: {behavior_df['session_id'].nunique()}")
        
        return behavior_df, answer_df


def main():
    """Generate synthetic data for ML training."""
    generator = SyntheticDataGenerator(
        n_users=100,
        n_sessions_per_user=5,
        n_questions_per_session=20
    )
    
    output_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(output_dir, exist_ok=True)
    
    generator.save_to_csv(output_dir)


if __name__ == "__main__":
    main()
