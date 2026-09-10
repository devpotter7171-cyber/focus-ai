import json
import os

SEED_FILE = "seed/dbms_subtopics.json"

def migrate():
    if not os.path.exists(SEED_FILE):
        print(f"Error: {SEED_FILE} not found.")
        return

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_count = 0
    for item in data:
        if "content_levels" not in item:
            original_content = item.get("content", "")
            
            # Create 5 levels
            # Level 1: Original (Textbook)
            # Level 2: Simplified
            # Level 3: Bullet points
            # Level 4: Visuals
            # Level 5: ELI5
            
            item["content_levels"] = {
                "1": original_content,
                "2": f"# (Level 2: Simplified)\n\n{original_content}",
                "3": f"# (Level 3: Key Points)\n\n{original_content}",
                "4": f"# (Level 4: Visuals)\n\n{original_content}",
                "5": f"# (Level 5: Basics)\n\n{original_content}"
            }
            updated_count += 1

    with open(SEED_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

    print(f"Migrated {updated_count} subtopics in {SEED_FILE}.")

if __name__ == "__main__":
    migrate()
