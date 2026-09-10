
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
import sys

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_FILE = os.path.join(BASE_DIR, "seed", "dbms_subtopics.json")

def init_firebase():
    # Robust credential discovery
    possible_paths = [
        os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
        "firebase-adminsdk.json",
        "backend/firebase-adminsdk.json",
        "../backend/firebase-adminsdk.json",
        os.path.join(BASE_DIR, "serviceAccountKey.json"),
        os.path.join(BASE_DIR, "backend", "serviceAccountKey.json")
    ]
    cred_path = next((p for p in possible_paths if p and os.path.exists(p)), None)

    if not cred_path:
        print(f"Error: No credential file found. Searched in: {possible_paths}")
        return None

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        return None

def load_title_map():
    if not os.path.exists(SEED_FILE):
        print(f"Error: Seed file not found at {SEED_FILE}")
        return {}
    
    try:
        with open(SEED_FILE, 'r', encoding='utf-8') as f:
            subtopics = json.load(f)
            # Map subtopic_id -> title
            return {item['id']: item['title'] for item in subtopics}
    except Exception as e:
        print(f"Failed to load seed file: {e}")
        return {}

def backfill_titles():
    db = init_firebase()
    if not db:
        return

    title_map = load_title_map()
    if not title_map:
        print("No subtopics loaded. Exiting.")
        return

    print(f"Loaded {len(title_map)} subtopics from seed.")

    # Get all quiz results
    docs = db.collection('quiz_results').stream()
    
    updated_count = 0
    total_checked = 0

    for doc in docs:
        data = doc.to_dict()
        subtopic_id = data.get('subtopic_id')
        current_title = data.get('subtopic_title')
        
        total_checked += 1

        if subtopic_id in title_map:
            correct_title = title_map[subtopic_id]
            
            # If title is missing or doesn't match the seed title
            if not current_title or current_title != correct_title:
                print(f"Updating {doc.id}: {subtopic_id} -> '{correct_title}'")
                doc.reference.update({'subtopic_title': correct_title})
                updated_count += 1
        else:
            print(f"Warning: subtopic_id '{subtopic_id}' in doc {doc.id} not found in seed.")

    print(f"\nBackfill complete.")
    print(f"Total documents checked: {total_checked}")
    print(f"Documents updated: {updated_count}")

if __name__ == "__main__":
    backfill_titles()
