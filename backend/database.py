import firebase_admin
from firebase_admin import credentials, firestore
import os
import logging
import warnings
from functools import lru_cache

logger = logging.getLogger(__name__)

# Suppress the google-cloud-firestore positional-arg deprecation warning.
# We use field_path/op_string/value kwargs which still work fine; the new
# FieldFilter API is a cosmetic migration we'll do later.
warnings.filterwarnings(
    "ignore",
    message="Detected filter using positional arguments",
    category=UserWarning,
    module="google.cloud.firestore",
)

# Initialize Firebase App (Idempotent)
try:
    if not firebase_admin._apps:
        # Robust credential search
        current_dir = os.getcwd()
        possible_paths = [
            os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
            "firebase-adminsdk.json",
            "backend/firebase-adminsdk.json",
            os.path.join(current_dir, "firebase-adminsdk.json"),
            os.path.join(current_dir, "backend", "firebase-adminsdk.json"),
            os.path.join(os.path.dirname(__file__), "firebase-adminsdk.json"),
        ]
        cred_path = next((p for p in possible_paths if p and os.path.exists(p)), None)

        if cred_path:
            logger.info(f"Loading credentials from: {cred_path}")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            logger.warning("No credential file found. Trying Default Credentials (ADC)...")
            firebase_admin.initialize_app()
except Exception as e:
    logger.error(f"Firebase Init Error: {e}")
    # Continue only if already initialized (unexpected)
    if not firebase_admin._apps:
        raise e

# Global Firestore client cache
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.client()
    return _firestore_client

# Dependency for FastAPI
def get_db():
    """
    Returns the Firestore Client.
    mimics the 'get_db' signature for dependency injection, 
    but yields a client instead of a session.
    """
    db = get_firestore_client()
    yield db
