import firebase_admin
from firebase_admin import credentials, firestore
import os

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'focus-ai-1',
    })

db = firestore.client()

def count_questions(subtopic_id: str):
    print(f"Checking questions for subtopic: {subtopic_id}...")
    try:
        # Standard path used in questions.py
        # quiz/dbms/questions where subtopic_id == subtopic_id
        q_ref = (db.collection("quiz")
                 .document("dbms")
                 .collection("questions")
                 .where("subtopic_id", "==", subtopic_id))
        
        docs = list(q_ref.stream())
        count = len(docs)
        print(f"Found {count} questions for '{subtopic_id}'.")
        
        if count > 0:
            print("Sample IDs:")
            for d in docs[:3]:
                print(f" - {d.id}")
    except Exception as e:
        print(f"Error checking questions: {e}")

if __name__ == "__main__":
    # Test with common subtopics likely to be used
    count_questions("intro-to-database-systems")
    count_questions("relational-model")
