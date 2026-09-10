
import sys
import os
import json
import asyncio
from typing import Dict, Any

sys.path.append(os.path.join(os.getcwd(), 'backend'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

from google import genai
from google.genai import types

API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

MODEL_NAME = 'models/gemini-2.0-flash-exp'

BATCH_PROMPT = """
You are an expert educational content creator.
I have a "Level 1" (Expert/Original) text about a DBMS topic.
I need you to generate 4 VARIATIONS of this content for different learning modes.

OUTPUT FORMAT:
Return a JSON object with exactly these keys: "2", "3", "4", "5".
Do NOT include markdown formatting (like ```json). Just the raw JSON string.

VARIATION REQUIREMENTS:

"2" (Simplified/ELI5):
- Target: Beginner/High School.
- Style: Simple language, analogies (e.g., "Think of a database like a filing cabinet...").
- Content: Explains the core concept without jargon.

"3" (Key Points):
- Target: Exam revision.
- Style: Bullet points ONLY. Bold keywords.
- Content: High-density facts. No fluff.

"4" (Real World/Applied):
- Target: Developer/Practitioner.
- Style: "Problem -> Solution" or "Use Case".
- Content: Concrete examples, why this matters in industry (e.g. "Used in banking systems for...").

"5" (Basics/Summary):
- Target: Absolute beginner / Executive.
- Style: 1-2 sentence definition. "The One Thing You Need To Know".
- Content: Extremely high-level summary.

ORIGINAL CONTENT (Level 1):
{content}
"""

async def generate_variations(content: str) -> Dict[str, str]:
    tries = 0
    max_retries = 3
    base_delay = 20
    
    while tries < max_retries:
        try:
            # Backoff
            wait_time = base_delay * (tries + 1)
            print(f"    Waiting {wait_time}s...")
            await asyncio.sleep(wait_time)
            
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=BATCH_PROMPT.format(content=content),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"  # Force JSON if supported, otherwise prompt handles it
                )
            )
            
            text = response.text.replace('```json', '').replace('```', '').strip()
            data = json.loads(text)
            
            # Validate keys
            if all(k in data for k in ["2", "3", "4", "5"]):
                return data
            else:
                print(f"    Invalid JSON keys: {data.keys()}")
                tries += 1
                
        except Exception as e:
            print(f"    Error (try {tries+1}): {e}")
            tries += 1
            
    return {}

async def process_subtopics():
    seed_path = os.path.join("seed", "dbms_subtopics.json")
    if not os.path.exists(seed_path):
        print("Seed file not found.")
        return

    with open(seed_path, "r", encoding="utf-8") as f:
        subtopics = json.load(f)

    print(f"Loaded {len(subtopics)} subtopics. Starting Batch Generation...")

    updated_count = 0
    
    # Optional: Skip already processed ones if we want to resume?
    # For now, let's process all to ensure consistency.
    
    for i, sub in enumerate(subtopics):
        sub_id = sub.get('id')
        print(f"[{i+1}/{len(subtopics)}] Processing {sub_id}...")
        
        if "content_levels" not in sub:
            sub["content_levels"] = {}
            
        # Get base content
        base = sub.get("content") or sub["content_levels"].get("1")
        if not base:
             # Try to find any content
             base = list(sub["content_levels"].values())[0] if sub["content_levels"] else ""
             
        if not base:
             print("    No content found, skipping.")
             continue
             
        # Ensure Level 1 is preserved
        sub["content_levels"]["1"] = base
        
        # Generate others
        variations = await generate_variations(base)
        
        if variations:
            for k, v in variations.items():
                sub["content_levels"][k] = v
            print("    ✅ Success.")
            updated_count += 1
        else:
            print("    ❌ Failed to generate variations.")
            
        # Save every 2 items
        if i % 2 == 0:
             with open(seed_path, "w", encoding="utf-8") as f:
                json.dump(subtopics, f, indent=2)

    # Final save
    with open(seed_path, "w", encoding="utf-8") as f:
        json.dump(subtopics, f, indent=2)
    
    print(f"Done! Updated {updated_count} subtopics.")

if __name__ == "__main__":
    asyncio.run(process_subtopics())
