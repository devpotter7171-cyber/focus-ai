import pandas as pd
import xgboost as xgb
import pickle
from sklearn.model_selection import train_test_split

def train_confusion_model(data_path="data/behavior_logs.csv", model_path="ml/models/confusion_model.pkl"):
    # Mock data generation if file doesn't exist
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print("Data not found, generating synthetic data...")
        df = pd.DataFrame({
            'hesitation_time': [100, 2000, 500, 3000],
            'tab_switches': [0, 5, 1, 8],
            'scroll_depth': [0.8, 0.2, 0.9, 0.1],
            'is_confused': [0, 1, 0, 1]
        })

    X = df[['hesitation_time', 'tab_switches', 'scroll_depth']]
    y = df['is_confused']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    model.fit(X_train, y_train)

    # Save model
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"Model trained and saved to {model_path}")
    return model

if __name__ == "__main__":
    train_confusion_model()
