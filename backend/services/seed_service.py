"""
Backend Service: Seed Service

Seeds the database and Firestore with DBMS course content.
"""
import json
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from .env file (ensure relative path is correct)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

# Path to seed files
SEED_DIR = Path(__file__).parent.parent.parent / "seed"


def load_json(filename: str) -> list:
    """Load JSON file from seed directory."""
    filepath = SEED_DIR / filename
    if not filepath.exists():
        logger.warning(f"Seed file not found: {filepath}")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def seed_units():
    """Seed course units."""
    units = load_json("dbms_units.json")
    logger.info(f"Seeding {len(units)} units...")
    
    # In production, would insert into database/Firestore
    for unit in units:
        logger.debug(f"  Unit: {unit.get('id', 'unknown')}")
    
    return units


def seed_subtopics():
    """Seed subtopics for each unit."""
    subtopics = load_json("dbms_subtopics.json")
    logger.info(f"Seeding {len(subtopics)} subtopics...")
    
    for subtopic in subtopics:
        logger.debug(f"  Subtopic: {subtopic.get('id', 'unknown')}")
    
    return subtopics


def seed_questions():
    """Seed quiz questions."""
    questions = load_json("dbms_questions.json")
    logger.info(f"Seeding {len(questions)} questions...")
    
    # Validate textbook references
    allowed_references = [
        "Elmasri & Navathe",
        "Pramod J Sadalage & Martin Fowler",
        "Raghu Ramakrishnan & Johannes Gehrke",
        "Seema Acharya"
    ]
    
    for q in questions:
        ref = q.get("textbook_reference", "")
        if ref and ref not in allowed_references:
            logger.warning(f"  Invalid textbook reference: {ref}")
    
    return questions


def seed_to_firestore(questions: list, units: list, subtopics: list):
    """
    Seed data to Firestore.
    
    Note: Requires firebase-admin to be configured.
    Falls back gracefully if not available.
    """
    print("DEBUG: Entering seed_to_firestore...")
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase if not already done
        if not firebase_admin._apps:
            # Check multiple paths for credentials
            current_dir = os.getcwd()
            possible_paths = [
                os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
                "firebase-adminsdk.json",
                "backend/firebase-adminsdk.json",
                os.path.join(current_dir, "backend", "firebase-adminsdk.json"),
                os.path.join(Path(__file__).parent.parent, "firebase-adminsdk.json")
            ]
            cred_path = next((p for p in possible_paths if p and os.path.exists(p)), None)

            if cred_path:
                print(f"DEBUG: Found credentials at {cred_path}")
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                # Fallback to Application Default Credentials (ADC)
                logger.info("Credential file not found. Attempting Default Credentials...")
                firebase_admin.initialize_app()
        
        db = firestore.client()
        print("DEBUG: Client obtained. Writing Course Root...")
        
        # Seed Course Root Document
        course_ref = db.collection("courses").document("dbms")
        course_ref.set({
            "id": "dbms",
            "title": "Database Management Systems",
            "description": "Master the fundamentals of database design, SQL, normalization, and optimization.",
            "total_units": len(units),
            "created_at": firestore.SERVER_TIMESTAMP
        }, merge=True)
        print("DEBUG: Course Root written.")

        # Seed units
        print(f"DEBUG: Seeding {len(units)} units...")
        for unit in units:
            unit_ref = db.collection("courses").document("dbms").collection("units").document(unit["id"])
            unit_ref.set(unit)
        print("DEBUG: Units written.")
        
        # Seed subtopics
        print(f"DEBUG: Seeding {len(subtopics)} subtopics...")
        for subtopic in subtopics:
            unit_id = subtopic.get("unit_id", "u1")
            subtopic_ref = (db.collection("courses")
                          .document("dbms")
                          .collection("units")
                          .document(unit_id)
                          .collection("subtopics")
                          .document(subtopic["id"]))
            subtopic_ref.set(subtopic)
        
        # Seed questions
        logger.info(f"Writing {len(questions)} questions to Firestore...")
        for i, question in enumerate(questions):
            if i % 5 == 0:
                logger.info(f"  Writing question {i+1}/{len(questions)}: {question['id']}")
            q_ref = db.collection("quiz").document("dbms").collection("questions").document(question["id"])
            q_ref.set(question)

        # Seed Demo User (Critical for Dev)
        try:
            demo_ref = db.collection("users").document("demo_user")
            demo_ref.set({
                "id": "demo_user",
                "email": "demo@focus-ai.com",
                "full_name": "Demo Student",
                "role": "student",
                "profile_segment": "Explorer",
                "created_at": firestore.SERVER_TIMESTAMP
            }, merge=True) # Merge to match upsert behavior
            logger.info("Seeded 'demo_user' to Firestore.")
        except Exception as e:
            logger.warning(f"Failed to seed demo_user: {e}")
        
        logger.info("Firestore seeding complete!")
        return True
        
    except ImportError:
        logger.warning("firebase-admin not installed. Skipping Firestore seeding.")
        return False
    except Exception as e:
        logger.error(f"Firestore seeding failed: {e}")
        return False





def seed_all():
    """
    Run Data Seeding (Firestore Only).
    """
    logger.info("=" * 50)
    logger.info("Starting Focus-AI Data Seeding (Firestore)")
    logger.info("=" * 50)
    
    # Load all data
    units = seed_units()
    subtopics = seed_subtopics()
    questions = seed_questions()
    
    # Seed to Firestore
    firestore_ok = seed_to_firestore(questions, units, subtopics)
    
    # Summary
    logger.info("=" * 50)
    logger.info("Seeding Summary:")
    logger.info(f"  Units: {len(units)}")
    logger.info(f"  Subtopics: {len(subtopics)}")
    logger.info(f"  Questions: {len(questions)}")
    logger.info(f"  Firestore: {'OK' if firestore_ok else 'FAILED'}")
    logger.info("=" * 50)
    
    return {
        "units": len(units),
        "subtopics": len(subtopics),
        "questions": len(questions),
        "firestore": firestore_ok
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_all()
