import pandas as pd
from sklearn.cluster import KMeans
import pickle
import os

def train_profiles(data_path="data/behavior_logs.csv", model_path="ml/models/profile_model.pkl"):
    # Mock data if file doesn't exist
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print("Data not found, generating synthetic data for profiling...")
        df = pd.DataFrame({
            'avg_time_per_page': [30, 120, 45, 200, 15],
            'scroll_speed': [50, 10, 40, 5, 60],
            'click_rate': [0.5, 0.1, 0.6, 0.05, 0.8]
        })

    X = df[['avg_time_per_page', 'scroll_speed', 'click_rate']]
    
    # 3 Clusters: Skimmer (Fast), Reader (Slow), Balanced
    kmeans = KMeans(n_clusters=3, random_state=42)
    kmeans.fit(X)
    
    # Save model
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    with open(model_path, 'wb') as f:
        pickle.dump(kmeans, f)
        
    print(f"Profile model trained and saved to {model_path}")
    print("Cluster Centers:", kmeans.cluster_centers_)

if __name__ == "__main__":
    train_profiles()
