"""
Seed a synthetic demo cohort so the teacher dashboard's M4 (Cohort
Competency Map), L4 (Confusion Timeline) and the risk endpoints all
have realistic data to render.

What it writes per student
  • users/{uid}                       basic profile, role=student
  • users/{uid}/mastery/{skill}        BKT-style p_mastery + attempts
  • users/{uid}/progress/{subtopic}    completed-subtopic markers
  • quiz_results/{auto}                quiz attempts spread over the
                                       last 30 days
  • behavior_logs/{auto}               recent activity ping
  • confusion_events/{auto}            sample confusion events
                                       distributed across subtopics
                                       (powers the L4 timeline)

Three persona buckets so the dashboards have visible variance:
  • 4 high performers   (avg mastery ~ 80 %)
  • 4 mid performers    (avg mastery ~ 55 %)
  • 4 strugglers        (avg mastery ~ 30 %)

Usage
  python scripts/data/seed_demo_cohort.py            # writes 12 students
  python scripts/data/seed_demo_cohort.py --wipe     # wipes them first
  python scripts/data/seed_demo_cohort.py --count 6  # writes 6
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

# Cohort prefix — every demo user id starts with this so --wipe is targeted.
COHORT_PREFIX = "demo_cohort_"

PROFILE_BUCKETS = [
    # (label, mastery_mean, mastery_stddev, accuracy_pct, confusion_rate)
    ("high",   0.82, 0.08, 88, 0.05),
    ("mid",    0.55, 0.12, 64, 0.20),
    ("strug",  0.30, 0.10, 42, 0.45),
]

ARMS = ["visual", "step", "example", "analogy", "easier", "harder"]


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
        firebase_admin.initialize_app()  # ADC
    return firestore.client()


def _load_subtopics() -> list[dict]:
    with open(SEED_DIR / "dbms_subtopics.json", encoding="utf-8") as f:
        return json.load(f)


def _load_questions() -> list[dict]:
    with open(SEED_DIR / "dbms_questions.json", encoding="utf-8") as f:
        return json.load(f)


def _persona_for(idx: int):
    """Round-robin persona selection so all three buckets are populated."""
    return PROFILE_BUCKETS[idx % len(PROFILE_BUCKETS)]


def _wipe_cohort(db) -> int:
    """Best-effort delete of any prior demo cohort docs. Returns count."""
    deleted = 0
    users_q = (
        db.collection("users")
        .where(field_path="role", op_string="==", value="student")
    )
    for doc in users_q.stream():
        if not doc.id.startswith(COHORT_PREFIX):
            continue
        # Delete subcollections we wrote into.
        for sub_name in ("mastery", "progress", "flashcard_progress"):
            for sub in (
                db.collection("users")
                .document(doc.id)
                .collection(sub_name)
                .stream()
            ):
                sub.reference.delete()
        doc.reference.delete()
        deleted += 1

    # Delete the telemetry rows we wrote.
    for coll in ("quiz_results", "behavior_logs", "confusion_events"):
        q = db.collection(coll).where(
            field_path="user_id", op_string=">=", value=COHORT_PREFIX
        ).where(field_path="user_id", op_string="<", value=COHORT_PREFIX + "\uf8ff")
        for doc in q.stream():
            doc.reference.delete()

    return deleted


def _seed_user(db, uid: str, persona, subtopics: list[dict], questions: list[dict]):
    label, m_mean, m_std, acc_pct, conf_rate = persona

    # 1. user doc
    db.collection("users").document(uid).set({
        "id": uid,
        "email": f"{uid}@focus-ai.demo",
        "full_name": uid.replace("_", " ").title(),
        "role": "student",
        "profile_segment": label.title(),
        "created_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)

    # 2. per-skill mastery + completed-progress markers
    for st in subtopics:
        skill = st["id"]
        unit_id = st.get("unit_id", "u1")
        # Sample around the persona mean, clip to [0.05, 0.99]
        m = max(0.05, min(0.99, random.gauss(m_mean, m_std)))
        attempts = random.randint(2, 12) if m > 0.4 else random.randint(1, 6)

        db.collection("users").document(uid).collection("mastery").document(skill).set({
            "skill": skill,
            "p_mastery": round(m, 3),
            "attempts": attempts,
            "last_updated": firestore.SERVER_TIMESTAMP,
        })

        # Mark roughly the persona-appropriate share as completed.
        if random.random() < (m_mean + 0.1):
            db.collection("users").document(uid).collection("progress").document(skill).set({
                "course_id": "dbms",
                "unit_id": unit_id,
                "subtopic_id": skill,
                "completed_at": firestore.SERVER_TIMESTAMP,
            })

    # 3. quiz results spread over the last 30 days
    now = datetime.now(timezone.utc)
    quiz_count = random.randint(8, 18)
    for i in range(quiz_count):
        st = random.choice(subtopics)
        days_back = random.randint(0, 29)
        ts = now - timedelta(days=days_back, hours=random.randint(0, 23))
        total = random.randint(5, 8)
        # Score correlated with persona accuracy.
        base = acc_pct / 100
        success = max(0, min(total, int(round(random.gauss(base, 0.15) * total))))
        time_ms = random.randint(60_000, 360_000)
        db.collection("quiz_results").add({
            "user_id": uid,
            "subtopic_id": st["id"],
            "subtopic_title": st.get("title"),
            "unit_id": st.get("unit_id"),
            "score": success,
            "total_questions": total,
            "percentage": round(success / max(1, total) * 100, 1),
            "metrics": {
                "total_time_ms": time_ms,
                "attempts": random.randint(1, 3),
            },
            "timestamp": ts,
        })

    # 4. behavior_logs ping (so the active-students cutoff sees them)
    db.collection("behavior_logs").add({
        "user_id": uid,
        "event_type": "behavior_snapshot",
        "data": {
            "screen": random.choice(subtopics)["id"],
            "hesitation_ms": random.randint(500, 9000),
            "tab_switches": random.randint(0, 4),
            "scroll_depth": random.randint(20, 100),
            "time_ms": random.randint(15_000, 240_000),
            "attempts": random.randint(1, 4),
            "wrong_option_hover_count": random.randint(0, 5),
        },
        "timestamp": now - timedelta(hours=random.randint(0, 12)),
    })

    # 5. confusion_events scattered across subtopics for the L4 timeline.
    # Strugglers produce more events with higher scores.
    n_events = max(2, int(random.expovariate(1 / max(1.5, conf_rate * 12))))
    n_events = min(n_events, 15)
    eligible_questions = [q for q in questions if q.get("subtopic_id")]
    for _ in range(n_events):
        days_back = random.randint(0, 29)
        ts = now - timedelta(
            days=days_back,
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )
        # Pick a question; prefer subtopics where the student is weak.
        q = random.choice(eligible_questions)
        score = max(
            0.05,
            min(0.99, random.gauss(0.4 + conf_rate, 0.2)),
        )
        db.collection("confusion_events").add({
            "user_id": uid,
            "subtopic_id": q.get("subtopic_id", "intro-to-database-systems"),
            "question_id": q.get("id", "unknown"),
            "confusion_score": round(score, 3),
            "metrics": {
                "hesitation_ms": random.randint(2000, 12000),
                "tab_switches": random.randint(0, 5),
                "wrong_option_hover_count": random.randint(0, 4),
                "attempts": random.randint(1, 4),
            },
            "timestamp": ts,
            "human_readable_time": ts.isoformat(),
        })


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--count",
        type=int,
        default=12,
        help="Number of demo students to seed (default: 12).",
    )
    parser.add_argument(
        "--wipe",
        action="store_true",
        help="Delete any prior demo cohort docs before seeding.",
    )
    parser.add_argument("--seed", type=int, default=42, help="RNG seed.")
    args = parser.parse_args(argv)

    random.seed(args.seed)
    db = _init_firebase()
    subtopics = _load_subtopics()
    questions = _load_questions()

    if args.wipe:
        deleted = _wipe_cohort(db)
        print(f"Wiped {deleted} prior demo students.")

    if args.count <= 0:
        print("Nothing to seed.")
        return 0

    print(f"Seeding {args.count} demo cohort students...")
    for i in range(args.count):
        uid = f"{COHORT_PREFIX}{i + 1:03d}"
        persona = _persona_for(i)
        try:
            _seed_user(db, uid, persona, subtopics, questions)
            print(f"  [ok] {uid} ({persona[0]})")
        except Exception as exc:  # noqa: BLE001
            print(f"  [fail] {uid}: {exc}", file=sys.stderr)

    print("\nDone. Open /teacher/dashboard to see the cohort views populate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
