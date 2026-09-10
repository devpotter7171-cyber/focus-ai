import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime

# Setup paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORTS_DIR = os.path.join(BACKEND_DIR, "exports")
CRED_PATH = os.environ.get("FIREBASE_ADMIN_CREDENTIALS")

if not os.path.exists(EXPORTS_DIR):
    os.makedirs(EXPORTS_DIR)

def initialize_firebase():
    """Initialize Firebase Admin if not already initialized."""
    if not firebase_admin._apps:
        if not CRED_PATH or not os.path.exists(CRED_PATH):
            raise FileNotFoundError(f"Credential file not found at: {CRED_PATH}")
        cred = credentials.Certificate(CRED_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def export_collection(db, collection_name):
    """Fetch, flatten, and save a collection to CSV."""
    print(f"Exporting: {collection_name}...")
    
    docs_ref = db.collection(collection_name).stream()
    docs_list = []
    
    for doc in docs_ref:
        d = doc.to_dict()
        d['id'] = doc.id # Include document ID
        docs_list.append(d)
        
    if not docs_list:
        print(f"  Warning: {collection_name} is empty.")
        return

    # Use pandas to flatten nested JSON structures efficiently
    df = pd.json_normalize(docs_list)
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{collection_name}_{timestamp}.csv"
    filepath = os.path.join(EXPORTS_DIR, filename)
    
    df.to_csv(filepath, index=False)
    print(f"  Saved: {filepath} ({len(docs_list)} records)")

def main():
    try:
        print("Starting Firestore Data Export...")
        db = initialize_firebase()
        
        collections = ["behavior_logs", "intervention_logs", "user_feedback"]
        
        for col in collections:
            export_collection(db, col)
            
        print("\nExport Complete.")
        
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
