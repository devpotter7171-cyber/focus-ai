#!/bin/bash
# =============================================
# Focus-AI Local Development Script
# =============================================
# This script starts all services for local development
# and runs a synthetic validation to ensure everything works.
# =============================================

set -e  # Exit on error

echo "================================================"
echo "   Focus-AI Local Development Environment"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}Failed!${NC}"
    return 1
}

# ============== Step 1: Check Prerequisites ==============
echo "Step 1: Checking prerequisites..."

if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command_exists python; then
    echo -e "${RED}Error: Python is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}All prerequisites found!${NC}"
echo ""

# ============== Step 2: Start Database ==============
echo "Step 2: Starting PostgreSQL database..."

docker-compose up -d postgres 2>/dev/null || {
    echo -e "${YELLOW}Warning: Docker Compose failed. Using SQLite fallback.${NC}"
}

sleep 2
echo ""

# ============== Step 3: Start Backend ==============
echo "Step 3: Starting Backend (FastAPI)..."

cd backend

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    python -m venv .venv
fi

# Activate and install dependencies
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt -q

# Start backend in background
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

cd ..
echo ""

# ============== Step 4: Wait for Backend ==============
echo "Step 4: Waiting for backend to be ready..."
wait_for_service "http://localhost:8000/health" "Backend"
echo ""

# ============== Step 5: Seed Data ==============
echo "Step 5: Seeding DBMS course content..."

cd backend
python -c "
try:
    from services.seed_service import seed_all
    seed_all()
    print('Seeding complete!')
except Exception as e:
    print(f'Seeding skipped: {e}')
" 2>/dev/null || echo -e "${YELLOW}Seeding skipped (service not configured)${NC}"

cd ..
echo ""

# ============== Step 6: Start Frontend ==============
echo "Step 6: Starting Frontend (Next.js)..."

cd frontend
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

cd ..
echo ""

# ============== Step 7: Wait for Frontend ==============
echo "Step 7: Waiting for frontend to be ready..."
wait_for_service "http://localhost:3000" "Frontend"
echo ""

# ============== Step 8: Run Synthetic Validation ==============
echo "Step 8: Running synthetic validation..."

# Test confusion inference endpoint
echo -n "  Testing /ml/infer/confusion..."
CONFUSION_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/ml/infer/confusion \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test","hesitation_ms":3000,"tab_switches":2}')

if echo "$CONFUSION_RESPONSE" | grep -q "confusion_score"; then
    echo -e " ${GREEN}PASS${NC}"
else
    echo -e " ${RED}FAIL${NC}"
    echo "  Response: $CONFUSION_RESPONSE"
fi

# Test recommendation endpoint
echo -n "  Testing /ml/infer/recommend..."
RECOMMEND_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/ml/infer/recommend \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test","confusion_score":0.6}')

if echo "$RECOMMEND_RESPONSE" | grep -q "explanation_type"; then
    echo -e " ${GREEN}PASS${NC}"
else
    echo -e " ${RED}FAIL${NC}"
    echo "  Response: $RECOMMEND_RESPONSE"
fi

# Test health endpoint
echo -n "  Testing /health..."
HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e " ${GREEN}PASS${NC}"
else
    echo -e " ${RED}FAIL${NC}"
fi

echo ""

# ============== Step 9: Summary ==============
echo "================================================"
echo "   Focus-AI is running!"
echo "================================================"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  To stop all services, run:"
echo "    kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "  Press Ctrl+C to stop..."
echo "================================================"

# Keep script running
wait
