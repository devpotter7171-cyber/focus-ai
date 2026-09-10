
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
import sys

# Initialize Firebase
def init_firebase():
    # Try different potential credential paths
    potential_paths = [
        "backend/firebase-adminsdk.json",
        "../backend/firebase-adminsdk.json",
        os.path.join(os.getcwd(), 'backend', 'firebase-adminsdk.json'),
        os.environ.get("FIREBASE_ADMIN_CREDENTIALS")
    ]
    
    cred_path = None
    for path in potential_paths:
        if path and os.path.exists(path):
            cred_path = path
            break
            
    if not cred_path:
        print("Warning: Could not find firebase-adminsdk.json. Attempting default init (will likely fail if not on GCP).")
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        return

    print(f"Loading credentials from: {cred_path}")
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

init_firebase()
db = firestore.client()

COURSE_ID = "dbms"

def seed_subtopics():
    # Load the seed data
    seed_path = os.path.join("seed", "dbms_subtopics.json")
    if not os.path.exists(seed_path):
        # Try relative to scripts folder
        seed_path = os.path.join("..", "seed", "dbms_subtopics.json")
    
    if not os.path.exists(seed_path):
        print(f"Error: Could not find seed file at {seed_path}")
        return

    print(f"Reading seed file: {seed_path}")
    with open(seed_path, "r", encoding="utf-8") as f:
        subtopics = json.load(f)

    print(f"Found {len(subtopics)} subtopics. Starting seed...")

    batch = db.batch()
    count = 0
    total = len(subtopics)

    for sub in subtopics:
        unit_id = sub.get("unit_id")
        subtopic_id = sub.get("id")
        
        if not unit_id or not subtopic_id:
            print(f"Skipping invalid item: {sub}")
            continue

        doc_ref = (db.collection("courses")
                   .document(COURSE_ID)
                   .collection("units")
                   .document(unit_id)
                   .collection("subtopics")
                   .document(subtopic_id))

        # We overwrite the document to ensure latest content and levels
        # merge=True preserves other fields if they exist (like completion status? maybe safer)
        # But we want to ensure 'content_levels' is definitely updated.
        batch.set(doc_ref, sub, merge=True)
        count += 1
        
        # Firestore batches are limited to 500 ops. We have ~26, so no issue.
    
    batch.commit()
    print(f"✅ Successfully seeded {count}/{total} subtopics to Firestore.")

if __name__ == "__main__":
    seed_subtopics()
