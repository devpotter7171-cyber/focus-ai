
import os
import sys
from dotenv import load_dotenv
from google import genai

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key found: {'Yes' if api_key else 'No'}")

try:
    client = genai.Client(api_key=api_key)
    # List models
    print("Listing models...")
    # The new SDK might have a different way to list models.
    # Trying client.models.list() if it exists, or via http?
    # Inspecting client object is hard in script.
    # Let's try the standard way if known.
    # The v1alpha/beta SDK usually has client.models.list()
    
    # Actually, let's just try to generate with 'gemini-1.5-flash' and print detailed error if it fails
    # But listing is better.
    # If the SDK corresponds to the google-genai 0.1+, it uses client.models.list()
    
    pager = client.models.list()
    for model in pager:
        print(f"Model: {model.name}")
        
except Exception as e:
    print(f"Error listing models: {e}")
    # Fallback: try to print dir(client)
    try:
        print(dir(client))
    except:
        pass
