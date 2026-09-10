import pandas as pd
import os

FILE_PATH = "ml/data/synthetic_answer_logs.csv"

def clean_data():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    print(f"Reading {FILE_PATH}...")
    df = pd.read_csv(FILE_PATH)
    original_count = len(df)
    
    # Filter out rows where time_taken_ms is 0
    # Also valid to remove negative times if any exists
    print("Filtering invalid rows (time_taken_ms <= 0)...")
    clean_df = df[df['time_taken_ms'] > 0]
    
    removed_count = original_count - len(clean_df)
    
    if removed_count > 0:
        clean_df.to_csv(FILE_PATH, index=False)
        print(f"Successfully removed {removed_count} invalid rows.")
        print(f"Remaining rows: {len(clean_df)}")
    else:
        print("No invalid rows found. File is clean.")

if __name__ == "__main__":
    clean_data()
