# Running Focus-AI Locally

This guide covers setting up and running Focus-AI on your local development machine.

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20+ | https://nodejs.org |
| Python | 3.11+ | https://python.org |
| Docker | Latest | https://docker.com |
| Git | Latest | https://git-scm.com |

### Optional (for full features)

- Firebase CLI (`npm install -g firebase-tools`)
- PostgreSQL client (for direct DB access)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/focus-ai.git
cd focus-ai
```

### 2. Create Environment File

```bash
cp infrastructure/.env.example .env
```

Edit `.env` with your credentials:

```env
# Frontend (Next.js)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Backend
FIREBASE_ADMIN_CREDENTIALS_JSON=./firebase-admin-key.json
DATABASE_URL=postgresql://focusai:focusai@localhost:5432/focusai
SECRET_KEY=your_super_secret_key_here
FRONTEND_URL=http://localhost:3000

# ML
ML_STORAGE_PATH=./ml/models
```

### 3. Firebase Setup

**Option A: Use Firebase Emulator (Recommended for Development)**

```bash
firebase init emulators
firebase emulators:start
```

**Option B: Use Real Firebase Project**

1. Create project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Enable Firestore
4. Download Admin SDK key and save as `firebase-admin-key.json`

## Starting Services

### Quick Start (Docker Compose)

```bash
# Start all services
docker-compose up --build

# Or start specific services
docker-compose up postgres  # Just database
```

### Manual Start (Development)

**Terminal 1: Database**
```bash
docker-compose up postgres
```

**Terminal 2: Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 3: Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Seeding Data

Populate the database with DBMS course content:

```bash
cd backend
python -c "from services.seed_service import seed_all; seed_all()"
```

Or use the Make target:
```bash
make seed
```

## Training ML Models

### Using Synthetic Data (No Real Users Required)

```bash
cd ml
python training/train_confusion.py --synthetic
python training/train_profiles.py --synthetic
python training/train_bandit.py --synthetic
```

Or use Make:
```bash
make train
```

### Using Real Logs (After Data Collection)

```bash
python training/train_confusion.py --from-db
```

## Verification Checklist

Run these commands to verify your setup:

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Backend Health | `curl http://localhost:8000/health` | `{"status": "ok"}` |
| API Docs | Open `http://localhost:8000/docs` | Swagger UI loads |
| Frontend | Open `http://localhost:3000` | Landing page renders |
| ML Inference | `curl -X POST http://localhost:8000/api/v1/ml/infer/confusion -d '{}'` | Returns confusion score |

## Common Issues

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill process
taskkill /PID <pid> /F        # Windows
kill -9 <pid>                 # Mac/Linux
```

### Database Connection Failed

1. Ensure Docker is running
2. Check `docker-compose ps` shows postgres as "Up"
3. Verify DATABASE_URL in .env matches docker-compose settings

### Firebase Errors

- Check credentials file path is correct
- Ensure project ID matches in both frontend and backend configs
- If using emulator, set `FIRESTORE_EMULATOR_HOST=localhost:8080`

## Next Steps

- [EXPERIMENT_PROTOCOL.md](./EXPERIMENT_PROTOCOL.md) - Run a research experiment
- [IEEE_paper_outline.md](./IEEE_paper_outline.md) - Paper structure and figures
