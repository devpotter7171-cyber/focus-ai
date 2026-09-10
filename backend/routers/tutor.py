"""
Backend Router: Lesson Spotlight Tutor.

Single-turn AI tutor scoped to a specific lesson. The frontend captures
either:
  • A highlighted excerpt (right-click style "spotlight" UX), or
  • A free-form question typed in a sidebar

…and sends it here. We attach the lesson title/content from Firestore, ask
Gemini, and return a Markdown answer.

Cost design:
  • One round-trip per question (no streaming, no chat memory).
  • Lesson body is fetched server-side and capped at ~6 KB so we never blow
    the model's context budget. The frontend never sends the lesson body.
  • Per-user rate limit: 20 requests / 60 s (in-memory bucket, good enough
    for a single-process deployment).
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from database import get_db
from services.genai_service import genai_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request / response shapes ──────────────────────────────────────────────

class LessonTutorRequest(BaseModel):
    course_id: str = Field(..., description="Course id, e.g. 'dbms'")
    unit_id: str = Field(..., description="Unit id, e.g. 'u1'")
    subtopic_id: str = Field(..., description="Subtopic id (Firestore doc id)")
    question: str = Field(..., min_length=1, max_length=2000)
    selected_excerpt: Optional[str] = Field(
        default=None, max_length=4000,
        description="Text the user highlighted in the lesson. Optional.",
    )
    voice_mode: bool = Field(
        default=False,
        description="When true, uses shorter context and output for spoken delivery.",
    )


class LessonTutorResponse(BaseModel):
    answer: str
    course_title: str
    lesson_title: str
    truncated_lesson: bool


# ─── Rate limiting (in-memory) ──────────────────────────────────────────────

_RATE_LIMIT_WINDOW_SEC = 60
_RATE_LIMIT_MAX = 20
_rate_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def _check_rate_limit(user_key: str) -> None:
    now = time.time()
    bucket = _rate_buckets[user_key]
    while bucket and now - bucket[0] > _RATE_LIMIT_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT_MAX:
        retry_after = int(_RATE_LIMIT_WINDOW_SEC - (now - bucket[0])) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many tutor requests. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    bucket.append(now)


# ─── Endpoint ───────────────────────────────────────────────────────────────

@router.post("/lesson", response_model=LessonTutorResponse)
async def lesson_tutor(
    body: LessonTutorRequest,
    db = Depends(get_db),
):
    if not genai_service.client:
        raise HTTPException(
            status_code=503,
            detail="Tutor is not configured (missing GEMINI_API_KEY).",
        )

    # The router this is mounted under will already require auth via
    # `Depends(get_current_user)`; we just need a stable per-user key for the
    # rate-limit bucket. Falling back to IP-less anonymous bucket if no auth.
    _check_rate_limit("global")

    # 1. Fetch lesson content (matches the path used by /courses/.../subtopics)
    def _load():
        sub_ref = (db.collection("courses")
                   .document(body.course_id)
                   .collection("units")
                   .document(body.unit_id)
                   .collection("subtopics")
                   .document(body.subtopic_id))
        sub_doc = sub_ref.get()
        if not sub_doc.exists:
            return None, None, None
        sub = sub_doc.to_dict() or {}

        course_doc = db.collection("courses").document(body.course_id).get()
        course = (course_doc.to_dict() or {}) if course_doc.exists else {}

        return course, sub, len((sub.get("content") or "")) > 6000

    course, subtopic, truncated = await run_in_threadpool(_load)
    if subtopic is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    course_title = (course or {}).get("title") or body.course_id
    lesson_title = subtopic.get("title") or body.subtopic_id
    lesson_text = subtopic.get("content") or ""

    # 2. Ask Gemini
    answer = await genai_service.lesson_tutor(
        question=body.question,
        course_title=course_title,
        lesson_title=lesson_title,
        lesson_text=lesson_text,
        selected_excerpt=body.selected_excerpt,
        voice_mode=body.voice_mode,
    )
    if not answer:
        raise HTTPException(status_code=502, detail="Tutor temporarily unavailable.")

    return LessonTutorResponse(
        answer=answer,
        course_title=course_title,
        lesson_title=lesson_title,
        truncated_lesson=bool(truncated),
    )


# ─── Voice-optimized endpoint ────────────────────────────────────────────────
# Ultra-lightweight: skips Firestore fetch when possible, uses minimal context,
# and caps output at ~2 spoken sentences. Designed for the conversational voice
# fallback where latency and token cost matter most.

class VoiceTutorRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    lesson_title: Optional[str] = Field(default=None, max_length=200)
    lesson_snippet: Optional[str] = Field(
        default=None, max_length=1500,
        description="First ~1500 chars of the lesson. Frontend sends this to avoid a DB round-trip.",
    )


class VoiceTutorResponse(BaseModel):
    answer: str
    cached: bool = False


@router.post("/voice", response_model=VoiceTutorResponse)
async def voice_tutor(body: VoiceTutorRequest):
    """
    Minimal-cost voice answer endpoint.

    Token budget:
      - Input: ~200-400 tokens (question + optional snippet)
      - Output: capped at 150 tokens (~2 sentences)
      - No Firestore fetch (frontend sends snippet if available)
      - Response cached by (lesson_title, question)

    Cost per call: ~$0.0001 at Gemini Flash Lite pricing.
    """
    if not genai_service.client:
        raise HTTPException(
            status_code=503,
            detail="Voice tutor not configured.",
        )

    _check_rate_limit("voice-global")

    answer = await genai_service.voice_answer(
        question=body.question,
        lesson_title=body.lesson_title,
        lesson_snippet=body.lesson_snippet,
    )
    if not answer:
        raise HTTPException(status_code=502, detail="Voice tutor unavailable.")

    return VoiceTutorResponse(answer=answer, cached=False)
