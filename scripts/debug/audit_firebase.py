
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

# Initialize Firebase
# Set credentials path explicitly
os.environ["FIREBASE_ADMIN_CREDENTIALS"] = os.path.join(os.getcwd(), 'backend', 'firebase-adminsdk.json')

cred_path = os.environ.get("FIREBASE_ADMIN_CREDENTIALS")
if not cred_path:
    # Use default if not set (for local dev environments that might have it set differently)
    print("Warning: FIREBASE_ADMIN_CREDENTIALS not set.")
    # Assuming default app might be initialized or we need to try/except
try:
    firebase_admin.get_app()
except ValueError:
    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = firestore.client()

def audit_quiz_questions():
    print("\n--- Auditing Quiz Questions (quiz/dbms/questions) ---")
    questions_ref = db.collection("quiz").document("dbms").collection("questions")
    docs = list(questions_ref.stream())
    print(f"Found {len(docs)} questions.")
    
    issues = []
    for doc in docs:
        d = doc.to_dict()
        qid = doc.id
        
        # Check required fields
        if not d.get("text") and not d.get("question_text"):
            issues.append(f"Question {qid}: Missing 'text' field")
        
        options = d.get("options")
        if not options or not isinstance(options, list) or len(options) < 2:
            issues.append(f"Question {qid}: Invalid 'options' (found {len(options) if options else 0})")
            
        correct = d.get("correct_answer")
        if correct is None: # explicit check for None, as index 0 is valid
            issues.append(f"Question {qid}: Missing 'correct_answer'")
        
        # Check consistency
        if isinstance(correct, int):
            if not (0 <= correct < len(options)):
                issues.append(f"Question {qid}: 'correct_answer' index {correct} out of bounds (options: {len(options)})")
        elif isinstance(correct, str):
            if correct not in options:
                 # Fuzzy match check?
                 issues.append(f"Question {qid}: 'correct_answer' string not found in options")

    if issues:
        print(f"FAILED: Found {len(issues)} issues:")
        for i in issues[:10]:
            print(f" - {i}")
        if len(issues) > 10: print("...")
    else:
        print("PASSED: All questions valid.")

def audit_quiz_results():
    print("\n--- Auditing Quiz Results (quiz_results) ---")
    results = list(db.collection("quiz_results").stream())
    print(f"Found {len(results)} results.")
    
    issues = []
    for doc in results:
        d = doc.to_dict()
        
        score = d.get("score")
        total = d.get("total_questions")
        
        if score is None or total is None:
            issues.append((f"Result {doc.id}: Missing score/total", doc.id))
            continue
            
        if score > total:
            issues.append((f"Result {doc.id}: Score {score} > Total {total}", doc.id))
            
        if score < 0:
            issues.append((f"Result {doc.id}: Negative score {score}", doc.id))

    if issues:
        print(f"FAILED: Found {len(issues)} issues:")
        for i, (msg, doc_id) in enumerate(issues[:10]):
            print(f" - {msg}")
        if len(issues) > 10: print("...")

        # Automatic Cleanup
        print(f"\nCleaning up {len(issues)} invalid records...")
        batch = db.batch()
        count = 0
        for _, doc_id in issues:
            ref = db.collection("quiz_results").document(doc_id)
            batch.delete(ref)
            count += 1
            if count % 400 == 0: # Firestore batch limit is 500
                batch.commit()
                batch = db.batch()
        
        if count % 400 != 0:
            batch.commit()
        print(f"Deleted {count} invalid records.")

    else:
        print("PASSED: All results valid.")

def audit_behavior_logs():
    print("\n--- Auditing Behavior Logs (behavior_logs) ---")
    logs = list(db.collection("behavior_logs").limit(50).stream()) # Limit check for perf
    print(f"Sampling {len(logs)} logs (limit 50).")
    
    issues = []
    for doc in logs:
        d = doc.to_dict()
        issue = None
        if not d.get("user_id"): issue = f"Log {doc.id}: Missing user_id"
        elif not d.get("event_type"): issue = f"Log {doc.id}: Missing event_type"
        elif not d.get("timestamp"): issue = f"Log {doc.id}: Missing timestamp"
        
        if issue:
            issues.append((issue, doc.id))

    if issues:
        print(f"FAILED: Found {len(issues)} issues in sample. Cleaning up...")
        batch = db.batch()
        for msg, doc_id in issues:
            print(f" - {msg}")
            batch.delete(db.collection("behavior_logs").document(doc_id))
        batch.commit()
        print("Cleanup complete.")
    else:
        print("PASSED: Behavior logs sample valid.")

def audit_users():
    print("\n--- Auditing Users (users) ---")
    users = list(db.collection("users").stream())
    print(f"Found {len(users)} users.")
    
    issues = []
    for doc in users:
        d = doc.to_dict()
        if not d.get("email"): issues.append(f"User {doc.id}: Missing email")
        # Role is optional (defaults to student in code) but good to check consistency
        
    if issues:
        print(f"FAILED: Found {len(issues)} issues:")
        for i in issues[:5]: print(f" - {i}")
    else:
        print("PASSED: All users valid.")

def audit_courses():
    print("\n--- Auditing Courses (courses) ---")
    courses = list(db.collection("courses").stream())
    print(f"Found {len(courses)} courses.")
    
    issues = []
    for doc in courses:
        d = doc.to_dict()
        cid = doc.id
        if not d.get("title"): issues.append(f"Course {cid}: Missing title")
        
        # Check Units
        units = list(db.collection("courses").document(cid).collection("units").stream())
        if not units:
            issues.append(f"Course {cid}: No units found")
        
        for u in units:
            ud = u.to_dict()
            uid = u.id
            if not ud.get("title"): issues.append(f"Unit {cid}/{uid}: Missing title")
            
            # Check Subtopics
            subs = list(db.collection("courses").document(cid).collection("units").document(uid).collection("subtopics").stream())
            if not subs:
                issues.append(f"Unit {cid}/{uid}: No subtopics found")
            
            for s in subs:
                sd = s.to_dict()
                sid = s.id
                if not sd.get("title"): issues.append(f"Subtopic {cid}/{uid}/{sid}: Missing title")
                if not sd.get("content") and not sd.get("content_levels"): 
                    issues.append(f"Subtopic {cid}/{uid}/{sid}: Missing content")

    if issues:
        print(f"FAILED: Found {len(issues)} issues:")
        for i in issues[:10]: print(f" - {i}")
        if len(issues) > 10: print("...")
    else:
        print("PASSED: Courses structure valid.")

def audit_user_feedback():
    print("\n--- Auditing User Feedback (user_feedback) ---")
    feedback = list(db.collection("user_feedback").stream())
    print(f"Found {len(feedback)} feedback entries.")
    
    issues = []
    for doc in feedback:
        d = doc.to_dict()
        if not d.get("user_id"): issues.append(f"Feedback {doc.id}: Missing user_id")
        
    if issues:
        print(f"FAILED: Found {len(issues)} issues:")
        for i in issues[:5]: print(f" - {i}")
    else:
        print("PASSED: Feedback valid.")

def inspect_unknown_collections():
    print("\n--- Inspecting Unknown Collections ---")
    
    # Test Collection
    tests = list(db.collection("test").limit(5).stream())
    print(f"Collection 'test': {len(tests)} docs found (limit 5).")
    for t in tests:
        print(f" - Sample {t.id}: {t.to_dict().keys()}")

    # User Courses
    ucs = list(db.collection("user_courses").limit(5).stream())
    print(f"Collection 'user_courses': {len(ucs)} docs found (limit 5).")
    for u in ucs:
        print(f" - Sample {u.id}: {u.to_dict().keys()}")

if __name__ == "__main__":
    # audit_quiz_questions()
    # audit_quiz_results()
    audit_behavior_logs()
    # audit_users()
    # audit_courses()
    audit_user_feedback()
    inspect_unknown_collections()
