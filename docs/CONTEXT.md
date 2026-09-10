# CONTEXT.md — Focus-AI Session Starter

> Paste this at the start of new AI sessions for instant project context.

## App Summary

**Focus-AI** is an adaptive learning platform that detects student confusion via behavioral signals and uses a LinUCB contextual bandit to select optimal content presentation strategies. Built as a full-stack web app (Next.js 16 + FastAPI + ML pipeline) for an IEEE research paper.

## Tech Stack (One-Liner)

Next.js 16 / React 19 / TypeScript / Tailwind v4 / Radix UI — FastAPI / Pydantic v2 / Firebase Auth & Firestore — XGBoost / PyTorch LSTM / LinUCB Bandit — Docker Compose

## Key Entry Points

| What | Path |
|------|------|
| Backend API | `backend/main.py` |
| Frontend app | `frontend/app/page.tsx` |
| API client | `frontend/lib/api.ts` |
| Auth context | `frontend/context/AuthContext.tsx` |
| Behavior tracking | `frontend/hooks/useBehavior.ts` |
| ML model loading | `backend/services/ml_service.py` |
| Bandit logic | `backend/services/bandit_service.py` → `ml/inference/bandit_logic.py` |
| Confusion detection | `ml/inference/confusion_infer.py` |
| Database init | `backend/database.py` (Firebase Admin SDK) |
| Course player (main UX) | `frontend/components/CoursePlayer.tsx` |

## API Base

- Backend: `http://localhost:8000` (API at `/api/v1/`)
- Frontend: `http://localhost:3000`
- All API calls go through `apiFetch()` in `frontend/lib/api.ts`

## Key Constraints

- **200ms latency limit** — backend has middleware enforcing this (IEEE paper claim)
- **Firebase-first** — auth and data persistence via Firebase, NOT SQL
- **Offline ML** — all models are pre-trained `.pkl` files loaded at startup
- **Seed 42** — all experiments use fixed random seed for reproducibility
- **6 bandit arms** — visual, step, example, analogy, easier, harder
- **Windows dev** — primary dev environment is Windows with `start_project.bat`

## Quick Commands

```bash
# Start everything (Windows)
start_project.bat

# Or manually
cd backend && python -m uvicorn main:app --reload --port 8000
cd frontend && npm run dev

# Tests
cd backend && pytest tests/ -v
cd frontend && npm run build

# Train models
cd ml && python training/train_confusion.py
```

## Current State

- Core adaptive loop is functional (confusion detection → bandit recommendation → reward update)
- DBMS course fully seeded with multi-level questions
- Frontend has dashboard, course player, assessment, progress tracking, admin, and teacher views
- Project was recently reorganized — see `AGENTS.md` for full structure
