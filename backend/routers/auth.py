import firebase_admin  # noqa: F401  (kept for downstream callers that import this module first)
from firebase_admin import auth, credentials, firestore  # noqa: F401
from fastapi import APIRouter, HTTPException, status, Depends  # noqa: F401
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import os  # noqa: F401
import logging
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Pydantic models ────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    id_token: str


class UserSyncRequest(BaseModel):
    id_token: str
    full_name: str | None = None


# ─── Auth helpers ───────────────────────────────────────────────────────────

# Bearer-token security scheme. Declared up front so every route below
# can use it as a `Depends(security)` argument.
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Decode + verify a Firebase ID token from the Authorization header."""
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.warning(f"Unauthorized access attempt: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


def require_teacher(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
):
    """FastAPI dependency that allows only role=teacher or role=admin users."""
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception as e:
        logger.warning(f"require_teacher token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    doc = db.collection("users").document(uid).get()
    role = (doc.to_dict() or {}).get("role", "student") if doc.exists else "student"
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher access required")
    return {"uid": uid, "email": decoded.get("email"), "role": role}


# ─── Routes ─────────────────────────────────────────────────────────────────


@router.post("/verify-token")
async def verify_login(request: LoginRequest):
    try:
        decoded_token = auth.verify_id_token(request.id_token)
        uid = decoded_token["uid"]
        return {"uid": uid, "status": "verified"}
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")


@router.post("/sync-user")
async def sync_user_profile(
    request: UserSyncRequest,
    db=Depends(get_db),
):
    """
    Sync the Firebase user to Firestore.

    - First-time login: creates the doc with role="student" by default.
    - Subsequent logins: only updates email / full_name. Never overwrites
      `role` once it's been set, so promoting a user to teacher / admin
      via the admin SDK or another tool actually sticks.
    """
    try:
        decoded_token = auth.verify_id_token(request.id_token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email")

        user_ref = db.collection("users").document(uid)
        existing = user_ref.get()

        if existing.exists:
            update_data = {"email": email}
            if request.full_name:
                update_data["full_name"] = request.full_name
            user_ref.update(update_data)
        else:
            user_data = {
                "id": uid,
                "email": email,
                "role": "student",
                "onboarding_completed": False,
                "experience_level": None,
                "initial_content_level": None,
            }
            if request.full_name:
                user_data["full_name"] = request.full_name
            user_ref.set(user_data)

        doc = user_ref.get()
        user = doc.to_dict() or {}
        return {
            "status": "synced",
            "user": {
                "id": user.get("id"),
                "role": user.get("role", "student"),
            },
        }

    except Exception as e:
        logger.error(f"User sync failed: {e}")
        raise HTTPException(status_code=401, detail=f"Sync failed: {str(e)}")


class OnboardingCompleteRequest(BaseModel):
    experience_level: str  # "beginner" | "intermediate" | "advanced"
    diagnostic_score: int  # 0-5
    diagnostic_total: int  # 5
    initial_content_level: int  # 1-5 (calculated from diagnostic)


@router.post("/complete-onboarding")
async def complete_onboarding(
    body: OnboardingCompleteRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
):
    """
    Mark onboarding as complete and store the user's initial content level.
    Called after the diagnostic quiz.
    """
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_ref = db.collection("users").document(uid)

    def _update():
        user_ref.update({
            "onboarding_completed": True,
            "experience_level": body.experience_level,
            "initial_content_level": body.initial_content_level,
            "diagnostic_score": body.diagnostic_score,
            "diagnostic_total": body.diagnostic_total,
            "onboarded_at": firestore.SERVER_TIMESTAMP,
        })

    await run_in_threadpool(_update)

    return {
        "status": "completed",
        "initial_content_level": body.initial_content_level,
        "experience_level": body.experience_level,
    }


@router.get("/me")
async def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
):
    """
    Return the Firestore profile (incl. role) for the currently signed-in
    user. Frontend uses this for role-aware redirects (student → /dashboard,
    teacher → /teacher/dashboard) and sidebar toggling.
    """
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception as e:
        logger.warning(f"/auth/me token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return {
            "id": uid,
            "email": decoded.get("email"),
            "full_name": decoded.get("name"),
            "role": "student",
            "onboarding_completed": False,
        }
    data = doc.to_dict() or {}
    return {
        "id": data.get("id", uid),
        "email": data.get("email", decoded.get("email")),
        "full_name": data.get("full_name"),
        "role": data.get("role", "student"),
        "profile_segment": data.get("profile_segment"),
        "onboarding_completed": data.get("onboarding_completed", True),  # Existing users default to True
        "experience_level": data.get("experience_level"),
        "initial_content_level": data.get("initial_content_level"),
    }
