"""
One-shot faculty bootstrap.

Creates / upgrades a Firebase Auth user, sets their Firestore
``users/{uid}.role = "teacher"``, then creates a default class and
auto-enrols every demo cohort student (`demo_cohort_*`) so the
teacher views light up immediately.

Usage:
    python scripts/data/bootstrap_faculty.py \
        --email faculty@example.com \
        --password your-password \
        --name "Faculty Demo"

Re-running is safe — existing user / class will be reused.
"""
from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import auth as fb_auth, credentials, firestore
from firebase_admin.exceptions import FirebaseError

ROOT = Path(__file__).resolve().parents[2]

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
COHORT_PREFIX = "demo_cohort_"


def _init_firebase():
    if firebase_admin._apps:
        return firestore.client()
    candidates = [
        os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
        str(ROOT / "backend" / "firebase-adminsdk.json"),
        str(ROOT / "firebase-adminsdk.json"),
    ]
    cred_path = next((p for p in candidates if p and os.path.exists(p)), None)
    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
    return firestore.client()


def _new_join_code(n: int = 6) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(n))


def _ensure_auth_user(email: str, password: str, name: str):
    """Get-or-create the Firebase Auth user with the requested password."""
    try:
        user = fb_auth.get_user_by_email(email)
        # Reset password / profile to the requested values so the script is
        # idempotent.
        fb_auth.update_user(
            user.uid,
            password=password,
            display_name=name,
            email_verified=True,
            disabled=False,
        )
        print(f"[auth] reused existing Firebase user {user.uid} ({email}); "
              f"password / display name reset.")
        return user.uid
    except fb_auth.UserNotFoundError:
        new_user = fb_auth.create_user(
            email=email,
            password=password,
            display_name=name,
            email_verified=True,
        )
        print(f"[auth] created Firebase user {new_user.uid} ({email})")
        return new_user.uid
    except FirebaseError as e:
        print(f"[auth] FirebaseError: {e}", file=sys.stderr)
        raise


def _ensure_user_doc(db, uid: str, email: str, name: str):
    ref = db.collection("users").document(uid)
    snap = ref.get()
    payload = {
        "id": uid,
        "email": email,
        "full_name": name,
        "role": "teacher",
    }
    if snap.exists:
        ref.update(payload)
        print(f"[firestore] updated users/{uid} → role=teacher")
    else:
        payload["created_at"] = firestore.SERVER_TIMESTAMP
        ref.set(payload)
        print(f"[firestore] created users/{uid} (role=teacher)")


def _ensure_default_class(db, owner_uid: str, owner_name: str, owner_email: str):
    """Find or create a class owned by this teacher with name 'DBMS - Section A'."""
    q = (
        db.collection("classes")
          .where(field_path="owner_uid", op_string="==", value=owner_uid)
          .where(field_path="name", op_string="==", value="DBMS - Section A")
          .limit(1)
          .stream()
    )
    existing = next(iter(q), None)
    if existing is not None:
        meta = existing.to_dict() or {}
        print(f"[class] reused existing class {existing.id} "
              f"(join code {meta.get('join_code')})")
        return existing.reference, meta.get("join_code")

    code = _new_join_code()
    class_id = "cls_" + secrets.token_hex(4)
    ref = db.collection("classes").document(class_id)
    ref.set({
        "id": class_id,
        "name": "DBMS - Section A",
        "description": "Auto-created demo class for faculty bootstrap.",
        "course_id": "dbms",
        "owner_uid": owner_uid,
        "owner_name": owner_name,
        "owner_email": owner_email,
        "join_code": code,
        "member_count": 0,
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    print(f"[class] created {class_id} with join code {code}")
    return ref, code


def _enrol_demo_cohort(db, class_ref) -> int:
    """Add every demo cohort student to the class as a member."""
    members_col = class_ref.collection("members")
    enrolled = 0

    cohort_q = (
        db.collection("users")
          .where(field_path="role", op_string="==", value="student")
          .stream()
    )
    for udoc in cohort_q:
        if not udoc.id.startswith(COHORT_PREFIX):
            continue
        if members_col.document(udoc.id).get().exists:
            continue
        u = udoc.to_dict() or {}
        members_col.document(udoc.id).set({
            "user_id": udoc.id,
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "joined_at": firestore.SERVER_TIMESTAMP,
        })
        enrolled += 1

    if enrolled:
        class_ref.update({"member_count": firestore.Increment(enrolled)})
    print(f"[class] auto-enrolled {enrolled} demo cohort students")
    return enrolled


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Faculty Demo")
    args = parser.parse_args(argv)

    db = _init_firebase()

    uid = _ensure_auth_user(args.email, args.password, args.name)
    _ensure_user_doc(db, uid, args.email, args.name)
    class_ref, join_code = _ensure_default_class(db, uid, args.name, args.email)
    _enrol_demo_cohort(db, class_ref)

    print()
    print("✅  Faculty bootstrap complete.")
    print(f"     email:     {args.email}")
    print(f"     password:  {args.password}")
    print(f"     uid:       {uid}")
    print(f"     class id:  {class_ref.id}")
    print(f"     join code: {join_code}")
    print()
    print("Sign in at /login → you'll be routed to /teacher/dashboard.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
