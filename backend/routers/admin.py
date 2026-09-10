from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
import time
from pypdf import PdfReader
import io
from services.course_gen_service import course_gen_service, CourseGenProgress
from services.seed_service import seed_all
from database import get_db
from starlette.concurrency import run_in_threadpool
from firebase_admin import firestore

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Simple in-memory cache (same pattern as courses.py) ────────────────────

_ADMIN_CACHE: Dict[str, Dict[str, Any]] = {}
_ADMIN_CACHE_TTL = 120  # 2 minutes — admin data is less volatile


def _get_admin_cache(key: str):
    entry = _ADMIN_CACHE.get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > _ADMIN_CACHE_TTL:
        del _ADMIN_CACHE[key]
        return None
    return entry["data"]


def _set_admin_cache(key: str, data: Any):
    _ADMIN_CACHE[key] = {"data": data, "ts": time.time()}


@router.post("/seed")
async def seed_demo_data():
    """
    Seed the Firestore database with the bundled DBMS course content.
    Wraps services.seed_service.seed_all() in a threadpool because the
    underlying Firestore writes are synchronous.
    """
    try:
        result = await run_in_threadpool(seed_all)
        return {"status": "success", "summary": result}
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to seed data: {str(e)}")


@router.get("/dashboard")
async def get_teacher_dashboard(db = Depends(get_db)) -> Dict[str, Any]:
    """
    Aggregate teacher dashboard statistics from Firestore.
    Returns the shape expected by frontend/types/index.ts:DashboardData.
    """
    cached = _get_admin_cache("dashboard")
    if cached:
        return cached

    try:
        # 1. Total students
        users_ref = db.collection("users").where(field_path="role", op_string="==", value="student")
        users_docs = await run_in_threadpool(lambda: list(users_ref.stream()))
        total_students = len(users_docs)

        # 2. Recent interventions (last 50, ordered by timestamp desc)
        interventions_query = (
            db.collection("intervention_logs")
              .order_by("timestamp", direction="DESCENDING")
              .limit(50)
        )
        intervention_docs = await run_in_threadpool(lambda: list(interventions_query.stream()))

        recent_interventions: List[Dict[str, Any]] = []
        confused_user_ids = set()
        confusion_scores: List[float] = []
        for doc in intervention_docs:
            data = doc.to_dict() or {}
            score = float(data.get("confusion_score", 0.0))
            confusion_scores.append(score)
            if score > 0.5 and data.get("user_id"):
                confused_user_ids.add(data["user_id"])
            ts = data.get("timestamp")
            recent_interventions.append({
                "user_id": data.get("user_id", "unknown"),
                "subtopic": data.get("subtopic", "unknown"),
                "confusion_score": round(score, 4),
                "bandit_arm_selected": data.get("bandit_arm_selected", "unknown"),
                "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts) if ts else "",
            })

        avg_confusion = round(
            sum(confusion_scores) / len(confusion_scores), 4
        ) if confusion_scores else 0.0

        # 3. Active students (any behavior log in last 24h)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        active_query = db.collection("behavior_logs").where(
            field_path="timestamp", op_string=">=", value=cutoff
        )
        active_docs = await run_in_threadpool(lambda: list(active_query.stream()))
        active_user_ids = {
            (d.to_dict() or {}).get("user_id")
            for d in active_docs
            if (d.to_dict() or {}).get("user_id")
        }

        # 4. Mastery proxy: mean correctness from recent user_answers
        answers_query = db.collection("user_answers").limit(500)
        answer_docs = await run_in_threadpool(lambda: list(answers_query.stream()))
        correct = 0
        total = 0
        for d in answer_docs:
            data = d.to_dict() or {}
            if "is_correct" in data:
                total += 1
                if int(data.get("is_correct", 0)) == 1:
                    correct += 1
        avg_mastery = round((correct / total) * 100, 1) if total else 0.0

        result = {
            "total_students": total_students,
            "active_students": len(active_user_ids),
            "confused_students": len(confused_user_ids),
            "avg_confusion": avg_confusion,
            "avg_mastery": avg_mastery,
            "active_sessions": len(active_user_ids),
            "active_experiments": 0,  # No experiments backend yet
            "recent_interventions": recent_interventions[:10],
        }
        _set_admin_cache("dashboard", result)
        return result

    except Exception as e:
        logger.error(f"Dashboard aggregation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to aggregate dashboard: {str(e)}")

@router.post("/upload-pdf")
async def upload_course_pdf(
    request: Request,
    file: UploadFile = File(...),
    course_name: str = Form(...),
    db = Depends(get_db),
):
    """Upload a PDF and stream a multi-stage course generation pipeline.

    Returns Server-Sent Events (``Content-Type: text/event-stream``). Each
    event is a JSON object with ``stage``, ``message``, ``progress`` (0..1)
    and an optional ``payload``. The final event has ``stage`` of either
    ``persisted`` (success) or ``error``.

    The generated course is written to Firestore with ``is_published: false``
    and must be flipped via ``POST /admin/courses/{id}/publish`` before
    students can see it.
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    raw_pdf_bytes = await file.read()
    if not raw_pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Author information from the verified Firebase token, if present.
    author_uid: Optional[str] = None
    user_state = getattr(request.state, "user", None)
    if isinstance(user_state, dict):
        author_uid = user_state.get("uid")

    async def _event_stream():
        try:
            # Extract text up front (synchronous, off-loop)
            yield CourseGenProgress(
                stage="extract", message="Extracting text from PDF…", progress=0.02
            ).to_sse()

            def _read_pdf() -> str:
                reader = PdfReader(io.BytesIO(raw_pdf_bytes))
                buf = []
                for page in reader.pages:
                    buf.append(page.extract_text() or "")
                return "\n".join(buf).strip()

            raw_text = await run_in_threadpool(_read_pdf)
            if not raw_text:
                yield CourseGenProgress(
                    stage="error",
                    message="Could not extract any text from this PDF (it may be scanned images).",
                ).to_sse()
                return

            yield CourseGenProgress(
                stage="extract",
                message=f"Extracted {len(raw_text):,} chars from PDF.",
                progress=0.04,
            ).to_sse()

            final_payload: Optional[Dict[str, Any]] = None

            async for ev in course_gen_service.generate_course_stream(
                raw_text=raw_text,
                course_name=course_name,
                author_uid=author_uid,
            ):
                if ev.stage == "done" and ev.payload:
                    final_payload = ev.payload
                yield ev.to_sse()
                if ev.stage == "error":
                    return

            if not final_payload:
                yield CourseGenProgress(
                    stage="error", message="Pipeline produced no payload."
                ).to_sse()
                return

            # ---- persist to Firestore in the canonical shape ----
            yield CourseGenProgress(
                stage="persist",
                message="Saving curriculum to Firestore…",
                progress=0.97,
            ).to_sse()

            def _persist():
                course_doc = final_payload["course"]
                course_id = course_doc["id"]
                # ensure unique id by appending a counter if needed
                base_id = course_id
                n = 0
                while db.collection("courses").document(course_id).get().exists:
                    n += 1
                    course_id = f"{base_id}-{n}"
                course_doc["id"] = course_id

                course_ref = db.collection("courses").document(course_id)
                course_ref.set({
                    **course_doc,
                    "created_at": firestore.SERVER_TIMESTAMP,
                })

                for unit in final_payload["units"]:
                    course_ref.collection("units").document(unit["id"]).set(unit)

                for sub in final_payload["subtopics"]:
                    (course_ref.collection("units")
                               .document(sub["unit_id"])
                               .collection("subtopics")
                               .document(sub["id"])
                               .set(sub))

                # Questions are stored under quiz/{course_id}/questions/{qid}
                quiz_root = db.collection("quiz").document(course_id)
                quiz_root.set({"course_id": course_id, "ai_generated": True}, merge=True)
                for q in final_payload["questions"]:
                    quiz_root.collection("questions").document(q["id"]).set(q)

                return course_id

            persisted_course_id = await run_in_threadpool(_persist)

            yield CourseGenProgress(
                stage="persisted",
                message="Curriculum saved. Awaiting publish.",
                progress=1.0,
                payload={
                    "course_id": persisted_course_id,
                    "summary": final_payload.get("summary", {}),
                    "is_published": False,
                },
            ).to_sse()

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PDF upload pipeline failed: %s", e)
            yield CourseGenProgress(
                stage="error", message=f"Pipeline error: {e}"
            ).to_sse()

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/courses/{course_id}/publish")
async def publish_course(course_id: str, db = Depends(get_db)) -> Dict[str, Any]:
    """Flip the ``is_published`` flag on a generated course."""
    def _publish():
        ref = db.collection("courses").document(course_id)
        snap = ref.get()
        if not snap.exists:
            return None
        ref.set({"is_published": True}, merge=True)
        data = ref.get().to_dict() or {}
        return data

    data = await run_in_threadpool(_publish)
    if data is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"status": "published", "course_id": course_id, "course": data}


@router.post("/courses/{course_id}/unpublish")
async def unpublish_course(course_id: str, db = Depends(get_db)) -> Dict[str, Any]:
    def _unpublish():
        ref = db.collection("courses").document(course_id)
        if not ref.get().exists:
            return None
        ref.set({"is_published": False}, merge=True)
        return True

    ok = await run_in_threadpool(_unpublish)
    if not ok:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"status": "unpublished", "course_id": course_id}



# ─── Risk / Dropout assessment ──────────────────────────────────────────────

from collections import defaultdict
from services.risk_service import risk_service, StudentSnapshot, DailyActivity


def _build_snapshot_for_user(db, user_id: str) -> StudentSnapshot:
    """Aggregate Firestore reads into a single StudentSnapshot."""
    # 1. Recent quiz_results (last 30 days max)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    quiz_q = (db.collection("quiz_results")
                .where(field_path="user_id", op_string="==", value=user_id)
                .limit(200))

    daily: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"minutes": 0.0, "questions": 0, "correct": 0}
    )
    total_correct = 0
    total_questions = 0
    last_active = None
    incorrect_streak = 0
    completed_subtopics = set()

    for doc in quiz_q.stream():
        d = doc.to_dict() or {}
        ts = d.get("timestamp")
        ts_dt: Optional[datetime] = None
        if hasattr(ts, "timestamp"):
            ts_dt = datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc)
        elif isinstance(ts, datetime):
            ts_dt = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if ts_dt and ts_dt < cutoff:
            continue

        score = int(d.get("score", 0))
        total_q = int(d.get("total_questions", 0)) or 1
        time_ms = int((d.get("metrics") or {}).get("total_time_ms", 0))

        total_correct += score
        total_questions += total_q

        if ts_dt:
            day_key = ts_dt.date().isoformat()
            bucket = daily[day_key]
            bucket["minutes"] += time_ms / 60000.0
            bucket["questions"] += total_q
            bucket["correct"] += score
            if last_active is None or ts_dt > last_active:
                last_active = ts_dt

        sub = d.get("subtopic_id")
        if sub:
            completed_subtopics.add(sub)

    # Incorrect streak from per-question answers (best-effort)
    try:
        ans_ref = (db.collection("users")
                     .document(user_id)
                     .collection("answers")
                     .order_by("timestamp", direction="DESCENDING")
                     .limit(20))
        for doc in ans_ref.stream():
            data = doc.to_dict() or {}
            if data.get("is_correct") is False or data.get("is_correct") == 0:
                incorrect_streak += 1
            else:
                break
    except Exception as e:
        logger.debug(f"could not compute incorrect_streak for {user_id}: {e}")

    accuracy_pct = (total_correct / total_questions * 100) if total_questions else 0.0

    activity = []
    for day_key, bucket in daily.items():
        try:
            d = datetime.fromisoformat(day_key).replace(tzinfo=timezone.utc)
        except Exception:
            continue
        activity.append(DailyActivity(
            date=d,
            minutes_spent=float(bucket["minutes"]),
            questions_answered=int(bucket["questions"]),
            correct_count=int(bucket["correct"]),
        ))

    return StudentSnapshot(
        user_id=user_id,
        last_active_at=last_active,
        completed_subtopic_count=len(completed_subtopics),
        overall_accuracy_pct=accuracy_pct,
        incorrect_streak=incorrect_streak,
        current_difficulty=3,  # default mid-level (we don't track per-user yet)
        daily_activity=activity,
    )


@router.get("/risk/{user_id}")
async def assess_user_risk(user_id: str, db = Depends(get_db)) -> Dict[str, Any]:
    """Run the rule-based dropout / at-risk model for a single user."""
    snap = await run_in_threadpool(_build_snapshot_for_user, db, user_id)
    return await run_in_threadpool(risk_service.assess, snap)


@router.get("/risk")
async def assess_cohort_risk(limit: int = 50, db = Depends(get_db)) -> Dict[str, Any]:
    """Assess every active student in the cohort. Returns ranked list."""
    cached = _get_admin_cache(f"risk_{limit}")
    if cached:
        return cached

    def _list_students():
        users_q = db.collection("users").where(
            field_path="role", op_string="==", value="student"
        ).limit(limit)
        return [doc.id for doc in users_q.stream()]

    student_ids = await run_in_threadpool(_list_students)
    results = []
    for uid in student_ids:
        snap = await run_in_threadpool(_build_snapshot_for_user, db, uid)
        results.append(await run_in_threadpool(risk_service.assess, snap))

    results.sort(key=lambda r: r["risk_score"], reverse=True)
    result = {
        "total": len(results),
        "students": results,
        "summary": {
            "likely_dropout": sum(1 for r in results if r["predicted_outcome"] == "likely_dropout"),
            "at_risk": sum(1 for r in results if r["predicted_outcome"] == "at_risk"),
            "complete": sum(1 for r in results if r["predicted_outcome"] == "complete"),
        },
    }
    _set_admin_cache(f"risk_{limit}", result)
    return result


# ─── Cohort competency view ─────────────────────────────────────────────────


@router.get("/cohort/competencies")
async def cohort_competency_breakdown(
    limit: int = 100,
    db = Depends(get_db),
) -> Dict[str, Any]:
    """
    Cohort-level competency-mastery aggregation for the teacher dashboard.

    For every student in the cohort we read their per-skill BKT mastery
    (under ``users/{uid}/mastery/{skill}``) and bucket the values by the
    skill prefix (which matches our subtopic/competency unit grouping).
    Returns:

      - per-student summary rows with overall mastery + stuck-skill list
      - per-skill aggregate (avg mastery, struggling count, total)
      - hot-spots: skills where >= 30% of students are below 0.4

    The frontend cohort panel renders this directly.
    """
    cached = _get_admin_cache(f"cohort_comp_{limit}")
    if cached:
        return cached

    def _list_students():
        users_q = db.collection("users").where(
            field_path="role", op_string="==", value="student"
        ).limit(limit)
        return [doc.id for doc in users_q.stream()]

    def _load_mastery(user_id: str):
        out = []
        try:
            ref = (db.collection("users")
                   .document(user_id)
                   .collection("mastery"))
            for doc in ref.stream():
                d = doc.to_dict() or {}
                out.append({
                    "skill": doc.id,
                    "p_mastery": float(d.get("p_mastery", 0.3)),
                    "attempts": int(d.get("attempts", 0)),
                })
        except Exception as e:
            logger.debug(f"cohort mastery load failed for {user_id}: {e}")
        return out

    student_ids = await run_in_threadpool(_list_students)

    students = []
    skill_totals: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"sum": 0.0, "count": 0, "struggling": 0}
    )

    for uid in student_ids:
        snap = await run_in_threadpool(_load_mastery, uid)
        if not snap:
            continue

        overall = (
            sum(s["p_mastery"] for s in snap) / len(snap)
            if snap else 0.0
        )
        weak = [
            {"skill": s["skill"], "score": round(s["p_mastery"] * 100, 1)}
            for s in snap if s["p_mastery"] < 0.4
        ]
        weak.sort(key=lambda x: x["score"])

        students.append({
            "user_id": uid,
            "overall_mastery": round(overall * 100, 1),
            "skill_count": len(snap),
            "weak_skills": weak[:5],
        })

        for s in snap:
            bucket = skill_totals[s["skill"]]
            bucket["sum"] += s["p_mastery"]
            bucket["count"] += 1
            if s["p_mastery"] < 0.4:
                bucket["struggling"] += 1

    students.sort(key=lambda r: r["overall_mastery"])

    skills = []
    for skill, b in skill_totals.items():
        avg = (b["sum"] / b["count"]) if b["count"] else 0.0
        struggle_pct = (b["struggling"] / b["count"] * 100) if b["count"] else 0.0
        skills.append({
            "skill": skill,
            "avg_mastery": round(avg * 100, 1),
            "students": int(b["count"]),
            "struggling": int(b["struggling"]),
            "struggling_pct": round(struggle_pct, 1),
        })
    skills.sort(key=lambda s: s["avg_mastery"])

    hot_spots = [s for s in skills if s["struggling_pct"] >= 30 and s["students"] >= 3]

    result = {
        "total_students": len(students),
        "total_skills_tracked": len(skills),
        "students": students,
        "skills": skills,
        "hot_spots": hot_spots[:10],
    }
    _set_admin_cache(f"cohort_comp_{limit}", result)
    return result


# ─── Per-subtopic confusion timeline ────────────────────────────────────────


@router.get("/subtopic/{subtopic_id}/confusion-timeline")
async def subtopic_confusion_timeline(
    subtopic_id: str,
    days: int = 30,
    bins: int = 20,
    db = Depends(get_db),
) -> Dict[str, Any]:
    """
    Aggregate per-question confusion + behavior signals for a subtopic.

    Reads recent ``confusion_events`` and ``behavior_logs`` for the
    subtopic, then returns:

      - per-question stats: avg confusion score, attempts, sample count
      - timeline: ``bins`` evenly-spaced buckets across the lookback
        window with mean confusion + sample count per bucket (used by
        the SVG sparkline)
      - hot questions: top-5 questions by avg confusion (>= 0.5)
      - rolled up totals (events seen, distinct users, avg score)

    Used by the L4 confusion-timeline panel. Admin-scoped because
    raw confusion events are not user-readable per firestore.rules.
    """
    days = max(1, min(90, int(days or 30)))
    bins = max(4, min(60, int(bins or 20)))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    def _ts_dt(ts):
        if hasattr(ts, "timestamp"):
            return datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc)
        if isinstance(ts, datetime):
            return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        return None

    def _load_events():
        events = []
        # Primary signal: confusion_events filtered to this subtopic.
        try:
            q = (db.collection("confusion_events")
                 .where(field_path="subtopic_id", op_string="==", value=subtopic_id)
                 .limit(500))
            for doc in q.stream():
                d = doc.to_dict() or {}
                ts = _ts_dt(d.get("timestamp"))
                if ts is None or ts < cutoff:
                    continue
                events.append({
                    "user_id": d.get("user_id"),
                    "question_id": d.get("question_id", "unknown"),
                    "score": float(d.get("confusion_score", 0) or 0),
                    "metrics": d.get("metrics") or {},
                    "ts": ts,
                })
        except Exception as e:
            logger.error(f"timeline load failed: {e}")
        return events

    events = await run_in_threadpool(_load_events)

    if not events:
        return {
            "subtopic_id": subtopic_id,
            "horizon_days": days,
            "total_events": 0,
            "distinct_users": 0,
            "avg_confusion": 0.0,
            "by_question": [],
            "hot_questions": [],
            "timeline": [],
        }

    # Per-question aggregates
    by_q: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"sum": 0.0, "count": 0, "max": 0.0, "users": set(),
                 "hesitation_sum": 0.0, "attempts_sum": 0}
    )
    for ev in events:
        b = by_q[ev["question_id"]]
        b["sum"] += ev["score"]
        b["count"] += 1
        b["max"] = max(b["max"], ev["score"])
        if ev.get("user_id"):
            b["users"].add(ev["user_id"])
        m = ev.get("metrics") or {}
        b["hesitation_sum"] += float(m.get("hesitation_ms", 0) or 0)
        b["attempts_sum"] += int(m.get("attempts", 0) or 0)

    by_question = []
    for qid, b in by_q.items():
        avg = (b["sum"] / b["count"]) if b["count"] else 0.0
        by_question.append({
            "question_id": qid,
            "avg_confusion": round(avg, 3),
            "max_confusion": round(b["max"], 3),
            "samples": b["count"],
            "distinct_users": len(b["users"]),
            "avg_hesitation_ms": round(b["hesitation_sum"] / max(1, b["count"]), 1),
            "avg_attempts": round(b["attempts_sum"] / max(1, b["count"]), 2),
        })
    by_question.sort(key=lambda x: x["avg_confusion"], reverse=True)
    hot_questions = [q for q in by_question if q["avg_confusion"] >= 0.5][:5]

    # Timeline: equal-width buckets across [cutoff, now].
    now = datetime.now(timezone.utc)
    span = (now - cutoff).total_seconds() or 1
    bucket_width = span / bins
    timeline = [
        {"bucket": i, "sum": 0.0, "count": 0}
        for i in range(bins)
    ]
    for ev in events:
        offset = (ev["ts"] - cutoff).total_seconds()
        idx = int(min(bins - 1, max(0, offset / bucket_width)))
        timeline[idx]["sum"] += ev["score"]
        timeline[idx]["count"] += 1

    timeline_out = []
    for i, b in enumerate(timeline):
        bucket_start = cutoff + timedelta(seconds=bucket_width * i)
        timeline_out.append({
            "bucket": i,
            "ts_start": bucket_start.isoformat(),
            "samples": b["count"],
            "avg_confusion": round((b["sum"] / b["count"]) if b["count"] else 0.0, 3),
        })

    distinct_users = {ev["user_id"] for ev in events if ev.get("user_id")}
    avg_overall = sum(ev["score"] for ev in events) / len(events)

    return {
        "subtopic_id": subtopic_id,
        "horizon_days": days,
        "total_events": len(events),
        "distinct_users": len(distinct_users),
        "avg_confusion": round(avg_overall, 3),
        "by_question": by_question,
        "hot_questions": hot_questions,
        "timeline": timeline_out,
    }


# ─── LLM Usage Monitoring ────────────────────────────────────────────────────

@router.get("/llm-usage")
async def get_llm_usage():
    """
    Real-time LLM model usage report.

    Shows per-model token consumption, budget utilization, health status,
    cost tracking, and which models are currently available in the fallback
    chain. Designed for the admin dashboard.
    """
    from services.model_router import model_router
    return model_router.usage_report()


@router.post("/llm-usage/reset")
async def reset_llm_counters():
    """
    Force-reset all daily token counters. Useful for testing.
    Does NOT clear cooldowns (those expire naturally).
    """
    from services.model_router import model_router
    for s in model_router.stats.values():
        s.input_tokens = 0
        s.output_tokens = 0
        s.requests = 0
        s.failures = 0
    return {"status": "reset", "day": model_router._counter_day}


@router.post("/llm-usage/clear-cooldowns")
async def clear_llm_cooldowns():
    """
    Clear all model cooldowns. Use when a model was temporarily down
    but is now back.
    """
    from services.model_router import model_router
    cleared = []
    for mid, s in model_router.stats.items():
        if s.cooldown_until > 0:
            s.cooldown_until = 0
            s.consecutive_failures = 0
            cleared.append(mid)
    return {"status": "cleared", "models": cleared}
