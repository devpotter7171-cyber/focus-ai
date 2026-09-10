
import sys
import os
import json
import asyncio
from typing import Dict, Any

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Load env vars manually because we are running as a script
from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

from google import genai
from google.genai import types

# Initialize GenAI
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("Error: GEMINI_API_KEY not found in backend/.env")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

LEVEL_PROMPTS = {
    "2": """
    Rewrite the technical content below to be **Simplified**. 
    - Target audience: A high school student or beginner.
    - Use simple language and clear analogies.
    - Avoid dense jargon; define terms simply if needed.
    - Keep the structure similar but make the text much more accessible.
    - Start with a clear "Analogies" section if applicable.
    """,
    "3": """
    Rewrite the technical content below to focus on **Key Points**.
    - Target audience: A student revising for an exam.
    - Format: Strictly use bullet points and bold text for key terms.
    - Remove long paragraphs.
    - Focus on facts, definitions, and relationships.
    """,
    "4": """
    Rewrite the technical content below to focus on **Real-world Examples and Application**.
    - Target audience: A practitioner or someone asking "Why do I need this?".
    - Focus on concrete scenarios, code snippets (if relevant), or business use cases.
    - Use a "Problem -> Solution" format.
    """,
    "5": """
    Rewrite the technical content below to be the **Absolute Basics**.
    - Target audience: A complete novice asking "What is this?".
    - Length: Very short, executive summary style.
    - Max 3-4 sentences/paragraphs.
    - Focus on the "One Big Idea".
    """
}

async def generate_level(content: str, level: str) -> str:
    prompt = f"""
    You are an expert educational content creator.
    
    {LEVEL_PROMPTS[level]}
    
    ORIGINAL CONTENT:
    {content}
    
    OUTPUT:
    """
    # List of models to try in order
    models_to_try = ['models/gemini-1.5-flash', 'models/gemini-2.0-flash-exp', 'gemini-1.5-flash']
    
    for model_name in models_to_try:
        try:
            # Add a delay
            await asyncio.sleep(5)
            
            print(f"    Trying model: {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"    Failed with {model_name}: {e}")
            await asyncio.sleep(1)
            continue
            
    print(f"Error: All models failed for level {level}")
    return content


async def process_subtopics():
    seed_path = os.path.join("seed", "dbms_subtopics.json")
    if not os.path.exists(seed_path):
        print(f"Seed file not found at {seed_path}")
        return

    with open(seed_path, "r", encoding="utf-8") as f:
        subtopics = json.load(f)

    print(f"Loaded {len(subtopics)} subtopics. Starting generation...")

    updated_count = 0
    
    for i, sub in enumerate(subtopics):
        print(f"Processing {i+1}/{len(subtopics)}: {sub.get('id')}...")
        
        # Ensure content_levels exists
        if "content_levels" not in sub:
            sub["content_levels"] = {}
            
        base_content = sub.get("content", "")
        if not base_content and "1" in sub["content_levels"]:
            base_content = sub["content_levels"]["1"]
        
        if not base_content:
            print(f"Skipping {sub.get('id')} - No base content found.")
            continue

        # Ensure Level 1 is set
        sub["content_levels"]["1"] = base_content
        
        # Generate Levels 2-5
        for level in ["2", "3", "4", "5"]:
            # Check if we should regenerate. 
            # Heuristic: If content starts with "# (Level X: ...)" and matches base content length roughly, it's likely a duplicate.
            # Or just force generate for all to ensure "considerable amount apart".
            print(f"  - Generating Level {level}...")
            new_content = await generate_level(base_content, level)
            sub["content_levels"][level] = new_content
            
        updated_count += 1
        
        # Save intermediate progress every 5 items
        if updated_count % 5 == 0:
             with open(seed_path, "w", encoding="utf-8") as f:
                json.dump(subtopics, f, indent=2)
             print("  (Saved progress)")

    # Final save
    with open(seed_path, "w", encoding="utf-8") as f:
        json.dump(subtopics, f, indent=2)
    
    print("Done! All subtopics updated.")

if __name__ == "__main__":
    asyncio.run(process_subtopics())
