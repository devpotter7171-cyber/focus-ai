<p align="center">
  <h1 align="center">Focus-AI</h1>
  <p align="center">Adaptive learning that detects confusion and responds in real time.</p>
</p>

<p align="center">
  <img src="screenshots/Landing Page.png" alt="Focus-AI Landing Page" width="100%" />
</p>

---

Focus-AI is an adaptive tutoring platform that uses behavioural telemetry (hesitation, scrolling, tab switches) to detect when a student is struggling, then a contextual bandit selects the best explanation strategy. No cameras, no wearables — just the signals a browser already provides.

## What it does

- **Detects confusion in real time** — XGBoost classifier on interaction signals, inference in under 12ms
- **Adapts content dynamically** — 5 difficulty levels per topic, switched instantly by a LinUCB bandit
- **Voice-first accessibility** — Navigate, quiz, and ask questions entirely by speech
- **AI tutoring** — Free-form questions answered by AI grounded in the current lesson
- **12 free LLMs** — Cost-aware routing through OpenRouter; 96% cheaper than all-paid
- **Deep Knowledge Tracing** — Per-skill mastery tracked over time with LSTM-based BKT
- **6 CS courses** — DBMS, DSA, OS, Computer Networks, OOP, Software Engineering

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | FastAPI, Python 3.10+, Pydantic v2 |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Auth |
| **ML** | XGBoost, PyTorch (LSTM), scikit-learn, custom LinUCB |
| **AI** | Gemini 2.5 Flash + OpenRouter (12 free models) |
| **UI** | Radix UI, Framer Motion, Lucide Icons |

## Quick start

```bash
# Clone
git clone https://github.com/MadeNavaneeth/Focus-AI.git
cd Focus-AI

# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Fill in your Firebase + API keys
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
# Create frontend/.env with your Firebase web config
npm run dev
```

Open http://localhost:3000. Sign up, and the adaptive loop starts working immediately.

## How the adaptation loop works

```
Student interacts with lesson
  → useBehavior hook captures dwell time, scrolls, tab switches
  → POST /api/v1/behavior
  → XGBoost predicts confusion probability
  → If confused: LinUCB bandit selects best explanation arm
  → Content level shifts instantly (Expert → Simplified → Analogy)
  → Reward signal updates the bandit for next time
```

All under 200ms end-to-end.

## Voice commands

Press **Left Ctrl** or click the mic button:

| Say | Action |
|-----|--------|
| "Open DBMS" | Navigate to a specific course |
| "Take the quiz" | Start the lesson quiz |
| "Option B" / "Submit" | Answer quiz questions |
| "Read this lesson" | TTS narration |
| "Explain normalization" | AI tutor answers from lesson context |
| "Stop" | Cancel speech |

## Environment variables

**Backend** (`backend/.env`):
```
FIREBASE_ADMIN_CREDENTIALS=firebase-adminsdk.json
GEMINI_API_KEY=your-key          # Optional (paid fallback)
OPENROUTER_API_KEY=your-key      # Optional (free models)
```

**Frontend** (`frontend/.env`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-web-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

## Project structure

```
Focus-AI/
├── backend/          FastAPI REST API + ML inference
├── frontend/         Next.js 16 web app
├── ml/               Training scripts + serialized models
├── scripts/          Data seeding + visualization
└── seed/             Initial course content (JSON)
```

## Authors

- Yadamreddy Navaneeth
- Shoham Mohapatra
- Ekaksh Agrawal
- Dr. Eleena Mohapatra (Faculty Advisor)
- Dr. Pratiba K (Faculty Advisor)

## License

MIT
