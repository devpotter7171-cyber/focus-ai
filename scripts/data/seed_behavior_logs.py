import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

# Add ml folder to path to import generator
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.append(os.path.join(PROJECT_ROOT, "ml"))

try:
    from synthetic_data_generator import SyntheticDataGenerator
except ImportError:
    print("Error: Could not import SyntheticDataGenerator. Check path/file existence.")
    sys.exit(1)

CRED_PATH = os.environ.get("FIREBASE_ADMIN_CREDENTIALS")

def initialize_firebase():
    if not firebase_admin._apps:
        if not CRED_PATH or not os.path.exists(CRED_PATH):
             # Fallback to relative path if env var issue
             fallback = os.path.join(BACKEND_DIR, "firebase-adminsdk.json")
             if os.path.exists(fallback):
                 cred = credentials.Certificate(fallback)
             else:
                 raise FileNotFoundError(f"Credential file not found.")
        else:
            cred = credentials.Certificate(CRED_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def seed_logs():
    print("Initializing Firebase...")
    db = initialize_firebase()
    
    print("Generating Synthetic Data...")
    # Generate smaller dataset for speed (10 users, 2 sessions)
    gen = SyntheticDataGenerator(n_users=10, n_sessions_per_user=2, n_questions_per_session=10)
    df = gen.generate_dataset()
    
    records = df.to_dict('records')
    print(f"Uploading {len(records)} behavior logs to Firestore...")
    
    batch = db.batch()
    count = 0
    total = 0
    
    for record in records:
        doc_ref = db.collection("behavior_logs").document()
        # Ensure timestamp is proper
        record['timestamp'] = datetime.now(timezone.utc)
        # Structure it similar to nested app logs for realism? 
        # Actually export handles flat or nested. Let's keep it flat as generator outputs.
        # But wait, app output has 'data' field. To be safe, let's mimick app structure slightly?
        # Nah, generator output is flat with 'user_id', 'hesitation_ms', etc.
        # Export script flattens everything.
        # Plot script looks for `is_confused` or `data.is_confused`.
        # Generator has `is_confused`.
        # So flat write is perfect.
        
        batch.set(doc_ref, record)
        count += 1
        
        if count >= 400: # Max batch size is 500
            batch.commit()
            total += count
            print(f"  Committed {total} records...")
            batch = db.batch()
            count = 0
            
    if count > 0:
        batch.commit()
        total += count
    
    print(f"Successfully seeded {total} logs.")

if __name__ == "__main__":
    seed_logs()
