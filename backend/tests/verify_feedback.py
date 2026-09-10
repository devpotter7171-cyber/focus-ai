import requests
import json

url = "http://localhost:8000/api/v1/behavior/feedback"
data = {
    "user_id": "demo_feedback_user",
    "is_confused": False,
    "recommended_arm": "visual",
    "feedback_text": "Python Verification Script"
}

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
