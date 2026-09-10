"""
Backend Service: Course Generation Pipeline.

Turns raw text (e.g. extracted from a PDF) into a fully-shaped course
matching the structure already used elsewhere in the codebase:

    courses/{course_id}                            (Course doc)
    courses/{course_id}/units/{unit_id}            (Unit docs)
    courses/{course_id}/units/{unit_id}/subtopics/{subtopic_id}
                                                   (Subtopic docs incl.
                                                    content_levels: 1..5)
    quiz/{course_id}/questions/{question_id}       (Generated MCQs)

The pipeline is multi-stage so a real textbook (not just a 2-page PDF)
turns into a coherent course:

    Stage 1  Outline       (whole text -> Course meta + Unit list)
    Stage 2  Subtopics     (per Unit -> 3..5 Subtopics with summaries)
    Stage 3  Content levels (per Subtopic -> 5 difficulty variants)
    Stage 4  Questions     (per Subtopic -> 3 MCQs in the seed schema)

Each stage is an independent ``async`` step so the API can stream
progress back to the client (see ``CourseGenProgress``).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from starlette.concurrency import run_in_threadpool

from services.genai_service import genai_service

logger = logging.getLogger(__name__)


# ---------- helpers ----------------------------------------------------------

def _slugify(text: str, max_len: int = 50) -> str:
    """Lowercase, hyphen-separated, ASCII-safe id."""
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text or "").strip().lower()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s[:max_len].strip("-") or "untitled"


def _chunk_text(text: str, size: int = 12_000, overlap: int = 800) -> List[str]:
    """Split a long text into overlapping chunks suitable for LLM context."""
    text = text.strip()
    if len(text) <= size:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


# ---------- progress reporting ----------------------------------------------

@dataclass
class CourseGenProgress:
    stage: str               # outline | subtopics | content | questions | persist | done | error
    message: str
    progress: float = 0.0    # 0..1
    payload: Optional[Dict[str, Any]] = None

    def to_sse(self) -> str:
        body = {
            "stage": self.stage,
            "message": self.message,
            "progress": round(self.progress, 3),
        }
        if self.payload is not None:
            body["payload"] = self.payload
        return f"data: {json.dumps(body)}\n\n"


ProgressCallback = Callable[[CourseGenProgress], None]


# ---------- service ---------------------------------------------------------

@dataclass
class CourseGenService:
    model_name: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    # Limits per call — staying small
    # keeps cost / latency predictable.
    max_outline_units: int = 6
    subtopics_per_unit: int = 4
    questions_per_subtopic: int = 3

    # ----- stage 1: outline -------------------------------------------------
    async def _outline(self, text_chunks: List[str], course_name: str) -> Dict[str, Any]:
        joined = "\n\n--- chunk break ---\n\n".join(text_chunks[:3])  # first ~36k chars is plenty for outline
        prompt = f"""You are a senior curriculum designer. Read the following extracted
text and produce a course outline.

Course title: "{course_name}"

Constraints:
- Exactly 3 to {self.max_outline_units} units.
- Units should reflect natural sections of the source.
- Each unit needs a 1-sentence description.
- Output STRICT JSON only.

Schema:
{{
  "title": str,
  "description": str,                 # 1-2 sentence elevator pitch
  "units": [
    {{ "title": str, "description": str }}
  ]
}}

Source text:
\"\"\"
{joined}
\"\"\"
"""
        return await self._json_call(prompt, "outline")

    # ----- stage 2: subtopics per unit -------------------------------------
    async def _subtopics_for_unit(self, unit_title: str, unit_desc: str, raw_text: str) -> List[Dict[str, str]]:
        # We pass the relevant slice of the source for grounding; if too big,
        # let the model use the snippet to choose subtopics.
        snippet = raw_text[:20_000]
        prompt = f"""You are designing the subtopics inside a single unit.

Unit title:        "{unit_title}"
Unit description:  "{unit_desc}"

Constraints:
- Produce exactly {self.subtopics_per_unit} subtopics.
- Each subtopic needs a 'title' (3-6 words) and a 'description' (1-2 sentences).
- Output STRICT JSON only.

Schema:
{{
  "subtopics": [
    {{ "title": str, "description": str }}
  ]
}}

Source snippet:
\"\"\"
{snippet}
\"\"\"
"""
        data = await self._json_call(prompt, "subtopics")
        return data.get("subtopics", [])[: self.subtopics_per_unit]

    # ----- stage 3: 5 content levels per subtopic --------------------------
    async def _content_levels(self, unit_title: str, sub_title: str, sub_desc: str) -> Dict[str, str]:
        """Return a {"1": "...", ..., "5": "..."} map matching the seed schema.

        Level 1 = Expert / canonical.
        Level 2 = Detailed standard.
        Level 3 = Concise summary.
        Level 4 = Real-world / applied example.
        Level 5 = Friendly analogy / first-principles intuition.
        """
        prompt = f"""You are writing a single subtopic at FIVE different difficulty levels.

Unit:           "{unit_title}"
Subtopic:       "{sub_title}"
Subtopic brief: "{sub_desc}"

For each level, write 200-400 words of Markdown content. Use #, ##, lists,
and code fences where useful. Do not include the level number in the heading.

Levels:
  1 = Expert: rigorous, formal, complete coverage. Use precise terminology.
  2 = Detailed standard: textbook style, complete but accessible.
  3 = Concise key points: short paragraphs + bullet list. Skim-friendly.
  4 = Real-world application: a concrete worked example or case study.
  5 = Friendly analogy: explain like the reader is brand new, with a metaphor.

Output STRICT JSON only:
{{
  "1": "<markdown>",
  "2": "<markdown>",
  "3": "<markdown>",
  "4": "<markdown>",
  "5": "<markdown>"
}}
"""
        data = await self._json_call(prompt, "content_levels")
        out: Dict[str, str] = {}
        for k in ("1", "2", "3", "4", "5"):
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                out[k] = v.strip()
        # Backfill any missing levels with level 1 so the UI always has something.
        anchor = out.get("1") or next(iter(out.values()), f"# {sub_title}\n\nContent forthcoming.")
        for k in ("1", "2", "3", "4", "5"):
            out.setdefault(k, anchor)
        return out

    # ----- stage 4: questions per subtopic ---------------------------------
    async def _questions_for_subtopic(self, unit_id: str, subtopic_id: str, sub_title: str, level1_content: str) -> List[Dict[str, Any]]:
        prompt = f"""You are an assessment author. Write {self.questions_per_subtopic}
multiple-choice questions for the following subtopic.

Subtopic:  "{sub_title}"
Reference content:
\"\"\"
{level1_content[:6000]}
\"\"\"

Constraints:
- Each question has exactly 4 options.
- 'correct_answer' MUST be the integer index (0..3) of the correct option.
- Vary difficulty across {{"easy","medium","hard"}}.
- Provide 1-3 'skill_tags' as snake_case strings.
- Output STRICT JSON only.

Schema:
{{
  "questions": [
    {{
      "question_text": str,
      "options": [str, str, str, str],
      "correct_answer": int,
      "difficulty": "easy" | "medium" | "hard",
      "skill_tags": [str]
    }}
  ]
}}
"""
        data = await self._json_call(prompt, "questions")
        raw = data.get("questions", [])[: self.questions_per_subtopic]
        out: List[Dict[str, Any]] = []
        for i, q in enumerate(raw):
            opts = q.get("options") or []
            ca = q.get("correct_answer", 0)
            if not isinstance(opts, list) or len(opts) < 2:
                continue
            if isinstance(ca, str):
                # be forgiving — if model gave the option text, resolve it
                ca = opts.index(ca) if ca in opts else 0
            ca = max(0, min(int(ca), len(opts) - 1))
            qid = f"q_{subtopic_id[:8]}_{i+1:03d}"
            out.append({
                "id": qid,
                "unit_id": unit_id,
                "subtopic_id": subtopic_id,
                "question_text": str(q.get("question_text") or "").strip() or "Question",
                "options": [str(o) for o in opts][:4],
                "correct_answer": ca,
                "difficulty": q.get("difficulty") if q.get("difficulty") in ("easy", "medium", "hard") else "medium",
                "skill_tags": [str(t) for t in (q.get("skill_tags") or [])][:5],
                "textbook_reference": "AI Generated",
            })
        return out

    # ----- public API: streaming generator ---------------------------------
    async def generate_course_stream(
        self,
        raw_text: str,
        course_name: str,
        author_uid: Optional[str] = None,
    ) -> AsyncIterator[CourseGenProgress]:
        """Yield CourseGenProgress events through every stage of generation.

        The final event has ``stage="done"`` and ``payload`` containing the
        fully-shaped course ready to persist.
        """
        if not genai_service.client:
            yield CourseGenProgress(stage="error", message="GenAI client not configured (missing GEMINI_API_KEY).")
            return

        try:
            yield CourseGenProgress(stage="outline", message="Reading source material…", progress=0.05)

            chunks = _chunk_text(raw_text)
            outline = await self._outline(chunks, course_name)
            units_in = outline.get("units") or []
            if not units_in:
                yield CourseGenProgress(stage="error", message="Could not derive a course outline from the source text.")
                return

            course_id = _slugify(outline.get("title") or course_name)
            course_doc: Dict[str, Any] = {
                "id": course_id,
                "title": outline.get("title") or course_name,
                "description": outline.get("description") or "",
                "is_published": False,        # require explicit publish
                "ai_generated": True,
                "author_uid": author_uid,
                "total_units": len(units_in),
            }

            units_out: List[Dict[str, Any]] = []
            subtopics_out: List[Dict[str, Any]] = []
            questions_out: List[Dict[str, Any]] = []

            yield CourseGenProgress(
                stage="subtopics",
                message=f"Designing {len(units_in)} units…",
                progress=0.15,
                payload={"course_id": course_id, "units_planned": len(units_in)},
            )

            # Stage 2: subtopics for each unit (parallel within a batch)
            unit_jobs = [self._subtopics_for_unit(u.get("title", ""), u.get("description", ""), raw_text) for u in units_in]
            unit_subtopics = await asyncio.gather(*unit_jobs, return_exceptions=True)

            for u_idx, (unit_in, sub_list) in enumerate(zip(units_in, unit_subtopics), start=1):
                if isinstance(sub_list, Exception) or not sub_list:
                    logger.warning("subtopics gen failed for unit %s: %s", unit_in.get("title"), sub_list)
                    sub_list = []
                unit_id = f"u{u_idx}"
                units_out.append({
                    "id": unit_id,
                    "title": unit_in.get("title") or f"Unit {u_idx}",
                    "description": unit_in.get("description") or "",
                    "order": u_idx,
                })
                for s_idx, sub_in in enumerate(sub_list, start=1):
                    sub_title = sub_in.get("title") or f"Subtopic {s_idx}"
                    sub_id = _slugify(sub_title)
                    # ensure uniqueness within unit
                    if any(x["id"] == sub_id for x in subtopics_out):
                        sub_id = f"{sub_id}-{u_idx}-{s_idx}"
                    subtopics_out.append({
                        "id": sub_id,
                        "unit_id": unit_id,
                        "title": sub_title,
                        "order": s_idx,
                        "description": sub_in.get("description") or "",
                        # content_levels filled in next stage
                    })

            total_subs = len(subtopics_out)
            if not total_subs:
                yield CourseGenProgress(stage="error", message="No subtopics produced; aborting.")
                return

            # Stage 3: content levels (concurrent, throttled)
            sem = asyncio.Semaphore(4)

            async def _hydrate_content(sub):
                async with sem:
                    unit_title = next((u["title"] for u in units_out if u["id"] == sub["unit_id"]), "")
                    levels = await self._content_levels(unit_title, sub["title"], sub.get("description", ""))
                    sub["content"] = levels.get("1", "")
                    sub["content_levels"] = levels
                return sub

            for i in range(0, total_subs, 4):
                yield CourseGenProgress(
                    stage="content",
                    message=f"Writing content variants ({min(i+4,total_subs)}/{total_subs})…",
                    progress=0.25 + 0.4 * (i / max(total_subs, 1)),
                )
                batch = subtopics_out[i:i + 4]
                await asyncio.gather(*(_hydrate_content(s) for s in batch))

            # Stage 4: questions
            for i in range(0, total_subs, 4):
                yield CourseGenProgress(
                    stage="questions",
                    message=f"Drafting questions ({min(i+4,total_subs)}/{total_subs})…",
                    progress=0.65 + 0.3 * (i / max(total_subs, 1)),
                )
                batch = subtopics_out[i:i + 4]
                qs_lists = await asyncio.gather(*(
                    self._questions_for_subtopic(s["unit_id"], s["id"], s["title"], s.get("content", ""))
                    for s in batch
                ))
                for qs in qs_lists:
                    questions_out.extend(qs)

            yield CourseGenProgress(
                stage="done",
                message="Curriculum ready.",
                progress=1.0,
                payload={
                    "course": course_doc,
                    "units": units_out,
                    "subtopics": subtopics_out,
                    "questions": questions_out,
                    "summary": {
                        "course_id": course_id,
                        "units": len(units_out),
                        "subtopics": len(subtopics_out),
                        "questions": len(questions_out),
                    },
                },
            )

        except Exception as e:
            logger.exception("Course generation failed: %s", e)
            yield CourseGenProgress(stage="error", message=f"Generation failed: {e}")

    # ----- legacy entry point kept for compatibility -----------------------
    async def generate_curriculum(self, raw_text: str, course_name: str) -> Dict[str, Any]:
        """One-shot wrapper that drains the streaming generator and returns the final payload."""
        last: Dict[str, Any] = {}
        async for ev in self.generate_course_stream(raw_text, course_name):
            if ev.stage == "error":
                return {"error": ev.message}
            if ev.stage == "done" and ev.payload:
                last = ev.payload
        if not last:
            return {"error": "Generation produced no output."}
        return last

    # ----- internal: JSON-coerced LLM call ---------------------------------
    async def _json_call(self, prompt: str, label: str) -> Dict[str, Any]:
        try:
            response = await run_in_threadpool(
                lambda: genai_service.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"},
                )
            )
            text = (response.text or "").strip()
            # Some Gemini responses wrap JSON in fenced blocks despite mime hint.
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("LLM '%s' returned invalid JSON: %s", label, e)
            raise
        except Exception:
            logger.exception("LLM '%s' call failed", label)
            raise


# Singleton instance
course_gen_service = CourseGenService()
