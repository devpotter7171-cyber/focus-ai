# Focus-AI: Adaptive Learning Platform

An intelligent, adaptive learning system that uses Contextual Bandits and real-time confusion detection to personalize educational content delivery.

## 🎯 Overview

Focus-AI analyzes student behavior in real-time (hesitation, tab switches, scroll patterns) to detect confusion and dynamically adjust content difficulty and presentation style using a LinUCB contextual bandit algorithm.

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 14    │────▶│    FastAPI      │────▶│   ML Service    │
│   Frontend      │     │    Backend      │     │   (Python)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Firebase     │     │   PostgreSQL    │     │  Trained Models │
│  Auth + Content │     │  Behavior Logs  │     │  (.pkl / .pt)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 📁 Project Structure

```
/focus-ai
├── /frontend          # Next.js 14 App Router
│   ├── /app           # Pages (dashboard, course, review, etc.)
│   ├── /components    # Reusable UI components (Shadcn/UI)
│   ├── /hooks         # useBehavior.ts for tracking
│   └── /lib           # API client, Firebase config
├── /backend           # FastAPI Python backend
│   ├── /routers       # API endpoints
│   ├── /services      # Business logic (ML, Firebase)
│   ├── /models        # SQLAlchemy ORM models
│   └── /schemas       # Pydantic request/response schemas
├── /ml                # Machine Learning
│   ├── /training      # Model training scripts
│   ├── /inference     # Inference wrappers
│   └── /models        # Saved model files (.pkl)
├── /seed              # Course content JSON files
├── /infrastructure    # Docker, nginx configs
├── /docs              # Documentation
└── /tests             # Test suites
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Firebase Project (or use emulator)

### Local Development

```bash
# 1. Clone and setup
git clone https://github.com/your-org/focus-ai.git
cd focus-ai

# 2. Setup environment
cp infrastructure/.env.example .env
# Edit .env with your Firebase/Supabase credentials

# 3. Start services
docker-compose up -d postgres

# 4. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 5. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Visit: http://localhost:3000

### Using Make (Recommended)

```bash
make init          # Install all dependencies
make seed          # Seed DBMS course content
make train         # Train ML models (uses synthetic data)
make run           # Start all services
make test          # Run test suites
```

## 🔬 ML Models

| Model | Algorithm | Purpose |
|-------|-----------|---------|
| Confusion Detector | XGBoost | Predict student confusion from behavior |
| Cognitive Profiler | KMeans + LightGBM | Cluster students by learning style |
| DKT | LSTM | Deep Knowledge Tracing for mastery |
| Bandit | LinUCB | Select optimal content presentation |

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/courses` | GET | List all courses |
| `/api/v1/behavior` | POST | Log student behavior |
| `/api/v1/questions/{qid}` | GET | Get question by ID |
| `/api/v1/recommendations` | GET | Get personalized recommendation |
| `/api/v1/admin/dashboard` | GET | Teacher analytics dashboard |
| `/api/v1/ml/infer/confusion` | POST | Real-time confusion inference |

## 🧪 Running Experiments

See [EXPERIMENT_PROTOCOL.md](./EXPERIMENT_PROTOCOL.md) for the full research protocol including:
- Pre/post test design
- Control vs Adaptive group assignment
- Data export format
- Statistical analysis scripts

## 📝 License

MIT License - See LICENSE file for details.

## 👥 Contributors

- Focus-AI Research Team
