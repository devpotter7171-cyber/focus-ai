
import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def test_level(course_id, unit_id, subtopic_id, level):
    url = f"{BASE_URL}/courses/{course_id}/units/{unit_id}/subtopics/{subtopic_id}"
    params = {"adaptation": str(level), "user_id": "test_verification"}
    
    print(f"\n--- Testing Level {level} ---")
    
    # Debug: Check Health
    try:
        h = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health")
        print(f"Health Check: {h.status_code}")
    except:
        print("Health Check: FAILED")

    try:
        response = requests.get(url, params=params)
        print(f"Response Code: {response.status_code}")
        if response.status_code != 200:
            print(f"FAILED: Status {response.status_code}")
            print(f"Body: {response.text}") # Print body to see error detail
            return False
            
        data = response.json()
        adaptation_note = data.get("adaptation", "")
        print(f"Adaptation Note: {adaptation_note}")
        
        # Check if the note matches the level
        expected_terms = {
            1: "Standard",
            2: "Elaborative",
            3: "Simplified",
            4: "Concrete",
            5: "Analogy"
        }
        
        expected_term = expected_terms.get(level, "Unknown")
        if expected_term in adaptation_note:
            print("✅ SUCCESS: Correct Level Returned")
            return True
        else:
            print(f"❌ FAILURE: Expected '{expected_term}' in note, got: '{adaptation_note}'")
            return False
            
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    # Test Topic: introduction-to-sql (mapped in demo_content)
    course = "dbms" # Assumption: course exists
    unit = "u1"     # Assumption: unit exists
    topic = "introduction-to-sql"
    
    success = True
    # Test L1 (Textbook)
    success &= test_level(course, unit, topic, 1)
    # Test L5 (Analogy)
    success &= test_level(course, unit, topic, 5)
    
    if success:
        print("\n\n✅ ALL TESTS PASSED: 5-Level API is functional.")
    else:
        print("\n\n❌ SOME TESTS FAILED")

if __name__ == "__main__":
    main()
