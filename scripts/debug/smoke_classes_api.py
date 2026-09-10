"""Smoke test the new /classes API + role-aware /auth/me.

Signs in as the bootstrapped faculty + a brand-new throw-away student,
exercises the join flow, then deletes the student so the test is idempotent.
"""
from __future__ import annotations

import os
import sys
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import firebase_admin  # noqa: E402
from firebase_admin import auth as fb_auth, credentials  # noqa: E402

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000/api/v1")
WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "")  # set via env, never hardcode
FACULTY_EMAIL = os.getenv("SMOKE_FACULTY_EMAIL", "")
FACULTY_PASSWORD = os.getenv("SMOKE_FACULTY_PASSWORD", "")
STUDENT_EMAIL = os.getenv("SMOKE_STUDENT_EMAIL", "smoke-student@focus-ai.demo")
STUDENT_PASSWORD = os.getenv("SMOKE_STUDENT_PASSWORD", "smoke123")


def _init_admin():
    if firebase_admin._apps:
        return
    cred_path = os.path.join(ROOT, "backend", "firebase-adminsdk.json")
    firebase_admin.initialize_app(credentials.Certificate(cred_path))


def _password_sign_in(email: str, password: str) -> str:
    """Use the Identity Toolkit REST API to swap email/password for an ID token."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={WEB_API_KEY}"
    r = requests.post(
        url,
        json={"email": email, "password": password, "returnSecureToken": True},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["idToken"]


def _ensure_student():
    try:
        u = fb_auth.get_user_by_email(STUDENT_EMAIL)
        fb_auth.update_user(u.uid, password=STUDENT_PASSWORD, email_verified=True)
    except fb_auth.UserNotFoundError:
        u = fb_auth.create_user(
            email=STUDENT_EMAIL,
            password=STUDENT_PASSWORD,
            display_name="Smoke Student",
            email_verified=True,
        )
    return u.uid


def _delete_student(uid: str):
    try:
        fb_auth.delete_user(uid)
    except Exception:
        pass


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main() -> int:
    _init_admin()
    student_uid = _ensure_student()

    # Wait briefly for any propagation just in case.
    time.sleep(1)

    teacher_token = _password_sign_in(FACULTY_EMAIL, FACULTY_PASSWORD)
    student_token = _password_sign_in(STUDENT_EMAIL, STUDENT_PASSWORD)

    # 1. Sync the student so they have a Firestore profile (mirrors what the
    #    AuthContext does on first sign-in).
    r = requests.post(
        f"{API_BASE}/auth/sync-user",
        json={"id_token": student_token, "full_name": "Smoke Student"},
        timeout=15,
    )
    r.raise_for_status()
    print("[ok] /auth/sync-user (student) ->", r.json())

    # 2. /auth/me for both
    me_t = requests.get(f"{API_BASE}/auth/me", headers=_h(teacher_token), timeout=15).json()
    me_s = requests.get(f"{API_BASE}/auth/me", headers=_h(student_token), timeout=15).json()
    print("[ok] /auth/me teacher ->", me_t)
    print("[ok] /auth/me student ->", me_s)
    assert me_t["role"] == "teacher", "Teacher role missing!"
    assert me_s["role"] == "student", "Student role unexpectedly elevated!"

    # 3. Teacher lists their classes
    owned = requests.get(f"{API_BASE}/classes/me", headers=_h(teacher_token), timeout=15).json()
    print("[ok] /classes/me teacher ->", {"role": owned["role"], "owned_count": len(owned["owned"])})
    assert owned["owned"], "Faculty should own at least one class from bootstrap"
    cls = owned["owned"][0]
    join_code = cls["join_code"]

    # 4. Student tries forbidden teacher route
    r = requests.post(
        f"{API_BASE}/classes",
        headers=_h(student_token),
        json={"name": "Should fail"},
        timeout=15,
    )
    print("[ok] student create-class blocked:", r.status_code, r.json())
    assert r.status_code == 403

    # 5. Student joins with the code
    r = requests.post(
        f"{API_BASE}/classes/join",
        headers=_h(student_token),
        json={"code": join_code},
        timeout=15,
    )
    r.raise_for_status()
    print("[ok] student joined:", r.json())

    # 6. Student lists joined classes
    joined = requests.get(f"{API_BASE}/classes/me", headers=_h(student_token), timeout=15).json()
    print("[ok] /classes/me student ->", {
        "joined_count": len(joined["joined"]),
        "first": joined["joined"][0]["name"] if joined["joined"] else None,
    })
    assert any(c["id"] == cls["id"] for c in joined["joined"]), "Student missing from their own join list"

    # 7. Teacher sees the student in the roster
    roster = requests.get(
        f"{API_BASE}/classes/{cls['id']}/students",
        headers=_h(teacher_token),
        timeout=15,
    ).json()
    found = next((s for s in roster["students"] if s["user_id"] == student_uid), None)
    print("[ok] student visible in roster:", bool(found), "; total:", roster["count"])
    assert found is not None, "Student missing from roster"

    # 8. Teacher kicks the student
    r = requests.delete(
        f"{API_BASE}/classes/{cls['id']}/students/{student_uid}",
        headers=_h(teacher_token),
        timeout=15,
    )
    r.raise_for_status()
    print("[ok] teacher removed student:", r.json())

    print("\n🎉  All class API smoke tests passed.")
    _delete_student(student_uid)
    return 0


if __name__ == "__main__":
    sys.exit(main())
