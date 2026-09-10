
import json
import os

PATCH_DATA = {
    "refining-er-design": {
        "2": """
# Refining ER Design (Simplified)

Drawing diagrams is like writing an essay. The first draft is usually bad.

### Common Mistakes
1.  **Redundancy**: Drawing connections that are obvious.
    *   *Bad*: Student -> goes to -> Class. Class -> is in -> School. Student -> goes to -> School.
    *   *Fix*: Delete the last arrow. It's implied.
2.  **Attribute or Entity?**:
    *   Is "Address" just a text box (Attribute)?
    *   Or is "Address" a real place with its own rules (Entity)?
    *   *Rule of Thumb*: If it has its own properties (like `City`, `Zip`), make it an Entity.
""",
        "3": """
# Refining ER Schemas

### Design Traps
1.  **Fan Traps**: Ambiguity in path linkage. (e.g. Which Division does this Staff member work for?).
2.  **Chasm Traps**: Pathway does not exist between related entities.

### Entity vs Attribute
*   Model a concept as an **Attribute** if it has no properties of its own.
*   Model as **Entity** if it has descriptive info.

### Naming
*   Entities: Singular (Employee).
*   Relationships: Active Verb (Manages).
""",
        "4": """
# ER Refinement in Practice

### The "Address" Dilemma
*   **Simple App**: Address is just a string `VARCHAR(255)`.
*   **Logistics App**: Address is an Entity (Street, City, Geo-coords).
    *   Why? Because one Address might have multiple Companies (Business Park).
    *   We need to query "All companies in this Zip Code".

### Normalization begins here
Refining the ER diagram often unknowingly performs early Normalization (removing repeated groups).
""",
        "5": """
# Refining Design: The Basics

**Polishing the Blueprint.**

Before building, we double check:
1.  Are there too many lines? (Confusing).
2.  Did we forget something?
3.  Did we name things correctly?
"""
    }
}

def patch_file():
    seed_path = os.path.join("seed", "dbms_subtopics.json")
    print(f"Reading {seed_path}...")
    
    with open(seed_path, "r", encoding="utf-8") as f:
        subtopics = json.load(f)
        
    updated_count = 0
    
    for sub in subtopics:
        sid = sub.get("id")
        if sid in PATCH_DATA:
            print(f"Patching {sid}...")
            if "content_levels" not in sub:
                sub["content_levels"] = {}
                
            # Apply patches for levels 2,3,4,5
            for lvl, content in PATCH_DATA[sid].items():
                sub["content_levels"][lvl] = content
                
            updated_count += 1
            
    print(f"Updated {updated_count} subtopics.")
    
    with open(seed_path, "w", encoding="utf-8") as f:
        json.dump(subtopics, f, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    patch_file()
