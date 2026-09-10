"""
Seed `intervention_logs` so the teacher dashboard's Live Intervention Feed
has realistic data.

Writes ~40 intervention events spread over the last 7 days, referencing
the demo cohort students and real subtopic IDs.

Usage:
    python scripts/data/seed_interventions.py
    python scripts/data/seed_interventions.py --wipe   # clear first
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "seed"
COHORT_PREFIX = "demo_cohort_"
ARMS = ["visual", "step", "example", "analogy", "easier", "harder"]


def _init():
    if firebase_admin._apps:
        return firestore.client()
    cred_path = str(ROOT / "backend" / "firebase-adminsdk.json")
    firebase_admin.initialize_app(credentials.Certificate(cred_path))
    return firestore.client()


def _load_subtopics():
    with open(SEED_DIR / "dbms_subtopics.json", encoding="utf-8") as f:
        return json.load(f)


def _wipe(db) -> int:
    deleted = 0
    q = db.collection("intervention_logs").where(
        field_path="user_id", op_string=">=", value=COHORT_PREFIX
    ).where(field_path="user_id", op_string="<", value=COHORT_PREFIX + "\uf8ff")
    for doc in q.stream():
        doc.reference.delete()
        deleted += 1
    return deleted


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wipe", action="store_true")
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--seed", type=int, default=99)
    args = parser.parse_args(argv)

    random.seed(args.seed)
    db = _init()
    subtopics = _load_subtopics()

    if args.wipe:
        deleted = _wipe(db)
        print(f"Wiped {deleted} prior intervention_logs.")

    now = datetime.now(timezone.utc)
    student_ids = [f"{COHORT_PREFIX}{i + 1:03d}" for i in range(12)]

    for _ in range(args.count):
        uid = random.choice(student_ids)
        st = random.choice(subtopics)
        days_back = random.randint(0, 6)
        ts = now - timedelta(
            days=days_back,
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )
        score = round(random.uniform(0.3, 0.95), 3)
        arm = random.choice(ARMS)

        db.collection("intervention_logs").add({
            "user_id": uid,
            "subtopic": st.get("title", st["id"]),
            "subtopic_id": st["id"],
            "confusion_score": score,
            "bandit_arm_selected": arm,
            "timestamp": ts,
        })

    print(f"Seeded {args.count} intervention_logs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
