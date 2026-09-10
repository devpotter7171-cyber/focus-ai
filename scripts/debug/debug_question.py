
import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Setup path to backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Explicit logic from verify_data.py to find creds
possible_paths = [
    os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
    "firebase-adminsdk.json",
    "backend/firebase-adminsdk.json",
    "../backend/firebase-adminsdk.json"
]
cred_path = next((p for p in possible_paths if p and os.path.exists(p)), None)

if not cred_path:
    print("No credentials found!")
    exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

def debug():
    print("Searching for question...")
    # Search in all questions collections
    # Note: Structure is quiz/{course}/questions/{doc} usually
    
    docs = db.collection_group("questions").stream()
    found = False
    for doc in docs:
        d = doc.to_dict()
        text = d.get("text") or d.get("question_text") or ""
        if "NOT a DDL command" in text:
            found = True
            print(f"FOUND Question ID: {doc.id}")
            print(f"Path: {doc.reference.path}")
            print(f"Text repr: {repr(text)}")
            print(f"Correct Answer repr: {repr(d.get('correct_answer'))}")
            print(f"Options repr: {repr(d.get('options'))}")
            
            # Check for exact match
            opts = d.get("options", [])
            ca = d.get("correct_answer")
            
            if ca in opts:
                print(f"Logic Check: correct_answer IS in options.")
                idx = opts.index(ca)
                print(f"Index of correct_answer: {idx}")
            else:
                print(f"Logic Check: FAIL. correct_answer is NOT in options!")
                
            # Allow fixing
            fix = True
            if fix:
                print("Attempting to fix...")
                # Force clean strings
                clean_opts = ["SELECT", "CREATE", "ALTER", "DROP"]
                clean_ca = "SELECT"
                
                doc.reference.update({
                    "options": clean_opts,
                    "correct_answer": clean_ca,
                    "question_text": "Which is NOT a DDL command?" # standardized key
                })
                print("Fixed.")

    if not found:
        print("Question NOT found in Firestore.")

if __name__ == "__main__":
    debug()
