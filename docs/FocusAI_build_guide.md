
# FOCUS-AI: End-to-End Build Guide
**Purpose:** A complete step-by-step guide that an AI model (or dev team) can use to build the FOCUS-AI adaptive learning platform from start to finish — including architecture, data models, ML pipeline, implementation steps, Firebase rules, experiment plan, and paper outline.

**Source materials used:** Project PPT (Focus AI) and DBMS syllabus. See citations in chat for original uploads. fileciteturn0file0 fileciteturn1file0

---
## 1. High-level summary
Build an adaptive web-based learning platform with two roles: **Student (user)** and **Admin (teacher)**. Use **React/Next.js** on the frontend, **FastAPI** (Python) backend for APIs and ML hosting, **Firebase** for authentication and lightweight storage, and **Postgres / Supabase** for ML-ready logs and analytics. ML components: confusion detector, cognitive profiler, difficulty predictor, DKT for mastery, and a contextual multi-armed bandit for pedagogy selection.

---
## 2. System architecture (components & flow)
1. **Frontend (Next.js)**
   - **Framework**: Next.js 14+ (App Router).
   - **Styling**: Tailwind CSS + Framer Motion.
   - **State**: React Context (`AuthContext`).
   - **Data**: `apiFetch` utility for centralized backend calls.
2. **Backend (FastAPI)**
   - **Concurrency**: Asynchronous (`async def`) endpoints using `asyncio`.
   - **Database**: SQLite (Async `aiosqlite`) for MVP; reliable and file-based.
   - **ORM**: SQLAlchemy 2.0 (Async).
   - **Auth**: Firebase Admin SDK (Token Verification).
3. **ML Engine (Integrated)**
   - **Service**: `MLService` singleton in `services/ml_service.py`.
   - **Models**:
     - `confusion_model.pkl` (XGBoost): Predicts user confusion.
     - `profile_model.pkl` (KMeans): Segments users (Skimmer/Reader).
     - `weak_concept_model.pkl` (XGBoost): Identifies knowledge gaps.
     - `bandit_model.pkl` (LinUCB/Thompson): Selects pedagogy.
4. **Data Flow**:
   - Frontend -> `apiFetch` -> Backend API -> `MLService` -> Response.
   - Behavior Logs -> `ml/training/*.py` -> Updated Models.

---
## 3. Data model & collections
**SQLite Schema (`sql_models.py`)**:
- `users`: id, email, role, profile_segment.
- `courses`, `units`, `subtopics`, `questions`: Hierarchical content.
- `behavior_logs`: user_id, event_type, data (JSON), timestamp.
- `user_answers`: Answers and correctness.

---
## 4. Deployment (Docker)
### Prerequisites
- Docker & Docker Compose installed.

### Method 1: One-Click (No Docker)
Double-click `start_project.bat` in the root directory.
This will:
1. Create a Python virtual environment.
2. Install all dependencies.
3. Launch Backend and Frontend in separate windows.

### Method 2: Docker (Recommended for Prod)
1. **Build & Run**:
   ```bash
   docker-compose up --build -d
   ```
2. **Access**:
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000`
   - Docs: `http://localhost:8000/docs`

---
## 5. Detailed API spec (FastAPI endpoints)
- `GET /api/v1/auth/verify-token` — Verify Firebase token.
- `GET /api/v1/courses` — List courses (eager loaded units).
- `GET /api/v1/recommendations/` — Get bandit-based recommendation.
- `POST /api/v1/behavior/log` — Log user interaction (async).
- `GET /api/v1/admin/dashboard` — Content & Analytics (Secured).

---
## 6. ML pipelines (Training)
Run these scripts from the root directory to retrain models:
1. **DKT (Mastery)**: `python ml/training/train_dkt.py`
2. **Weak Concepts**: `python ml/training/train_weak_concept.py`
3. **Contextual Bandit**: `python ml/training/train_bandit.py`
4. **User Profiling**: `python ml/training/train_profiles.py`

---
## 7. Implementation Status
- **Phase 1-8 Completed**:
    - [x] Async Backend Refactor
    - [x] Premium Frontend UI (Framer Motion)
    - [x] Real ML Integration (LinUCB, XGBoost, KMeans)
    - [x] Security (Firebase, Strict TS)
    - [x] Optimization (DB Indexing, JSON Logging)

---
## 8. Experiment design for IEEE paper
**Participants:** 40–200 students (two groups)  
**Groups:** Control (non-adaptive), Treatment (adaptive FOCUS-AI)  
**Procedure:** pre-test → learning sessions (4 weeks) → post-test → retention test (1 week later)  
**Primary outcome:** normalized learning gain = (post - pre) / (max - pre)  
**Secondary outcomes:** engagement, retention, confusion reduction, teacher usability
**Statistical analysis:** show p-values, effect sizes, confidence intervals

---
## 9. DBMS course seeding (content constrained to reference books)
**Units & subtopics** (pre-populated in `courses/dbms`) — derived from the syllabus PDF:
- Unit I: Intro + ER model (10 subtopics)
- Unit II: ER refinement + Relational algebra (10)
- Unit III: SQL + Relational design (10)
- Unit IV: Transactions & Concurrency (10)
- Unit V: NoSQL & Big Data (10)
Each subtopic contains:
- short lesson summary (paraphrase strictly from allowed textbooks)
- 3–5 practice questions (MCQ or SQL)
- references: which book & chapter (must be one of the 4 listed references)

---
## 10. Admin features & constraints
- Admin can only add content that cites one of the four approved references. UI must force selecting a `textbook_reference` field from the allowed list before content save.
- Admin audit log: every content add/edit shows adminId, timestamp, textbook_reference
- Admin can enable/disable adaptive modes for experiments

---
## 11. Implementation roadmap (sprint plan)
- **Week 1:** Project setup, Next.js + Firebase auth, Firestore schema, seed DBMS course
- **Week 2:** Behavior tracking hooks, API endpoints for logging, basic lesson player
- **Week 3:** Implement answer logging, basic confusion heuristic, teacher dashboard MVP
- **Week 4:** Train initial confusion detector (XGBoost), integrate ML endpoint
- **Week 5:** Implement clustering + profile builder; show profiles in dashboard
- **Week 6:** Implement DKT (simple LSTM) and integrate for next-item recommendation
- **Week 7:** Contextual bandit skeleton; begin small A/B pilot with 10–20 students
- **Week 8:** Analyze pilot, refine models, expand to larger pilot, prepare data for paper
- **Week 9-10:** Full experiment & paper writing (methods, results, discussion)

---
## 12. Code structure
```
/focus-ai
  /frontend (Next.js)
    /app, /components, /lib, /context
    Dockerfile
  /backend (FastAPI)
    /routers, /models, /services
    main.py, database.py
    Dockerfile
  /ml
    /models (pkl files)
    /training (scripts)
  docker-compose.yml
```
Key files to generate first: `frontend/hooks/useBehavior.js`, `backend/routes/behavior.py`, `ml/training/confusion_train.py`

---
## 13. Paper outline for IEEE Access
- Title: Focus-AI: Non-intrusive Behavioral Cognitive Profiling for Real-time Adaptive Learning
- Abstract (250–300 words)
- Introduction (motivation + SDG-4 link) — use PPT gap analysis. fileciteturn0file0
- Related Work (cite papers listed in PPT) fileciteturn0file0
- System Design & Architecture (figures + modules) — include detailed diagram
- ML Methods (confusion detection, DKT, bandit) — algorithms + hyperparams
- Experimental Setup (participants, metrics)
- Results (statistical analysis, graphs)
- Discussion & Limitations
- Conclusion & Future Work (multimodal, RL, multilingual)
- References (use references listed in PPT and any additional papers you implement)

---
## 14. Deliverables I can generate for you next (choose one)
- Full repo skeleton (Next.js + FastAPI + ML stubs) saved to `/mnt/data` for download
- Starter code: behavior hooks + FastAPI logging endpoints
- ML notebook: synthetic data generator + XGBoost confusion detector training + saved model .pkl
- Teacher dashboard React components (MVP)
- Complete IEEE paper draft (LaTeX or Markdown)

---
## 15. Appendix: Example behavior event payload
```json
{
  "user_id": "uid_abc",
  "session_id": "sess_20251202_001",
  "question_id": "dbms_u1_q3",
  "time_on_question_ms": 18500,
  "hesitation_ms": 1200,
  "tab_switches": 1,
  "scroll_depth_pct": 78,
  "attempts": 2,
  "hint_requests": 0,
  "timestamp": "2025-12-02T11:30:00Z"
}
```

---
## Acknowledgements & source files
This guide was built referencing the uploaded project PPT and the DBMS syllabus provided by you. fileciteturn0file0 fileciteturn1file0

---
End of guide.
