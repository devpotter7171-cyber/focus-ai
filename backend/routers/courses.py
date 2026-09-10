from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from schemas import common
from services.ml_service import ml_service
from services.adaptive_service import adaptive_service
from firebase_admin import firestore
from starlette.concurrency import run_in_threadpool
from typing import List, Any
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Firestore Structure Helper
# Courses are at root: /courses/{course_id}
# Units: /courses/{course_id}/units/{unit_id}
# Subtopics: /courses/{course_id}/units/{unit_id}/subtopics/{subtopic_id}




import time

# Simple In-Memory Cache
# Structure: { key: { "data": ..., "timestamp": ... } }
CACHE = {}
CACHE_TTL = 300  # 5 minutes

def get_cached_data(key: str):
    entry = CACHE.get(key)
    if not entry:
        return None
    if time.time() - entry["timestamp"] > CACHE_TTL:
        del CACHE[key]
        return None
    return entry["data"]

def set_cached_data(key: str, data: Any):
    CACHE[key] = {
        "data": data,
        "timestamp": time.time()
    }

@router.get("/", response_model=List[common.Course])
async def get_courses(include_drafts: bool = False, db=Depends(get_db)):
    """List courses.

    By default only courses where ``is_published`` is ``true`` (or where the
    field is missing — covers the hand-seeded DBMS course) are returned.
    Pass ``?include_drafts=true`` to also fetch unpublished AI-generated
    drafts (used by the admin / teacher dashboard).
    """
    cache_key = f"all_courses::drafts={include_drafts}"
    cached = get_cached_data(cache_key)
    if cached:
        return cached

    def _load():
        rows = []
        for doc in db.collection("courses").stream():
            d = doc.to_dict()
            d["id"] = doc.id
            if not include_drafts and d.get("is_published") is False:
                continue
            rows.append(d)
        return rows

    courses = await run_in_threadpool(_load)

    # Set Cache
    set_cached_data(cache_key, courses)
    return courses

@router.get("/{course_id}/units")
async def get_units(course_id: str, db=Depends(get_db)):
    # Check Cache
    cache_key = f"units_{course_id}"
    cached = get_cached_data(cache_key)
    if cached:
        return cached

    from concurrent.futures import ThreadPoolExecutor

    units_ref = db.collection("courses").document(course_id).collection("units")

    def _load_units():
        docs = list(units_ref.order_by("order").stream())
        if not docs:
            course_doc = db.collection("courses").document(course_id).get()
            if not course_doc.exists:
                return None  # signal 404
            return []

        def fetch_subtopics(unit_doc):
            unit_data = unit_doc.to_dict()
            subs_ref = units_ref.document(unit_doc.id).collection("subtopics")
            subs = [s.to_dict() for s in subs_ref.stream()]
            subs.sort(key=lambda x: (x.get("order", 999), x.get("id", "")))
            unit_data["subtopics"] = subs
            return unit_data

        with ThreadPoolExecutor(max_workers=5) as executor:
            return list(executor.map(fetch_subtopics, docs))

    units = await run_in_threadpool(_load_units)
    if units is None:
        raise HTTPException(status_code=404, detail="Course not found")

    # Set Cache
    set_cached_data(cache_key, units)
    return units

@router.get("/{course_id}/units/{unit_id}/subtopics/{subtopic_id}")
async def get_subtopic_content(
    course_id: str, 
    unit_id: str, 
    subtopic_id: str, 
    user_id: str = "user_0000",
    adaptation: str | None = None, # Explicit override from frontend
    db=Depends(get_db)
):
    try:
        # ─── PERFORMANCE: Cache subtopic content (it rarely changes) ─────
        content_cache_key = f"subtopic_{course_id}_{unit_id}_{subtopic_id}"
        cached_subtopic = get_cached_data(content_cache_key)
        
        if cached_subtopic:
            subtopic = cached_subtopic["subtopic"]
            unit_title = cached_subtopic["unit_title"]
        else:
            # Fetch subtopic AND unit title in parallel (single threadpool call)
            def _load_subtopic_and_unit():
                sub_ref = (db.collection("courses")
                           .document(course_id)
                           .collection("units")
                           .document(unit_id)
                           .collection("subtopics")
                           .document(subtopic_id))
                unit_ref = db.collection("courses").document(course_id).collection("units").document(unit_id)
                
                sub_doc = sub_ref.get()
                unit_doc = unit_ref.get()
                return sub_doc, unit_doc

            doc, unit_doc = await run_in_threadpool(_load_subtopic_and_unit)
            
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Subtopic not found")
            
            subtopic = doc.to_dict()
            unit_title = unit_doc.to_dict().get("title", "Unknown Unit") if unit_doc.exists else "Unknown Unit"
            
            # Cache for 5 min
            set_cached_data(content_cache_key, {"subtopic": subtopic, "unit_title": unit_title})

        # 2. Check User Confusion (skip if explicit adaptation is set — saves ~50ms)
        is_confused = False
        confusion_score = 0.0
        
        if not adaptation:
            try:
                logs_ref = db.collection("behavior_logs")
                query = (logs_ref
                         .where(field_path="user_id", op_string="==", value=user_id)
                         .limit(10))

                log_docs = await run_in_threadpool(lambda: list(query.stream()))

                target_screen = f"{unit_id}_{subtopic_id}"
                recent_logs = []
                for d in log_docs:
                    log_data = d.to_dict()
                    if "timestamp" not in log_data:
                        log_data["timestamp"] = 0
                    recent_logs.append(log_data)
                
                recent_logs.sort(key=lambda x: x.get("timestamp", 0) if isinstance(x.get("timestamp"), (int, float)) else x.get("timestamp").timestamp() if hasattr(x.get("timestamp"), "timestamp") else 0, reverse=True)
                
                target_logs = [log for log in recent_logs if log.get("data", {}).get("screen", "") == target_screen][:5]
                
                if target_logs:
                    total_confusion = 0.0
                    count = 0
                    for log in target_logs[:3]:
                        log_input = {"data": log.get("data", {})}
                        try:
                            score = ml_service.predict_confusion(log_input)
                            total_confusion += score
                            count += 1
                        except Exception:
                            continue
                            
                    if count > 0:
                        avg_confusion = total_confusion / count
                        confusion_score = avg_confusion
                        if avg_confusion > 0.5:
                            is_confused = True
            except Exception as e:
                logger.error(f"Error in confusion prediction: {e}")

        # 3. Adapt Content
        content = subtopic.get("content", "")
        adaptation_note = None
        # Determine strategy: Explicit override > User Performance (Adaptive Level) > Default
        target_level = 1 # Default Standard

        if adaptation:
             try:
                target_level = int(adaptation)
             except:
                target_level = 1
        else:
             # Calculate Adaptive Level based on performance history
             target_level = await adaptive_service.get_user_level(user_id, unit_id, db)

             # If confused (ML heuristic), use the behavior-driven adjustment
             # which is more aggressive than the quiz-based one
             if is_confused:
                 target_level = adaptive_service.get_level_for_behavior(
                     confusion_score=confusion_score,
                     current_level=target_level,
                 )

        # Adaptation Note for Frontend
        if target_level != 1:
            adaptation_note = f"Content adapted to Level {target_level}"

        # Select Content based on Level
        # Check if 'content_levels' map exists in subtopic
        levels_map = subtopic.get("content_levels", {})
        
        # If we have the specific level, use it. Otherwise fallback to main 'content' or nearest level.
        if str(target_level) in levels_map:
             content = levels_map[str(target_level)]
        elif "1" in levels_map: # Fallback to level 1 if target missing
             content = levels_map["1"]
        # Else keep original 'content' from line 175
                    



        # 4. Navigation (Next Subtopic) — cached since sibling list rarely changes
        next_subtopic = None
        nav_cache_key = f"nav_{course_id}_{unit_id}"
        cached_nav = get_cached_data(nav_cache_key)
        
        if cached_nav:
            all_subs = cached_nav
        else:
            try:
                siblings_ref = (db.collection("courses")
                                .document(course_id)
                                .collection("units")
                                .document(unit_id)
                                .collection("subtopics"))
                
                all_subs = await run_in_threadpool(lambda: [d.to_dict() for d in siblings_ref.stream()])
                all_subs.sort(key=lambda x: (x.get("order", 999), x.get("id", "")))
                set_cached_data(nav_cache_key, all_subs)
            except Exception as e:
                logger.error(f"Error resolving next subtopic: {e}")
                all_subs = []

        curr_idx = next((i for i, s in enumerate(all_subs) if s.get("id") == subtopic_id), -1)
        if curr_idx != -1 and curr_idx + 1 < len(all_subs):
            nxt = all_subs[curr_idx+1]
            next_subtopic = {"id": nxt["id"], "title": nxt["title"]}

        siblings = [{"id": s.get("id"), "title": s.get("title")} for s in all_subs]

        return {
            "id": subtopic.get("id"),
            "title": subtopic.get("title"),
            "unit_title": unit_title,
            "content": content,
            "adaptation": adaptation_note,
            "references": subtopic.get("references"),
            "next_subtopic": next_subtopic,
            "subtopics": siblings
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"CRITICAL ERROR in get_subtopic_content: {e}")
        # Return a valid-ish response with error text so Frontend accepts it
        return {
            "id": subtopic_id,
            "title": "Error Loading Topic",
            "unit_title": unit_id,
            "content": f"# Error \n\n We encountered a server error loading this content: \n\n `{str(e)}` \n\n Please try refreshing.",
            "next_subtopic": None
        }

@router.post("/{course_id}/units/{unit_id}/subtopics/{subtopic_id}/complete")
async def mark_subtopic_complete(
    course_id: str,
    unit_id: str,
    subtopic_id: str,
    user_id: str = "user_0000",
    db=Depends(get_db)
):
    # Store progress in user's subcollection: users/{uid}/progress/{subtopic_id}
    prog_ref = (db.collection("users")
                .document(user_id)
                .collection("progress")
                .document(subtopic_id))

    def _write():
        doc = prog_ref.get()
        if doc.exists:
            return "already_completed"
        prog_ref.set({
            "course_id": course_id,
            "unit_id": unit_id,
            "subtopic_id": subtopic_id,
            "completed_at": firestore.SERVER_TIMESTAMP,
        })
        return "completed"

    status = await run_in_threadpool(_write)
    return {"status": status}

@router.get("/{course_id}/progress")
async def get_course_progress(
    course_id: str,
    user_id: str = "user_0000",
    db=Depends(get_db)
):
    def _load():
        progress_ref = (db.collection("users")
                        .document(user_id)
                        .collection("progress")
                        .where(field_path="course_id", op_string="==", value=course_id))
        completed = [doc.id for doc in progress_ref.stream()]

        confused_ids = set()
        try:
            confusion_ref = (db.collection("confusion_events")
                             .where(field_path="user_id", op_string="==", value=user_id)
                             .limit(50))
            c_docs = list(confusion_ref.stream())

            def get_ts(d):
                val = d.to_dict().get("timestamp")
                return val.timestamp() if hasattr(val, "timestamp") else 0

            c_docs.sort(key=get_ts, reverse=True)
            for cd in c_docs[:20]:
                data = cd.to_dict()
                raw_id = data.get("subtopic_id", "")
                if "_" in raw_id:
                    confused_ids.add(raw_id.split("_")[-1])
                else:
                    confused_ids.add(raw_id)
        except Exception as e:
            logger.error(f"Error fetching confusion events: {e}")

        return completed, confused_ids

    completed_ids, confused_ids = await run_in_threadpool(_load)
    return {
        "completed_subtopics": completed_ids,
        "confused_subtopics": list(confused_ids),
    }
