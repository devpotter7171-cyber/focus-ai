import firebase_admin
from firebase_admin import credentials, firestore
import time
import requests

# Initialize Firestore
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

db = firestore.client()

USER_ID = "user_0000"
SESSION = "simulated_session"
UNIT_ID = "unit_01"
# Target the 'Normal Forms' or 'Introduction to SQL' subtopic where we have demo content
SUBTOPIC_ID = "subtopic_norm_1" # Normal Forms

def simulate_high_confusion():
    print(f"Injecting HIGH CONFUSION logs for {USER_ID}...")
    
    # 1. Clear existing preference to test pure automation
    db.collection('users').document(USER_ID).update({"preferred_level": firestore.DELETE_FIELD})
    print("Cleared user preference.")

    # 2. Inject 5 "Confused" logs (High Hesitation, erratic scrolling)
    # The ml_service heuristic checks if hesitation > 2000ms -> 0.8 conf
    logs_ref = db.collection("behavior_logs")
    
    for i in range(5):
        log_entry = {
            "user_id": USER_ID,
            "session_id": SESSION,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "data": {
                "screen": f"{UNIT_ID}_{SUBTOPIC_ID}", # Must match current screen
                "hesitation_ms": 5000, # Very High -> Confusion
                "scroll_depth": 10,    # Shallow scroll
                "tab_switches": 3,
                "mouse_velocity": 0.1
            }
        }
        logs_ref.add(log_entry)
        print(f"  - Injected log {i+1}")
        time.sleep(0.1)
        
    print("Logs injected. Now fetching content...")
    
    # 3. Fetch content API
    url = f"http://localhost:8000/api/v1/courses/course_001/units/{UNIT_ID}/subtopics/{SUBTOPIC_ID}?user_id={USER_ID}"
    try:
        resp = requests.get(url)
        data = resp.json()
        
        print("\n--- API RESPONSE ---")
        print(f"Title: {data.get('title')}")
        print(f"Adaptation Note: {data.get('adaptation')}")
        
        if "Analogy" in str(data.get('adaptation')) or "Level 5" in str(data.get('adaptation')):
            print("✅ SUCCESS: System Automatically Adapted to Level 5 (Analogy)!")
        else:
            print("❌ FAILURE: Adaptation did not trigger or picked wrong level.")
            print(f"Got: {data.get('adaptation')}")
            
    except Exception as e:
        print(f"❌ API Request Failed: {e}")

if __name__ == "__main__":
    simulate_high_confusion()
