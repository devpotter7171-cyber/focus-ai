# ARCHITECTURE.md — Focus-AI

## System Overview

Focus-AI is a three-tier adaptive learning system: a **Next.js frontend** captures learner behavior, a **FastAPI backend** orchestrates ML inference and data persistence, and an **ML pipeline** provides confusion detection, knowledge tracing, and content recommendation via contextual bandits.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                     │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │ App      │  │ CoursePlayer │  │ Dashboard │  │ Assessment │ │
│  │ Router   │  │ (main UX)   │  │           │  │            │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └─────┬──────┘ │
│       │               │               │               │         │
│  ┌────┴───────────────┴───────────────┴───────────────┴──────┐  │
│  │              Shared Layer                                  │  │
│  │  AuthContext │ useBehavior │ apiFetch │ feedbackApi        │  │
│  └────────────────────────┬───────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP (REST)
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI)                           │
│                                                                   │
│  ┌──────────────────── Routers ──────────────────────┐           │
│  │ auth │ courses │ behavior │ ml │ answers │ assess  │           │
│  └──────────────────────┬────────────────────────────┘           │
│                         │                                         │
│  ┌──────────────────── Services ─────────────────────┐           │
│  │ ml_service │ bandit_service │ adaptive │ seed     │           │
│  └──────────────────────┬────────────────────────────┘           │
│                         │                                         │
│  ┌─── Database ───┐    │    ┌─── ML Inference ───────┐          │
│  │   Firestore    │    │    │  confusion_infer       │          │
│  │   (via Admin   │◄───┤    │  bandit_logic          │          │
│  │    SDK)        │    │    │  dkt_infer             │          │
│  └────────────────┘    │    │  profiler_infer        │          │
│                        │    └─────────┬──────────────┘          │
│                        │              │ imports                   │
└────────────────────────┼──────────────┼──────────────────────────┘
                         │              │
                         │    ┌─────────▼──────────────┐
                         │    │     ML PIPELINE         │
                         │    │  ml/models/*.pkl        │
                         │    │  ml/training/           │
                         │    │  ml/data/ (synthetic)   │
                         │    └────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Firebase Auth     │
              │   (token verify)    │
              └─────────────────────┘
```

## Module Boundaries

### Frontend → Backend
- **Protocol**: REST over HTTP
- **Base URL**: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`)
- **Auth**: Firebase ID token in `Authorization: Bearer` header
- **Client**: `apiFetch<T>()` in `lib/api.ts` — handles retries, timeouts, auth injection

### Backend → ML Pipeline
- **Mechanism**: Direct Python imports via `sys.path` manipulation
- **Path setup**: `backend/services/bandit_service.py` adds `../../ml` to `sys.path`
- **Models loaded at startup**: `ml_service.load_models()` called in FastAPI `lifespan()`
- **Singleton pattern**: Each service creates one instance at module level

### Backend → Firestore
- **SDK**: `firebase-admin` with service account credentials
- **Init**: `database.py` searches multiple paths for credentials file
- **Access**: `get_db()` dependency yields a Firestore client
- **Note**: SQLAlchemy models in `models/sql_models.py` define the schema but Firestore is the actual datastore

## Data Models

```
User ──┬── BehaviorLog (event_type, data JSON, timestamp)
       ├── UserAnswer (question_id, selected_answer, is_correct, time_taken_ms)
       ├── UserProgress (subtopic_id, bandit_arm_selected, arm_confidence, answer_correct)
       ├── UserFeedback (is_confused, feedback_text — ground truth labels)
       └── InterventionLog (subtopic, confusion_score)

Course ── Unit ── Subtopic ── Question
                  (content)    (text, options, correct_answer, difficulty)
```

## ML Models

| Model | Algorithm | Input | Output | File |
|-------|-----------|-------|--------|------|
| Confusion Detector | XGBoost | Behavioral signals (6 features) | P(confused) ∈ [0,1] | `confusion_model.pkl` |
| Content Bandit | LinUCB | User context vector | Best arm index + UCB score | `bandit_model.pkl` |
| Knowledge Tracer | LSTM (PyTorch) | Answer sequence | Skill mastery vector | `dkt_model.pkl` |
| Cognitive Profiler | Clustering | Behavior patterns | Profile label (Skimmer/Reader/Balanced) | `profile_model.pkl` |
| Weak Concept Detector | XGBoost | Answer patterns | Weak skill probabilities | `weak_concept_model.pkl` |

## Bandit Arms (Content Strategies)

```
Index  Name      Description
0      visual    Visual diagrams and infographics
1      step      Step-by-step walkthrough
2      example   Concrete examples
3      analogy   Real-world analogies
4      easier    Simpler version of content
5      harder    More challenging version
```

Defined in `bandit_service.EXPLANATION_TYPES` and mirrored in `ml/inference/bandit_logic.py`.

## Key Architecture Decisions (ADRs)

### ADR-1: Firestore over SQL
**Decision**: Use Firebase Firestore as the primary datastore despite having SQLAlchemy models.
**Reason**: Firebase provides free auth + database for a research project. The SQLAlchemy models remain as schema documentation and for potential future migration to PostgreSQL (docker-compose already has Postgres configured).

### ADR-2: In-Memory ML Models
**Decision**: Load all ML models into memory at startup as singletons.
**Reason**: Models are small (<200KB total). Loading once avoids disk I/O during inference, keeping request latency under the 200ms constraint required for the IEEE paper's "real-time" claim.

### ADR-3: Bandit Heuristic Fallback
**Decision**: If the LinUCB model fails to load, fall back to rule-based heuristics.
**Reason**: The system must always produce a recommendation. Heuristic fallback ensures graceful degradation — confusion > 0.7 → "easier", mastery > 0.8 → "harder", etc.

### ADR-4: Behavior Tracking via Custom Hook
**Decision**: All behavior tracking goes through the `useBehavior` hook, not inline in components.
**Reason**: Centralizes behavioral signal collection (dwell time, scroll depth, tab switches, re-reads) and handles batching/debouncing before sending to the API.

### ADR-5: Neural Component Library
**Decision**: Custom "neural" themed components wrapping Radix UI rather than using a CSS framework directly.
**Reason**: Provides a consistent dark-themed, futuristic aesthetic across the app while keeping Radix's accessibility guarantees.

## Off-Limits Without Discussion

> ⚠️ Do NOT refactor these without explicit approval:

1. **Bandit arm definitions** — Changing arm count/names breaks stored model state and reward history
2. **API route prefixes** (`/api/v1/`) — Frontend, tests, and docker-compose all hardcode this
3. **Firebase credential loading logic** in `database.py` — Handles multiple environments
4. **`LatencyMiddleware`** — Required for paper claims, logs violations > 200ms
5. **ML model loading in `lifespan()`** — Startup order matters for dependency resolution
