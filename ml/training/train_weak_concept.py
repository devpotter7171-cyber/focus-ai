import pandas as pd
import xgboost as xgb
import pickle
import os

def train_weak_concept_model():
    # Get absolute path to the 'ml' directory
    current_dir = os.path.dirname(os.path.abspath(__file__)) # ml/training
    ml_dir = os.path.dirname(current_dir) # ml
    model_path = os.path.join(ml_dir, "models", "weak_concept_model.pkl")

    print(f"Training Weak Concept Predictor... Target: {model_path}")
    
    # Synthetic Data: History of correctness per concept
    # Features: [avg_score, attempts, time_spent, confusion_count]
    # Target: 1 (Weak/Risk), 0 (Strong)
    df = pd.DataFrame({
        'avg_score': [0.2, 0.9, 0.4, 0.8, 0.1],
        'attempts': [5, 1, 4, 2, 6],
        'time_spent': [500, 100, 400, 150, 600],
        'confusion_count': [3, 0, 2, 0, 4],
        'is_weak': [1, 0, 1, 0, 1]
    })
    
    X = df[['avg_score', 'attempts', 'time_spent', 'confusion_count']]
    y = df['is_weak']
    
    model = xgb.XGBClassifier()
    model.fit(X, y)
    
    try:
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        print(f"Weak Concept model trained and saved to {model_path}")
    except Exception as e:
        print(f"Error saving model: {e}")

if __name__ == "__main__":
    train_weak_concept_model()
