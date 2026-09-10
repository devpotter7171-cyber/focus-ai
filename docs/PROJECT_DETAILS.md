# 📋 FOCUS-AI: Complete Project Documentation

> **Last Updated:** May 15, 2026
> **Repository:** [MadeNavaneeth/Focus-AI](https://github.com/MadeNavaneeth/Focus-AI)
> **Status:** Active Development | **License:** MIT

---

## 📌 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Data Model & Firestore Schema](#5-data-model--firestore-schema)
6. [Backend API Implementation](#6-backend-api-implementation)
7. [ML Pipeline & Models](#7-ml-pipeline--models)
8. [Adaptive Engine](#8-adaptive-engine)
9. [Frontend Implementation](#9-frontend-implementation)
10. [TypeScript Interfaces](#10-typescript-interfaces)
11. [Course Content](#11-course-content)
12. [Voice Command System](#12-voice-command-system)
13. [Operator & Teacher Dashboards](#13-operator--teacher-dashboards)
14. [DevOps & Deployment](#14-devops--deployment)
15. [Research Protocol](#15-research-protocol)
16. [Quick Reference](#16-quick-reference)
17. [Change Log](#17-change-log)

---

## 1. Project Overview

### What is Focus-AI?

**Focus-AI** is an **AI-powered adaptive learning platform** that detects student confusion in real-time and dynamically adjusts content delivery using machine learning.

The platform pairs three reinforcement loops:

| Loop | Trigger | Effect |
|------|---------|--------|
| **Real-time** | Behavioral signals (scrolls, hesitation, tab switches, hovers) | XGBoost predicts confusion → LinUCB picks the next explanation arm |
| **Path-level** | Rule-based struggle detector + BKT mastery snapshot | Walks the competency graph and surfaces the weakest prereq subtopics to revisit |
| **Long-term** | SM-2 spaced-repetition flashcard reviews | AGAIN/HARD/GOOD/EASY outcomes feed LinUCB so it learns from retained recall, not just immediate accuracy |

### Core Features

| Feature | Description | Technology |
|---------|-------------|------------|
| **Confusion Detection** | Real-time behavioral analysis | XGBoost classifier |
| **Adaptive Content** | Dynamic explanation-arm selection | Custom LinUCB contextual bandit (6 string arms) |
| **Knowledge Tracing** | Skill mastery prediction | Bayesian Knowledge Tracing + LSTM DKT |
| **Cognitive Profiling** | Learning-style segmentation | KMeans clustering |
| **Competency Graph** | Prerequisite-aware skill map | Pure-SVG layered DAG |
| **Adaptive Path Branching** | Weakest-prereq remediation paths | Pure-function graph walker |
| **Spaced Repetition** | Long-term retention | SM-2 SRS service + 30-day calendar heatmap |
| **Risk Predictor** | Dropout / disengagement signals | Rule-based weighted aggregation |
| **AI Lesson Tutor** | Selection-aware Q&A overlay | Gemini Flash via `genai_service` |
| **SQL Sandbox** | In-browser SQL exec for hands-on practice | sql.js (WASM, lazy-loaded) |
| **Voice Navigation** | Hands-free site control | Web Speech API + Levenshtein fuzzy matcher |
| **Live ML Monitor** | Real-time latency, bandit & confusion stats | In-process ring buffer + admin endpoints |
| **Cohort Analytics** | Class-wide competency map + at-risk students | Per-skill BKT aggregation |

### Research Goals

1. **RQ1**: Does real-time confusion detection improve learning outcomes?
2. **RQ2**: Does LinUCB select more effective explanations than random / static control?
3. **RQ3**: Which behavioral features are most predictive of confusion?
4. **RQ4**: Does retained-recall (SRS) reward feedback accelerate bandit convergence?

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Next.js 16, React 19)                   │
│ ┌────────────────┬──────────────────┬───────────────────────────────┐   │
│ │ App Router     │ Tailwind CSS v4  │ Framer Motion · Radix UI      │   │
│ │ TypeScript 5   │ "neural" theme   │ react-markdown · lucide-react │   │
│ └────────────────┴──────────────────┴───────────────────────────────┘   │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ Hooks: useBehavior · useVoiceCommand · useQuizVoice · useSqlSandbox│  │
│ │ Adaptive lib: difficulty.ts · struggleDetection.ts · pathBranching │  │
│ │ Voice registry: per-page command contributions w/o prop drilling   │  │
│ └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                              │ REST (apiFetch + Firebase ID tokens)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI · Python 3.10+)                  │
│ ┌─────────┬─────────┬──────────┬─────────┬──────────┬──────────────┐    │
│ │  auth   │ courses │ behavior │   ml    │ answers  │ assessment   │    │
│ │ tutor   │  admin  │ flashcard│questions│ recomms  │ ...           │   │
│ └─────────┴─────────┴──────────┴─────────┴──────────┴──────────────┘    │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Singletons: ml_service · bandit_service · srs_service · risk_service│ │
│ │ adaptive_service · bkt_service · genai_service · seed_service       │ │
│ │ latency_metrics (ring buffer for IEEE real-time claim verification) │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐
│   ML Models      │  │   Firestore    │  │    Firebase     │
│ XGBoost · KMeans │  │ (primary DB —  │  │     Auth        │
│ LSTM · LinUCB    │  │  document)     │  │ (ID tokens)     │
└──────────────────┘  └────────────────┘  └─────────────────┘
```

### Real-Time Data Flow (per quiz answer)

```
User submits answer
   ├─► useBehavior captures snapshot (hesitation, hovers, tabs, time)
   │
   └─► POST /api/v1/answers/submit                              [< 200 ms budget]
        ├─► answers.py grades the answer
        ├─► behavior.py → ml_service.predict_confusion()       (XGBoost)
        ├─► If confused → bandit_service.select_arm(context)   (LinUCB)
        │     • returns one of: visual / step / example / analogy / easier / harder
        │     • spawns SRS flashcard if confusion > 0.7
        ├─► struggleDetection.ts (FE) classifies the indicator type
        ├─► pathBranching.ts (FE) computes a remediation path
        └─► Response: confusion + recommendation + adaptive path
              │
              ├─► Frontend renders:
              │     • AdaptiveInsightsPanel (why this content?)
              │     • RemediationPathPanel (revisit prereqs A → B → C)
              │     • Updated BKT mastery
              └─► All steps logged to Firestore + LatencyMiddleware
                  records the per-route ms into the in-memory ring buffer
```

### Long-Term Data Flow (SRS retention loop)

```
Confusion event > 0.7
  └─► srs_service.spawn_card(arm, confusion, mastery)
        • Stores recommended_arm + spawn context on the per-user
          flashcard_progress doc

Day N: review due → POST /api/v1/flashcards/{id}/review
  ├─► SM-2 schedules next_review_at
  └─► Maps SM-2 outcome → bandit reward:
        AGAIN=0 · HARD=0.4 · GOOD=0.8 · EASY=1.0
      → ml_service.update_bandit(arm, ctx, reward)

LinUCB now learns from RETAINED recall, not just immediate accuracy.
```

---

## 3. Technology Stack

### Frontend (`frontend/package.json`)

```jsonc
{
  "next": "16.0.6",
  "react": "19.2.0",
  "typescript": "^5",
  "tailwindcss": "^4",
  "framer-motion": "^12.23.26",
  "firebase": "^12.6.0",
  "react-markdown": "^10.1.0",
  "@radix-ui/react-*": "various",   // Dialog, Tooltip, Popover, etc.
  "lucide-react": "^0.560.0",
  "sql.js": "^1.14.1",              // L1 in-browser SQL sandbox (WASM)
  "@types/sql.js": "^1.4.11"
}
```

### Backend (`backend/requirements.txt`)

```
fastapi
uvicorn
pydantic >= 2
firebase-admin
google-cloud-firestore
xgboost
torch
scikit-learn
pandas
numpy
pypdf            # admin PDF→course generator
google-genai     # Gemini Flash for LessonTutor + course gen
python-dotenv
pytest
```

### Database

- **Primary: Firebase Firestore** (document store).
- SQLAlchemy models in `backend/models/sql_models.py` are **schema reference only** and not used for live queries.
- All reads/writes go through the Firebase Admin SDK initialised in `backend/database.py`.

---

## 4. Project Structure

```
Focus-AI/
├── frontend/                       # Next.js 16 (App Router, Turbopack)
│   ├── app/                        # 16 routes
│   │   ├── page.tsx                # Landing
│   │   ├── layout.tsx              # Root: Inter + Libre Baskerville fonts
│   │   ├── globals.css             # Premium design system + dot-mesh bg
│   │   ├── login/ · signup/        # Firebase auth
│   │   ├── dashboard/              # Student home
│   │   ├── course/                 # Course catalog
│   │   │   └── [unitId]/[subtopicId]/  # Lesson + quiz player
│   │   ├── study/                  # SRS flashcard study session
│   │   ├── review/                 # 30-day SRS heatmap + weak skills
│   │   ├── progress/               # BKT-driven analytics
│   │   ├── competencies/           # NEW: prereq DAG + remediation paths
│   │   ├── settings/               # Pace + accessibility prefs
│   │   ├── assessment/             # Pre / Post tests
│   │   ├── demo/                   # Public demo mode
│   │   ├── teacher/dashboard/      # Cohort + confusion timeline + interventions
│   │   └── admin/
│   │       ├── content/            # CMS-style course editor
│   │       ├── experiment/         # A/B-test tracking
│   │       └── ml-monitor/         # Latency · bandit · confusion telemetry
│   ├── components/
│   │   ├── neural/                 # Custom themed primitives (Sidebar, Button…)
│   │   ├── layout/                 # DashboardLayout, MobileSidebar
│   │   ├── learning/               # StudySession, HintScaffold
│   │   ├── ui/                     # Radix-based shadcn primitives
│   │   ├── CoursePlayer.tsx        # Lesson + quiz + tutor + SQL playground host
│   │   ├── QuestionComponent.tsx   # MCQ + voice answer
│   │   ├── AdaptiveInsightsPanel.tsx
│   │   ├── CompetencyGraph.tsx     # NEW: pure-SVG DAG
│   │   ├── RemediationPathPanel.tsx# NEW: weakest-prereq paths
│   │   ├── ReviewForecastHeatmap.tsx# NEW: 30-day SRS heatmap
│   │   ├── CohortCompetencyPanel.tsx# NEW: teacher class-wide map
│   │   ├── ConfusionTimelinePanel.tsx# NEW: per-subtopic SVG sparkline
│   │   ├── LatencyMonitorPanel.tsx # NEW: live P50/P95/P99
│   │   ├── BanditScoresPanel.tsx   # NEW: live LinUCB arm scores
│   │   ├── ConfusionDistributionPanel.tsx# NEW: 10-bin histogram
│   │   ├── VoiceCommandButton.tsx  # Floating mic FAB + overlay
│   │   ├── VoiceCommandHelp.tsx    # Searchable command palette
│   │   ├── LessonTutor.tsx         # Gemini Q&A spotlight
│   │   ├── SqlPlayground.tsx       # In-browser SQLite (sql.js)
│   │   └── …                       # Modals, toasts, indicators
│   ├── hooks/
│   │   ├── useBehavior.ts          # Quiz-scoped behavior tracker
│   │   ├── useVoiceCommand.ts      # Web Speech API + fuzzy matching
│   │   ├── useQuizVoice.ts         # Quiz-specific commands
│   │   ├── voiceCommandRegistry.ts # Page-scoped contributions
│   │   ├── useSqlSandbox.ts        # sql.js loader + result diff
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── api.ts                  # apiFetch (auth + retry + timeout)
│   │   ├── firebase.ts             # Firebase client init
│   │   ├── feedbackApi.ts
│   │   ├── competencies.ts         # NEW: 11 competencies + DAG layout
│   │   ├── sqlChallenges.ts        # NEW: 5 starter SQL challenges
│   │   └── adaptive/
│   │       ├── difficulty.ts       # NEW: rule engine + reasons
│   │       ├── struggleDetection.ts# NEW: 5-indicator struggle detector
│   │       └── pathBranching.ts    # NEW: graph walker
│   ├── context/AuthContext.tsx
│   └── types/index.ts
│
├── backend/                        # FastAPI (Python 3.10+)
│   ├── main.py                     # Lifespan loads ML models + LatencyMiddleware
│   ├── database.py                 # Firebase Admin SDK init + Firestore client
│   ├── routers/
│   │   ├── auth.py                 # ID-token verification + sync-user
│   │   ├── courses.py              # Catalog reads + progress markers
│   │   ├── behavior.py             # Behavior pipeline (confusion → bandit)
│   │   ├── answers.py              # Grading + BKT update + mastery snapshot
│   │   ├── questions.py            # Quiz CRUD + hints
│   │   ├── recommendations.py      # Bandit recommendations
│   │   ├── ml.py                   # /infer/* + /train/* + /metrics/*
│   │   ├── assessment.py           # Pre/Post tests
│   │   ├── flashcards.py           # SRS + forecast + RL reward loop
│   │   ├── tutor.py                # NEW: Gemini Lesson Tutor endpoint
│   │   └── admin.py                # Dashboard + seed + risk +
│   │                               #     cohort + confusion timeline
│   ├── services/
│   │   ├── ml_service.py           # XGBoost + LinUCB + DKT + KMeans wrappers
│   │   ├── bandit_service.py       # Canonical 6-arm LinUCB
│   │   ├── bkt_service.py          # Bayesian Knowledge Tracing
│   │   ├── srs_service.py          # SM-2 + spawn-on-confusion + RL hooks
│   │   ├── risk_service.py         # NEW: rule-based dropout predictor
│   │   ├── adaptive_service.py     # Difficulty engine wrapper
│   │   ├── genai_service.py        # Gemini Flash for tutor + course gen
│   │   ├── course_gen_service.py   # PDF → course pipeline
│   │   ├── latency_metrics.py      # NEW: in-memory P50/P95/P99 buffer
│   │   └── seed_service.py
│   ├── schemas/common.py           # Pydantic request/response models
│   ├── models/sql_models.py        # Schema reference only
│   ├── tests/                      # 33 pytest cases
│   ├── exports/                    # CSV / PDF artefacts (research)
│   └── firebase-adminsdk.json      # gitignored
│
├── ml/                             # Machine learning
│   ├── training/                   # train_confusion / train_bandit / train_dkt …
│   ├── inference/                  # confusion_infer · bandit_logic · dkt_infer
│   ├── models/                     # *.pkl (loaded once at lifespan)
│   └── data/                       # Synthetic CSVs
│
├── seed/                           # Curriculum content
│   ├── dbms_units.json             # 6 units
│   ├── dbms_subtopics.json         # 26 subtopics with 5 difficulty levels
│   └── dbms_questions.json         # 80 questions, all 26 subtopics covered
│
├── scripts/
│   ├── data/
│   │   ├── seed_demo_cohort.py     # NEW: synthetic 12-student cohort
│   │   ├── append_missing_questions.py
│   │   └── …
│   ├── visualization/              # IEEE figure generation
│   └── debug/                      # Audit & one-off probes
│
├── research/                       # IEEE paper artifacts (LaTeX, figures)
├── docs/                           # Architecture / Conventions / this file
├── infrastructure/                 # Nginx, deployment configs
├── firestore.rules                 # Per-collection auth rules (deployed)
├── firebase.json · .firebaserc     # Firebase project config
└── docker-compose.yml
```

---

## 5. Data Model & Firestore Schema

> **Important:** Firestore is the **primary** datastore. The SQLAlchemy
> models in `backend/models/sql_models.py` are kept only as schema
> reference and ER-diagram input; they are **not** queried at runtime.

### Top-Level Collections

| Collection | Owner | Purpose |
|------------|-------|---------|
| `courses/{course_id}` | Admin | Course catalog (e.g. `dbms`) |
| `courses/{course_id}/units/{unit_id}` | Admin | Unit metadata |
| `courses/{course_id}/units/{unit_id}/subtopics/{subtopic_id}` | Admin | Subtopic content + 5 difficulty levels |
| `quiz/{course_id}/questions/{question_id}` | Admin | MCQ bank |
| `flashcards/{card_id}` | Admin | Global SRS card library |
| `users/{uid}` | User | Profile (`role: student/teacher/admin`, `profile_segment`) |
| `users/{uid}/progress/{subtopic_id}` | User | Completion markers |
| `users/{uid}/mastery/{skill}` | User | BKT `p_mastery` + attempts |
| `users/{uid}/flashcard_progress/{card_id}` | User | SM-2 state + originating bandit arm |
| `users/{uid}/answers/{auto}` | User | Per-question records |
| `behavior_logs/{auto}` | User-create | Real-time signals (admin-read) |
| `confusion_events/{auto}` | User-create | Captured confusion contexts (admin-read) |
| `quiz_results/{auto}` | User | Quiz-attempt summaries |
| `intervention_logs/{auto}` | Server-only | A/B research data |
| `user_feedback/{auto}` | User-create | Was this content confusing? |
| `learning_assessment/{auto}` | User | Pre/Post test results |

### Security (`firestore.rules`)

The rules enforce a tight **owner-only model**:

- `users/{uid}/**` — read/write only if `request.auth.uid == uid`
- Catalog (`courses`, `quiz`, `flashcards`) — signed-in read, **no client writes** (server seeds)
- Telemetry (`behavior_logs`, `confusion_events`, `user_feedback`) — owner-create only, no client read/update/delete
- `intervention_logs` — server-only via Admin SDK
- `quiz_results`, `user_answers` — owner-create + owner-read; no update/delete
- Default-deny for any unmatched path

### `flashcard_progress` enriched for the RL loop

```jsonc
{
  "card_id": "abc123…",
  "state": "REVIEW",                    // NEW / LEARNING / REVIEW / RELEARNING / MASTERED
  "interval": 5,                        // days
  "ease_factor": 2.5,
  "repetition": 3,
  "step_index": 0,
  "next_review_at": "<timestamp>",
  "last_reviewed_at": "<timestamp>",

  // RL fields captured at spawn time:
  "recommended_arm": "step",            // visual / step / example / analogy / easier / harder
  "spawn_confusion_score": 0.81,
  "spawn_mastery": 0.34
}
```

When the user reviews this card, the SM-2 outcome maps to a LinUCB
reward and the bandit is updated under the original spawn context.

### `intervention_logs` (research)

```jsonc
{
  "user_id": "demo_cohort_005",
  "subtopic": "normal-forms-1nf-3nf",
  "confusion_score": 0.78,
  "bandit_arm_selected": "analogy",
  "arm_confidence": 0.75,
  "all_arm_scores": [{"name": "visual", "score": 0.61, "is_selected": false}, …],
  "reason": "Reader profile with 78% confusion",
  "answer_correct": 0,
  "time_to_answer_ms": 24300,
  "post_confusion_score": 0.42,
  "experiment_id": "ablation_2026Q2",
  "is_control_group": 0,
  "timestamp": "<timestamp>"
}
```

---

## 6. Backend API Implementation

### Routers Overview

| Router | Endpoints (highlights) |
|--------|------------------------|
| `/api/v1/auth` | `POST /verify-token`, `POST /sync-user` |
| `/api/v1/courses` | `GET /`, `GET /{course_id}`, `GET /{course_id}/units/{unit_id}/subtopics/{subtopic_id}`, `POST /{course_id}/units/{unit_id}/subtopics/{subtopic_id}/complete`, `GET /{course_id}/progress` |
| `/api/v1/behavior` | `POST /` (logs + ML pipeline), `POST /preference`, `POST /feedback` |
| `/api/v1/questions` | `GET /{subtopic_id}`, `POST /answer`, `GET /hint/{question_id}/{level}` |
| `/api/v1/answers` | `POST /submit`, `GET /quiz-history/{user_id}`, `GET /mastery/{user_id}` |
| `/api/v1/recommendations` | `GET /` (one-shot bandit recommendation) |
| `/api/v1/ml` | `POST /infer/confusion`, `POST /infer/recommend`, `POST /infer/mastery`, `POST /train/{model}`, `GET /models/status`, **`GET /metrics/latency`**, **`GET /metrics/bandit`**, **`GET /metrics/confusion-distribution`** |
| `/api/v1/flashcards` | `GET /due`, `POST /{card_id}/review` (with RL feedback), **`GET /forecast`**, `POST /spawn-from-confusion` |
| `/api/v1/tutor` | `POST /lesson` (Gemini Q&A on selected text) |
| `/api/v1/admin` | `GET /dashboard`, `POST /seed`, `POST /upload-pdf`, `GET /risk/{user_id}`, `GET /risk` (cohort), **`GET /cohort/competencies`**, **`GET /subtopic/{subtopic_id}/confusion-timeline`** |
| `/api/v1/assessment` | `GET /pre`, `GET /post`, `POST /submit` |

### LatencyMiddleware (IEEE real-time claim)

`backend/main.py` keeps a 200-ms budget. Every request is timed and
written into `services/latency_metrics.py` keyed by **matched route
template** (so `/risk/{user_id}` collapses across users):

```python
class LatencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        ms = (time.time() - start) * 1000
        response.headers["X-Process-Time"] = f"{ms:.2f}ms"

        route = request.scope.get("route")
        path = getattr(route, "path", None) or request.url.path
        latency_metrics.record(f"{request.method} {path}", ms)

        if ms > 200:
            logger.warning(f"LATENCY VIOLATION: {ms:.2f}ms (Limit: 200ms)")
        return response
```

The buffer is bounded (200 samples per route) and exposes per-route
P50/P95/P99 + global rollup via `GET /api/v1/ml/metrics/latency`.

### Behavior Pipeline (`backend/routers/behavior.py`)

```python
async def process_behavior_with_ml(event, db) -> BehaviorResponse:
    # 1. Persist raw event
    await run_in_threadpool(lambda: db.collection("behavior_logs").add({
        "user_id": event.user_id,
        "event_type": event.event_type,
        "data": event.data,
        "timestamp": firestore.SERVER_TIMESTAMP,
    }))

    if event.event_type not in {"behavior_snapshot", "page_view", "question_attempt"}:
        return BehaviorResponse(status="logged")

    # 2. Confusion detection (XGBoost)
    score = ml_service.predict_confusion(event.model_dump())

    # 3. Bandit selection (LinUCB)
    if score > 0.4:
        arm = ml_service.predict_bandit({
            "user_id": event.user_id,
            "confusion_score": score,
            "avg_mastery": 0.5,
            "learning_style": ml_service.predict_profile([event.model_dump()]),
        })
        # ... build AdaptiveDecision with all_arm_scores ...

    # 4. Severe-confusion intervention: spawn an SRS card
    if score > 0.7:
        srs_service.spawn_card(
            db, event.user_id, topic_id, question, answer,
            recommended_arm=arm, confusion_score=score, mastery=0.5,
        )

    # 5. Log every intervention for the IEEE paper
    await log_intervention(...)
    return BehaviorResponse(...)
```

### SRS Reward Loop (`backend/routers/flashcards.py`)

```python
SRS_REWARD_MAP = {"AGAIN": 0.0, "HARD": 0.4, "GOOD": 0.8, "EASY": 1.0}

@router.post("/{card_id}/review")
def review_flashcard(card_id, review, user, db):
    # ... compute next SM-2 state ...
    arm = review.recommended_arm or stored_arm
    if arm:
        ml_service.update_bandit(
            arm_name=arm,
            context={"user_id": uid,
                     "confusion_score": review.confusion_score or stored_conf,
                     "mastery": review.mastery or stored_mastery},
            reward=SRS_REWARD_MAP.get(answer, 0.5),
        )
    return {"status": "success", "next_review_at": next_state["next_review_at"]}
```

---

## 7. ML Pipeline & Models

### Singleton ML Service (`backend/services/ml_service.py`)

Loaded once at FastAPI lifespan; thread-safe `predict_*` methods used
across routers.

```python
class MLService:
    def __init__(self):
        self.confusion_model = None     # XGBoost
        self.profile_model = None       # KMeans
        self.bandit_model = None        # Dict {alpha, A[], b[]} for LinUCB
        self.dkt_model = None           # PyTorch LSTM
        self.weak_concept_model = None  # XGBoost (weak-skill ranker)
        self.load_models()

    def predict_confusion(self, log) -> float: ...
    def predict_bandit(self, ctx) -> str:        # returns string arm name
    def predict_profile(self, logs) -> str: ...  # Skimmer / Reader / Balanced
    def update_bandit(self, arm_name, ctx, reward): ...   # delegates to bandit_service
```

### Canonical 6-Arm LinUCB

`bandit_service.EXPLANATION_TYPES = ["visual", "step", "example", "analogy", "easier", "harder"]`

UCB formula:

> `UCB_a = θ_aᵀ · x + α · √(xᵀ · A_a⁻¹ · x)`,  with `θ_a = A_a⁻¹ · b_a`

The model file is a portable dict `{alpha, A[], b[]}` so it survives
NumPy/PyTorch upgrades. `update_reward(user_id, arm_id, reward, ...)`
mutates `A` and `b` in-place; the in-memory state becomes the source
of truth between checkpoints.

### Model Inventory

| Model | Algorithm | Inputs | Output | Trained on |
|-------|-----------|--------|--------|------------|
| Confusion | XGBoost | hesitation_ms, tab_switches, scroll_depth, time_ms, attempts, wrong_option_hover_count | P(confused) | Synthetic CSV (`ml/data/`) + real `behavior_logs` |
| Profile | KMeans (k=3) | avg_time, scroll_speed, click_rate | Skimmer / Reader / Balanced | Synthetic + real |
| Bandit | LinUCB (6 arms × 10 features) | user context | Arm name | Online (real interactions + synthetic warmup) |
| DKT | LSTM | answer sequence | P(mastery) per skill | Synthetic |
| Weak-Concept | XGBoost | per-skill performance | Top-k weak skills | Synthetic |

### Bayesian Knowledge Tracing (`backend/services/bkt_service.py`)

Per-skill `{p_init, p_transit, p_slip, p_guess}` with Bayes update on
each answer. Result stored in `users/{uid}/mastery/{skill}` and
exposed via `GET /api/v1/answers/mastery/{uid}`.

---

## 8. Adaptive Engine

The adaptive layer is split between **client-side rule logic** (cheap,
explainable) and **server-side ML** (heavier signals).

### Client-Side: `frontend/lib/adaptive/`

#### `difficulty.ts` — pure rule engine

`calculateDifficultyAdjustment({accuracy, recentTrend, streakData}, currentDifficulty)`
returns `{adjustment, newDifficulty, reason, recommendations[]}`. The
panel uses this to populate the "Why this content?" dialog.

#### `struggleDetection.ts` — 5 indicators

```typescript
type StruggleType =
  | "time_on_task"
  | "repeated_errors"
  | "help_seeking"
  | "engagement_drop"
  | "difficulty_mismatch";

class StruggleTracker {
  add(event)        // sliding window of last N interactions
  analyze(metrics)  // returns aggregated severity + recommendedIntervention
}
```

#### `pathBranching.ts` — graph walker

```typescript
findRemediationPath({subtopicId, masteryBySubtopic, completed})
  → { steps: PathStep[], summary, action: "stay" | "review" | "branch" }

findChallengePath(masteryBySubtopic, completed)
  → { unlocked: Competency[], suggestedNext: PathStep[], summary }
```

BFS through `prerequisites` of the current subtopic's competency, ranks
weakest-first, capped at 3 actionable steps.

### Competency Graph (`frontend/lib/competencies.ts`)

11 competencies covering all 26 DBMS subtopics:

```
c_database_basics  ──►  c_er_modeling  ──►  c_relational_model
                                                  │
                                                  ├──►  c_relational_algebra  ──►  c_sql_fundamentals
                                                  │                                       │
                                                  ├──►  c_normalization                   ├──►  c_transactions  ──►  c_concurrency
                                                  │                                       │
                                                  └──►  c_nosql_basics                    └──►  c_indexing_storage
                                                                                                      │
                                                                                                      └──►  c_data_warehousing
                                                                                  (also fed by c_nosql_basics)
```

`computeLayers()` is cycle-safe (DFS with memoisation); `layoutGraph()`
emits Sugiyama-style positions consumed by `<CompetencyGraph>`.

### Server-Side: `risk_service.py`

Five weighted factors → 0–100 risk score:

| Factor | Weight | Trigger |
|--------|--------|---------|
| `long_absence` | 1.5 | No activity ≥ 7 days |
| `engagement_drop` | 1.3 | Minutes/day fell ≥ 40% |
| `performance_decline` | 1.2 | Recent accuracy ≤ 70% of overall |
| `difficulty_spike` | 1.0 | Hard content + low accuracy + incorrect streak |
| `pace_mismatch` | 0.8 | 2× expected time per topic |

Buckets: `complete` (<30) · `at_risk` (30–69) · `likely_dropout` (≥70).
Confidence reflects how much data backed the prediction, not the label.

---

## 9. Frontend Implementation

### Root Layout (`frontend/app/layout.tsx`)

```typescript
import { Inter, Libre_Baskerville } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif",
});

return (
  <html lang="en">
    <body className={`${inter.variable} ${libreBaskerville.variable} font-sans`}>
      <AuthProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
        <Toaster />
        <VoiceCommandButton />
      </AuthProvider>
    </body>
  </html>
);
```

### Design System (`globals.css`)

Tailwind v4 `@theme` block defines a teal-primary (`#0d9488`)
semantic palette + a global radial-dot mesh background. Pages use
`bg-transparent` so the mesh shows through; the only solid-bg
exception is `/admin/content`, which is a CMS editor.

Custom utility classes ship straight from `globals.css`:

- `glass`, `glass-strong` — backdrop-filter cards
- `shadow-soft`, `shadow-soft-lg`, `shadow-elevated`
- `card-hover`, `card-interactive` — managed transitions
- `nav-active` — sidebar active marker
- `research-badge`, `badge-success/warning/error/info`
- `font-dyslexic` — accessibility option for OpenDyslexic

### Behavior Tracking Hook (`frontend/hooks/useBehavior.ts`)

The hook is **scoped to the quiz** (per user feedback) — it does not
fire while the user is reading a lesson. It captures:

- `time_on_question_ms` (resets between questions)
- `hesitation_ms` (time to first interaction)
- `tab_switches`, `scroll_depth_pct`
- `attempts`, `hint_requests`, `wrong_option_hover_count`

POSTs through `apiFetch` (handles auth + retries + 8-second timeout).

### Course Player (`frontend/components/CoursePlayer.tsx`)

The biggest single component. Wires together:

1. Lesson markdown (with optional Bionic Reader emphasis)
2. AI **LessonTutor** (selection-spotlight FAB)
3. **SqlPlayground** when `getSqlChallenge(subtopicId)` returns one
4. Quiz dialog + per-question voice control
5. **AdaptiveInsightsPanel** (why this content?)
6. **HintScaffold** (auto-shown after incorrect submit)
7. **RemediationPathPanel** (post-quiz, fed by struggle detector)
8. Final-score celebration + struggled-question retrospective

The behavior tracker's enable flag is bound to `quizStarted` so
listeners fire only inside the quiz dialog.

---

## 10. TypeScript Interfaces

`frontend/types/index.ts` plus locally-scoped types in their owning
modules. Highlights:

```typescript
// Core domain
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string | number;
  difficulty?: string | number;
  skill_tags?: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  units?: Unit[];
}

export interface Subtopic {
  id: string;
  title: string;
  content: string;
  textbook_reference?: string;
  isConfused?: boolean;
}

// Adaptive engine (lib/competencies.ts + adaptive/*)
export interface Competency {
  id: string;
  title: string;
  description: string;
  subtopicIds: string[];
  prerequisites: string[];
  unitId?: string;
}

export type StruggleType =
  | "time_on_task"
  | "repeated_errors"
  | "help_seeking"
  | "engagement_drop"
  | "difficulty_mismatch";

export interface StruggleIndicator {
  type: StruggleType;
  severity: "low" | "medium" | "high";
  confidence: number;
  description: string;
  suggestedAction: string;
  dataPoints: Record<string, number | string>;
}

export interface PathStep {
  subtopicId: string;
  competencyId: string;
  competencyTitle: string;
  mastery: number;
  completed: boolean;
  reasonCode:
    | "weak_prereq" | "incomplete_prereq" | "weak_current"
    | "ready_to_advance" | "challenge_unlock";
  reason: string;
}

// ML decisions
export interface AdaptiveDecision {
  selected_arm: { name: string; id: number; confidence: number };
  context: { confusion_score: number; mastery: number; learning_style: string };
  all_arm_scores?: Array<{ name: string; score: number; is_selected: boolean }>;
  reason: string;
  timestamp: string;
}
```

---

## 11. Course Content

### Stats

| Metric | Value |
|--------|-------|
| Units | **6** (`u1`–`u6`) |
| Subtopics | **26** |
| Questions | **80** (every subtopic covered) |
| Difficulty levels per subtopic | **5** (`content_levels.1` … `content_levels.5`) |
| Textbook references | Elmasri & Navathe · Sadalage & Fowler · Ramakrishnan & Gehrke · Acharya |

### Units

```jsonc
[
  { "id": "u1", "title": "Introduction to Database Systems & ER Model", "order": 1 },
  { "id": "u2", "title": "Relational Model & Algebra",                  "order": 2 },
  { "id": "u3", "title": "SQL & Relational Database Design",            "order": 3 },
  { "id": "u4", "title": "Transaction Processing & Concurrency",        "order": 4 },
  { "id": "u5", "title": "NoSQL & Big Data",                            "order": 5 },
  { "id": "u6", "title": "Advanced Topics: Indexing & Warehousing",     "order": 6 }
]
```

### Subtopic Schema (with five difficulty rewrites)

```jsonc
{
  "id": "normal-forms-1nf-3nf",
  "unit_id": "u3",
  "order": 14,
  "title": "Normal Forms (1NF–3NF)",
  "content": "# Normal Forms ...",
  "completed": false,
  "content_levels": {
    "1": "Expert / textbook treatment",
    "2": "Standard explanation",
    "3": "Key-points outline",
    "4": "Real-world worked example",
    "5": "Friendly analogy"
  }
}
```

Levels are surfaced by the bandit's `easier`/`harder` arms and by the
`/settings` "intense / moderate / relaxed" pace preference.

### SQL Sandbox Challenges (`frontend/lib/sqlChallenges.ts`)

5 starter challenges keyed by `subtopic_id`. Each declares a starter
schema, sample data, the user's editable `prompt`, an expected
`solution`, and one or more progressive `hints`. Auto-grading uses
`resultsEqual()` (set-semantics) so column order doesn't matter.

---

## 12. Voice Command System

A **$0-cost, fully client-side** voice control layer built on the Web
Speech API. No Gemini / no third-party services for navigation or
quiz answering (per requirements).

### `useVoiceCommand` (`frontend/hooks/useVoiceCommand.ts`)

- **Trigger**: Left Ctrl key (configurable) toggles listening.
- **Audio cues**: WebAudio tones + a spoken "Listening" / "Analyzing"
  voice line so the user knows when capture is active.
- **States**: `idle → listening → analyzing → action | retry`.
- **Matching**: stop-word stripping → token-overlap scoring →
  Levenshtein fuzzy fallback (capped at edit distance 2). Accepts
  loose phrases like *"let's continue with my DBMS course"*.
- **Anti-keywords** prevent quiz-answer voice from drifting into a
  navigation command and vice versa.

### Built-in Commands (excerpt)

```typescript
{ keywords: ["continue", "resume"],          action: () => router.push("/dashboard") }
{ keywords: ["course", "courses", "lesson"], action: () => router.push("/course") }
{ keywords: ["competency", "graph"],         action: () => router.push("/competencies") }
{ keywords: ["progress", "analytics"],       action: () => router.push("/progress") }
{ keywords: ["review", "practice"],          action: () => router.push("/review") }
{ keywords: ["study", "flashcard"],          action: () => router.push("/study") }
{ keywords: ["teacher"],                     action: () => router.push("/teacher/dashboard") }
{ keywords: ["help", "what can i say"],      action: () => window.dispatchEvent(new Event("voice-help-open")) }
{ keywords: ["read", "narrate"],             action: () => speak(document.querySelector(".prose")?.textContent) }
{ keywords: ["scroll down"],                 action: () => window.scrollBy({ top: 400, behavior: "smooth" }) }
// + scroll up, stop reading, go back, settings, signup, demo, …
```

### Page-Scoped Commands

`useRegisterVoiceCommands(commandList)` registers extra commands while
the calling component is mounted. Used by:

- `useQuizVoice` — *"option B"*, *"the second one"*, *"submit"*,
  *"next question"*, *"hint"*, *"read the question again"*
- Future pages can plug in their own without prop-drilling

### Help Dialog (`VoiceCommandHelp.tsx`)

- Trigger: floating help icon · `?` key · voice command "help"
- Searchable across description / example / keywords
- Categorised: Navigation · Quiz · Reading · Scrolling · Other
- Shows up to 4 keyword chips per command (deduped, lower-cased)
- Esc to close

---

## 13. Operator & Teacher Dashboards

### `/teacher/dashboard`

Wired against three live endpoints:

1. **`GET /api/v1/admin/dashboard`** — top-level totals (enrolled,
   confused, avg mastery, active experiments) + live intervention feed
2. **`GET /api/v1/admin/cohort/competencies`** — class-wide skill map
3. **`GET /api/v1/admin/subtopic/{id}/confusion-timeline?days=30&bins=20`** —
   per-subtopic SVG sparkline + hot-question ranking

The cohort panel surfaces three cards:

- **Hot Spots** — skills where ≥ 30% of the cohort is below 40% mastery
- **Weakest Skills** — the leaderboard, ranked weakest first
- **Students Needing Help** — sorted by overall mastery, with weak-skill chips

### `/admin/ml-monitor`

- **System overview** — operational status, models loaded (X / 4)
- **Live Latency** (auto-refresh every 15 s) — global P50/P95/P99 +
  worst-15 routes ranked by P95, violation badges against the 200 ms budget
- **Bandit Arm Scores** — current LinUCB scores under a neutral context
  with the selected arm highlighted
- **Confusion Distribution** — 24 h, 10-bin histogram colour-graded
  green/amber/rose
- **Inference Engines** — per-model status cards (Confusion / Bandit /
  Profiler / DKT)

### `/admin/risk` & `/admin/risk/{user_id}`

Returns the cohort risk report or a single-student deep-dive (factors,
recommended interventions, confidence, suggested urgency).

### Demo Cohort Seeder

`scripts/data/seed_demo_cohort.py --wipe --count 12` writes 12
synthetic students (4 high · 4 mid · 4 struggling) to Firestore so all
teacher-side panels render with realistic data on a fresh project.

---

## 14. DevOps & Deployment

### Local Development

```bash
# Windows one-click — provisions venv, installs deps, opens Chrome
./start_project.bat

# or manually
cd backend && uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

### Make targets

```bash
make help          # list available targets
make install       # backend + frontend deps
make seed          # seed Firestore
make test          # pytest + tsc + next build
```

### Docker Compose

Production-style (Postgres + Redis kept around for migration target;
Firestore is the live primary):

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - FIREBASE_ADMIN_CREDENTIALS=/secrets/firebase-adminsdk.json
      - FRONTEND_URL=http://localhost:3000

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
    depends_on: [backend]

  redis:                      # cache layer (optional)
    image: redis:7-alpine
    ports: ["6379:6379"]

  nginx:                      # TLS termination + static assets
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./infrastructure/nginx.conf:/etc/nginx/nginx.conf:ro"]
```

### Firestore Deploy

```bash
firebase deploy --only firestore:rules
```

Rules in `firestore.rules` are validated and deployed via the Firebase
MCP server.

### CI

`.github/workflows/ci.yml` runs:

1. `pytest backend/tests/ -q` — 33 tests
2. `npx tsc --noEmit` (frontend)
3. `npx next build` — 19 routes
4. lint hot path

---

## 15. Research Protocol

### Experimental Design

| Group | N | Treatment |
|-------|---|-----------|
| Control | 20+ | Static content + random explanations |
| Adaptive | 20+ | Confusion model + LinUCB + remediation paths + SRS RL |

### Timeline

```
Day 0:    Consent + demographics + baseline learning-style profile
Day 1:    Pre-test (20 MCQs · 30 min)
Days 2–6: Learning sessions (5 × 30–60 min each)
Day 7:    Post-test (20 MCQs · 30 min)
Day 14:   Retention test (20 MCQs · 30 min)
Day 21:   Long-retention probe (10 MCQs)
```

### Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Learning gain | `(Post − Pre) / (Max − Pre)` | > Control |
| 1-week retention | `Retention − Pre`             | > Control |
| 3-week retention | `LongRetention − Pre`         | > Control |
| Confusion classifier | AUC-ROC                  | > 0.75 |
| Bandit cumulative reward | Σ rewards            | > Random + > Control |
| Latency budget | P95 / P99 from `/metrics/latency` | < 200 ms |
| At-risk recall | Risk-flagged students who actually disengaged | > 0.7 |

### Research Artefacts

- `research/` — IEEE LaTeX sources + figures
- `backend/exports/` — cumulative-reward, ROC, learning-gain,
  bandit-flow, system-architecture PDFs
- `intervention_logs` collection — A/B-comparable per-decision rows

---

## 16. Quick Reference

### Environment Variables

```env
# frontend/.env (Next.js public)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=AIza…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=focusai-223e1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=focusai-223e1
NEXT_PUBLIC_FIREBASE_APP_ID=1:1015323003402:web:…

# backend/.env
FIREBASE_ADMIN_CREDENTIALS=./firebase-adminsdk.json
FRONTEND_URL=http://localhost:3000
GENAI_API_KEY=…           # only needed for LessonTutor + course gen
```

### Firebase Project

- **Project ID:** `focusai-223e1`
- **Auth:** Email/Password + (optional) Google sign-in
- **Firestore region:** Multi-region

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| ML monitor | http://localhost:3000/admin/ml-monitor |
| Teacher view | http://localhost:3000/teacher/dashboard |
| Competency graph | http://localhost:3000/competencies |
| SRS review | http://localhost:3000/review |

### Verification Ritual

After any substantial change, the project's verification ritual is:

```bash
# Backend
.venv/Scripts/python.exe -m pytest backend/tests/ -q   # → 33 passed

# Frontend
cd frontend
npx tsc --noEmit                                       # → clean
npx next build                                         # → 19 routes, build successful
```

---

## 17. Change Log

### Adaptive Engine + Operator Dashboards (May 2026 sprint)

| Commit | Theme |
|--------|-------|
| `4f7a83b` | **L1** — In-browser SQL sandbox (sql.js WASM) |
| `4d63bdc` | Sprint 1+2 — adaptive difficulty + struggle detector + LessonTutor |
| `091ec66` | **L2** — Competency graph (`/competencies`) |
| `76cec41` | **M2** — Adaptive path branching |
| `404b4e8` | **L3** — SRS calendar heatmap on `/review` |
| `8b165d2` | **M4** — Cohort competency map for teachers |
| `6ee9189` | **L4** — Per-subtopic confusion timeline |
| `8707cbb` | **RL** — SRS retention rewards feed LinUCB |
| `e4d49b3` | Demo cohort seeder |
| `6556a28` | ML monitor — live latency + bandit + confusion |
| `b04fc38` | Voice help dialog + competency / help commands |
| `e76ace6` | UI consistency audit + dead-code sweep |

### Earlier Highlights

- **Voice command system**: Left-Ctrl toggle + fuzzy matcher + audio cues
- **Bionic Reader**: ReactMarkdown emphasis component (preserves headings, lists, code)
- **Bandit unification**: 6 canonical string arms; retrained `bandit_model.pkl`
- **Firestore migration**: from PostgreSQL plan → Firestore primary
- **Firebase MCP**: rules validated + deployed via MCP; service account in place
- **80 questions, 26 subtopics, 6 units**: full coverage
- **AGENTS.md**: stack-specific guidance + safe-to-run commands
- **CI**: `.github/workflows/ci.yml` runs pytest + tsc + next build

### Test Counts

| Sprint end | pytest count |
|------------|--------------|
| Pre-adaptive sprint | 24 |
| After SRS-RL feature | 28 |
| After ML-monitor latency tests | **33** |

---

**Built with ❤️ for adaptive learning research.**

*Focus-AI: Non-intrusive Behavioural Cognitive Profiling for Real-time Adaptive Learning.*
