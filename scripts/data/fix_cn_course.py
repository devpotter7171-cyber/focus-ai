"""
Resume CN course: generate only the missing subtopics + questions.
Skips subtopics that already exist in Firestore.
"""
import asyncio
import json
import logging
import re
import sys
import time
from typing import Dict, Any
from dotenv import load_dotenv
load_dotenv()

import httpx
import os
from database import get_db

logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"

FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "meta-llama/llama-3.2-3b-instruct:free",
]

_last_call = [0.0]
_MIN_INTERVAL = 1.5


async def call_llm_text(prompt: str, label: str) -> str:
    for attempt in range(3):
        elapsed = time.time() - _last_call[0]
        if elapsed < _MIN_INTERVAL:
            await asyncio.sleep(_MIN_INTERVAL - elapsed)
        _last_call[0] = time.time()

        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "HTTP-Referer": "https://focus-ai.demo",
            "X-Title": "Focus-AI CN Fix",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            for model in FREE_MODELS:
                try:
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are a curriculum content writer. Write clear educational content in Markdown."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.5,
                        "max_tokens": 1500,
                    }
                    resp = await client.post(OPENROUTER_BASE, json=payload, headers=headers)
                    if resp.status_code == 429:
                        await asyncio.sleep(3)
                        continue
                    if resp.status_code >= 400:
                        continue
                    data = resp.json()
                    text = (data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
                    if text and len(text) > 50:
                        logger.info(f"  [{label}] OK ({len(text)} chars)")
                        return text
                except:
                    continue

        if attempt < 2:
            wait = 45 * (attempt + 1)
            logger.warning(f"  [{label}] All failed. Waiting {wait}s...")
            await asyncio.sleep(wait)

    return f"# {label}\n\nContent forthcoming."


async def call_llm_json(prompt: str, label: str) -> Dict[str, Any]:
    for attempt in range(3):
        elapsed = time.time() - _last_call[0]
        if elapsed < _MIN_INTERVAL:
            await asyncio.sleep(_MIN_INTERVAL - elapsed)
        _last_call[0] = time.time()

        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "HTTP-Referer": "https://focus-ai.demo",
            "X-Title": "Focus-AI CN Fix",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            for model in FREE_MODELS:
                try:
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "Output ONLY valid JSON. No markdown fences."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 3000,
                    }
                    resp = await client.post(OPENROUTER_BASE, json=payload, headers=headers)
                    if resp.status_code == 429:
                        await asyncio.sleep(3)
                        continue
                    if resp.status_code >= 400:
                        continue
                    data = resp.json()
                    text = (data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
                    if text.startswith("```"):
                        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
                    if text and text[0] != '{':
                        idx = text.find('{')
                        if idx >= 0: text = text[idx:]
                    if text and text[-1] != '}':
                        idx = text.rfind('}')
                        if idx >= 0: text = text[:idx+1]
                    result = json.loads(text)
                    logger.info(f"  [{label}] OK")
                    return result
                except json.JSONDecodeError:
                    continue
                except:
                    continue

        if attempt < 2:
            wait = 60 * (attempt + 1)
            logger.warning(f"  [{label}] All failed. Waiting {wait}s...")
            await asyncio.sleep(wait)

    raise RuntimeError(f"All models failed for {label}")


def slugify(text: str, max_len: int = 50) -> str:
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text or "").strip().lower()
    s = re.sub(r"\s+", "-", s)
    return s[:max_len].strip("-") or "untitled"


LEVEL_PROMPTS = {
    "1": "Write an expert-level explanation (200-300 words, formal, rigorous)",
    "2": "Write a detailed textbook-style explanation (200-300 words, accessible)",
    "3": "Write a concise key-points summary (150-200 words, bullet points)",
    "4": "Write a real-world application example (200-300 words, worked example)",
    "5": "Write a beginner-friendly analogy explanation (150-250 words, simple metaphor)",
}


async def main():
    db = next(get_db())
    course_id = "cn"

    # Get all units and their subtopics
    course_ref = db.collection("courses").document(course_id)
    units = list(course_ref.collection("units").stream())
    units.sort(key=lambda d: d.to_dict().get("order", 0))

    logger.info(f"CN course has {len(units)} units")

    missing_subs = []
    all_existing_subs = []

    for unit_doc in units:
        unit_data = unit_doc.to_dict()
        unit_id = unit_doc.id
        subs = list(course_ref.collection("units").document(unit_id).collection("subtopics").stream())
        existing_ids = {s.id for s in subs}
        all_existing_subs.extend(subs)
        logger.info(f"  {unit_id} ({unit_data.get('title','')}): {len(subs)} subtopics exist")

    # We need to figure out which subtopics are missing. The original outline
    # generated 20, but only ~12 got seeded. Let's check which unit has fewer
    # than 4 subtopics and generate new ones for those.

    for unit_doc in units:
        unit_data = unit_doc.to_dict()
        unit_id = unit_doc.id
        subs = list(course_ref.collection("units").document(unit_id).collection("subtopics").stream())

        if len(subs) >= 4:
            logger.info(f"  {unit_id}: already has {len(subs)} subtopics, skipping")
            continue

        # Need more subtopics for this unit
        needed = 4 - len(subs)
        logger.info(f"  {unit_id}: only {len(subs)} subtopics, generating {needed} more...")

        # Generate subtopics
        new_subs_data = await call_llm_json(f"""Design exactly {needed} NEW subtopics for this Computer Networks unit.
Unit: "{unit_data.get('title', '')}"
Description: "{unit_data.get('description', '')}"
Already existing subtopics (DO NOT duplicate): {[s.to_dict().get('title','') for s in subs]}
Output JSON: {{"subtopics": [{{"title": str, "description": str}}]}}""", f"new_subs_{unit_id}")

        for s_idx, sub_info in enumerate(new_subs_data.get("subtopics", [])[:needed], len(subs) + 1):
            sub_id = slugify(sub_info.get("title", f"topic-{s_idx}"))
            sub_title = sub_info.get("title", "")
            sub_desc = sub_info.get("description", "")

            # Generate 5 content levels
            levels = {}
            for lvl, instruction in LEVEL_PROMPTS.items():
                content = await call_llm_text(
                    f"""{instruction} for the following topic.
Topic: {sub_title}
Brief: {sub_desc}
Context: Computer Networks course, unit "{unit_data.get('title','')}"
Write in Markdown with headings.""",
                    f"L{lvl}_{sub_id[:15]}"
                )
                levels[lvl] = content

            # Seed to Firestore
            sub_ref = course_ref.collection("units").document(unit_id).collection("subtopics").document(sub_id)
            sub_ref.set({
                "id": sub_id,
                "title": sub_title,
                "content": levels.get("1", ""),
                "content_levels": levels,
                "order": s_idx,
            })
            logger.info(f"  Seeded: {sub_id}")

            missing_subs.append({"id": sub_id, "unit_id": unit_id, "title": sub_title, "content": levels.get("1", "")})

    # Generate questions for all subtopics (only for those without questions)
    existing_qs = list(db.collection("quiz").document(course_id).collection("questions").stream())
    existing_q_subtopics = {q.to_dict().get("subtopic_id") for q in existing_qs}
    logger.info(f"  Existing questions cover {len(existing_q_subtopics)} subtopics")

    # Get all subtopics now
    all_subs_now = []
    for unit_doc in units:
        unit_id = unit_doc.id
        subs = list(course_ref.collection("units").document(unit_id).collection("subtopics").stream())
        for s in subs:
            sd = s.to_dict()
            sd["unit_id"] = unit_id
            all_subs_now.append(sd)

    # Generate questions for subtopics that don't have any
    new_q_count = 0
    for sub in all_subs_now:
        if sub.get("id") in existing_q_subtopics:
            continue

        qs = await call_llm_json(f"""Write 3 MCQs for: "{sub.get('title','')}"
Content: {(sub.get('content',''))[:1500]}
Each has 4 options. correct_answer is 0-based index.
JSON: {{"questions": [{{"question_text": str, "options": [str,str,str,str], "correct_answer": int, "difficulty": "easy"|"medium"|"hard"}}]}}""",
            f"qs_{sub['id'][:20]}")

        for i, q in enumerate(qs.get("questions", [])[:3], 1):
            qid = f"q_{sub['id'][:12]}_{i:03d}"
            ca = q.get("correct_answer", 0)
            if isinstance(ca, str):
                try: ca = q.get("options", []).index(ca)
                except: ca = 0
            db.collection("quiz").document(course_id).collection("questions").document(qid).set({
                "id": qid,
                "unit_id": sub.get("unit_id", ""),
                "subtopic_id": sub["id"],
                "question_text": q.get("question_text", "Question"),
                "options": q.get("options", ["A","B","C","D"])[:4],
                "correct_answer": max(0, min(3, int(ca))),
                "difficulty": q.get("difficulty", "medium"),
                "skill_tags": [slugify(sub.get("title",""))[:20]],
            })
            new_q_count += 1

    logger.info(f"\nDONE! Generated {len(missing_subs)} new subtopics + {new_q_count} new questions for CN.")


if __name__ == "__main__":
    asyncio.run(main())
