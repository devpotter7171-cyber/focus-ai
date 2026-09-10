# ERRORS.md — Focus-AI Bug Log & Lessons Learned

> Non-obvious bugs, AI mistakes, and their fixes. Prevents repeating the same issues.

---

## [2025-12] Firebase credential path not found in different working directories

**Symptom**: `FileNotFoundError` when running backend from project root vs. from `backend/` dir.

**Cause**: `firebase-adminsdk.json` path was hardcoded relative to CWD.

**Fix**: `database.py` now searches multiple candidate paths:
```python
possible_paths = [
    os.getenv("FIREBASE_ADMIN_CREDENTIALS"),
    "firebase-adminsdk.json",
    "backend/firebase-adminsdk.json",
    os.path.join(current_dir, "firebase-adminsdk.json"),
    os.path.join(os.path.dirname(__file__), "firebase-adminsdk.json"),
]
```

**Don't repeat**: Never hardcode a single relative path for credentials. Always search multiple locations.

---

## [2025-12] ML model import failures in backend services

**Symptom**: `ImportError: No module named 'inference'` when backend tries to use ML models.

**Cause**: `ml/` directory is not on Python's `sys.path` when running from `backend/`.

**Fix**: Each service that imports from `ml/` adds the path explicitly:
```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "ml"))
```

**Don't repeat**: When importing across top-level directories (`backend/` → `ml/`), always check `sys.path`. Don't assume the project root is in the path.

---

## [2025-12] Bandit model crashes when context has missing keys

**Symptom**: `KeyError` in `bandit_logic.py` when context dict doesn't have `time_on_question_norm`.

**Cause**: The API route wasn't including all expected fields in the context dict.

**Fix**: `bandit_service.py` now provides default values for all context fields:
```python
context = {
    "user_id": user_id,
    "confusion_score": confusion_score,
    "avg_mastery": mastery,
    "learning_style": learning_style,
    "time_on_question_norm": 0.5  # default
}
```

**Don't repeat**: Always provide defaults for all context fields. The bandit expects a fixed-length feature vector.

---

## [2026-01] Frontend build failures from wildcard `.json` gitignore

**Symptom**: `tsconfig.json`, `package.json` not tracked by git after adding `*.json` to `.gitignore`.

**Cause**: `.gitignore` had `*.json` to block Firebase credentials, but it was too broad.

**Fix**: Added explicit exceptions:
```gitignore
*.json
!package.json
!package-lock.json
!tsconfig.json
!firestore.indexes.json
!seed/*.json
```

**Don't repeat**: When ignoring by extension, always whitelist the known-safe files.

---

## [2026-01] CORS errors in development

**Symptom**: `Access-Control-Allow-Origin` errors when frontend calls backend.

**Cause**: CORS origins didn't include both `localhost` and `127.0.0.1`.

**Fix**: Currently forced to `["*"]` for development. See `main.py` line 61.

**Don't repeat**: When deploying to production, must set `CORS_ORIGINS` env var to explicit domain list. The `["*"]` wildcard is a security risk.

---

## [2026-05] Moved feedbackApi.ts broke import

**Symptom**: Build error after moving `feedbackApi.ts` from `components/` to `lib/`.

**Cause**: `AdaptiveInsightsPanel.tsx` had a relative import `./feedbackApi`.

**Fix**: Updated to absolute alias import `@/lib/feedbackApi`.

**Don't repeat**: When moving files, always `grep` for all imports of that file before moving. Use absolute `@/` imports to minimize breakage from file moves.

---

## Template for New Entries

```markdown
## [YYYY-MM] Short description

**Symptom**: What you saw / what error message appeared.

**Cause**: Root cause.

**Fix**: What was done to fix it.

**Don't repeat**: One-line prevention rule.
```
