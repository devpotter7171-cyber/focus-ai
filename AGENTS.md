# AGENTS.md — Focus-AI

> This file provides context for AI coding assistants working on this project.

## Project Overview

Focus-AI is an **adaptive learning platform** that detects student confusion through behavioral signals and dynamically adjusts content delivery using reinforcement learning. It's a research-grade system built for an IEEE paper.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | FastAPI (Python 3.10+), Pydantic v2, Uvicorn |
| **Database** | Firebase Firestore (primary), SQLAlchemy models (schema reference) |
| **Auth** | Firebase Auth (client-side) → backend verifies ID tokens |
| **ML** | XGBoost, PyTorch (LSTM), scikit-learn, custom LinUCB bandit |
| **UI Components** | Radix UI primitives + custom "neural" themed components |
| **Deployment** | Docker Compose (Postgres, Redis, Nginx) |

## File Structure Map

```
Focus-AI/
├── backend/                 # FastAPI REST API
│   ├── main.py              # App entry (lifespan loads ML models)
│   ├── database.py          # Firebase Admin SDK init + Firestore client
│   ├── routers/             # Route handlers (one per domain)
│   ├── services/            # Business logic (bandit, ML, adaptive)
│   ├── models/sql_models.py # SQLAlchemy ORM (schema reference)
│   ├── schemas/common.py    # Pydantic request/response schemas
│   └── tests/               # Pytest test suite
├── frontend/                # Next.js web app
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   │   ├── neural/          # Custom themed components (NeuralButton, etc.)
│   │   ├── ui/              # Shadcn/Radix primitives
│   │   └── layout/          # Layout components
│   ├── context/             # React context (AuthContext)
│   ├── hooks/               # Custom hooks (useBehavior, use-toast)
│   ├── lib/                 # Utilities (api.ts, firebase.ts, feedbackApi.ts)
│   └── types/               # TypeScript type definitions
├── ml/                      # Machine learning pipeline
│   ├── training/            # Training scripts (per model)
│   ├── inference/           # Inference modules (imported by backend)
│   ├── models/              # Serialized .pkl model files
│   └── data/                # Synthetic CSV training data
├── docs/                    # Technical documentation & AI assistance
├── research/                # IEEE Paper artifacts (LaTeX, figures, refs)
├── scripts/                 # Utility scripts
│   ├── data/                # Seeding, migration, patching
│   ├── visualization/       # Figure/plot generation
│   └── debug/               # Audit & debug utilities
├── seed/                    # Initial DBMS course content (JSON)
└── infrastructure/          # Nginx, deployment configs
```

## API Pattern

- All API routes are prefixed with `/api/v1/`
- Routes in `backend/routers/` are registered in `main.py`
- Auth is via Firebase ID tokens in `Authorization: Bearer <token>` headers
- The `apiFetch()` function in `frontend/lib/api.ts` handles auth, retries, and errors automatically

## Key Data Flow

```
User interacts with CoursePlayer
  → useBehavior hook captures behavioral signals (dwell time, scrolls, tab switches)
  → POST /api/v1/behavior/log
  → ml_service runs confusion_infer.predict_confusion()
  → If confused: bandit_service selects best content arm
  → Frontend receives recommendation and adapts UI
  → User responds → POST reward to update bandit
```

## State Management

- **Auth**: Firebase `onAuthStateChanged` → React Context (`AuthContext`)
- **Behavior tracking**: `useBehavior` custom hook → periodic API posts
- **ML models**: Loaded once at startup via `lifespan()` → singleton `ml_service`
- **Bandit state**: In-memory singleton (`bandit_service`) wrapping LinUCB from `ml/inference/`

## Do's

1. Use `apiFetch()` from `lib/api.ts` for all API calls — never raw `fetch()`
2. Use Pydantic v2 `model_config = ConfigDict(from_attributes=True)` for ORM schemas
3. Use the existing `neural/` component library for UI — it has buttons, badges, cards, skeletons
4. All backend services use the singleton pattern — instantiate once at module level
5. Keep ML inference in `ml/inference/` and business logic in `backend/services/`
6. Use structured JSON logging (`logger = logging.getLogger(__name__)`)
7. All routes that require auth use `dependencies=[Depends(get_current_user)]` in the router registration
8. Use `"use client"` directive for any component that uses React hooks or browser APIs
9. Run `next build` to verify frontend changes compile without errors
10. Keep the 200ms latency constraint in mind — the backend has middleware that logs violations

## Don'ts

1. Don't add new Python dependencies without updating `backend/requirements.txt`
2. Don't put API/data logic in `components/` — use `lib/` for API utilities and `hooks/` for data hooks
3. Don't import from `ml/` directly in routers — always go through `services/`
4. Don't commit `.env` files, `.db` files, or build logs — see `.gitignore`
5. Don't use SQLAlchemy sessions for data access — the app uses Firestore (the SQL models are schema reference only)
6. Don't modify the bandit arm names without updating `EXPLANATION_TYPES` in both `bandit_service.py` and `bandit_logic.py`
7. Don't remove the `LatencyMiddleware` — it's needed for IEEE paper claims verification
8. Don't use `any` types in TypeScript — define proper interfaces in `types/`
9. Don't create debug/temp files in source directories — use `scripts/debug/` for throwaway scripts
10. Don't bypass the `AuthContext` for user state — always use `useAuth()` hook

## Safe to Run Without Asking

- `npm run lint` / `npm run build` (frontend)
- `pytest backend/tests/ -v` (backend tests)
- `python -m py_compile <file>` (syntax check)
- `make help` (show available commands)

## Requires Approval

- `npm install <package>` / `pip install <package>` (new dependencies)
- Any changes to `database.py` or `firebase-adminsdk.json`
- Modifying ML model training parameters
- Changing API route prefixes or auth middleware
- Deleting any files
- Running `docker-compose up`
