"""Quick connectivity test for the configured Gemini model.

Loads backend/.env, then exercises both raw client + the GenAIService
singleton so we know the runtime path also works.
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(ROOT, "backend", ".env"))

# Make `backend/` importable so we can hit the real service.
sys.path.insert(0, os.path.join(ROOT, "backend"))

from google import genai  # noqa: E402


async def main() -> int:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    if not api_key:
        print("FAIL: GEMINI_API_KEY missing from backend/.env")
        return 1

    print(f"Using model: {model}")

    # 1) Raw client smoke test.
    try:
        client = genai.Client(api_key=api_key)
        listed = [getattr(m, "name", "") for m in client.models.list()]
        match = [n for n in listed if model in n]
        print(f"List match: {match[:3]}")

        resp = client.models.generate_content(
            model=model,
            contents="Reply with exactly: OK",
        )
        text = (resp.text or "").strip()
        print(f"Raw response: {text!r}")
        if not text:
            print("FAIL: empty raw response")
            return 2
    except Exception as e:
        print(f"FAIL raw client: {e}")
        return 3

    # 2) GenAIService end-to-end (uses the model picked from env).
    try:
        from services.genai_service import genai_service, DEFAULT_GEMINI_MODEL

        print(f"Service DEFAULT_GEMINI_MODEL: {DEFAULT_GEMINI_MODEL}")
        hint = await genai_service.generate_hint(
            question_text="What is the time complexity of binary search?",
            correct_answer="O(log n)",
            level=1,
        )
        print(f"generate_hint -> {hint!r}")
        if not hint:
            print("FAIL: service returned no hint")
            return 4
    except Exception as e:
        print(f"FAIL service path: {e}")
        return 5

    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
