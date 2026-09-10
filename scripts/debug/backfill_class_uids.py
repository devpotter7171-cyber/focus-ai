"""Backfill `student_uids` array on every classes/* doc from its members subcollection.

Idempotent. Run once after introducing the array-based denormalization.
"""
from __future__ import annotations

import os
import sys

import firebase_admin
from firebase_admin import credentials, firestore


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _init():
    if firebase_admin._apps:
        return firestore.client()
    cred_path = os.path.join(ROOT, "backend", "firebase-adminsdk.json")
    firebase_admin.initialize_app(credentials.Certificate(cred_path))
    return firestore.client()


def main() -> int:
    db = _init()
    classes = list(db.collection("classes").stream())
    for c in classes:
        members = list(c.reference.collection("members").stream())
        uids = sorted({m.id for m in members})
        c.reference.update({
            "student_uids": uids,
            "member_count": len(uids),
        })
        print(f"[ok] {c.id}: {len(uids)} members backfilled")
    return 0


if __name__ == "__main__":
    sys.exit(main())
