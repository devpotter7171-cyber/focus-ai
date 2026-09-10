# Makefile for Focus-AI Project
# Provides convenient commands for development, testing, and deployment

.PHONY: init install-frontend install-backend seed train run test clean help

# Default target
help:
	@echo "Focus-AI Development Commands"
	@echo "=============================="
	@echo ""
	@echo "  make init              - Install all dependencies (frontend + backend)"
	@echo "  make install-frontend  - Install frontend dependencies only"
	@echo "  make install-backend   - Install backend dependencies only"
	@echo "  make seed              - Seed database with DBMS course content"
	@echo "  make train             - Train ML models (uses synthetic data)"
	@echo "  make train-confusion   - Train confusion detection model only"
	@echo "  make train-bandit      - Train bandit model only"
	@echo "  make run               - Start all services (requires docker)"
	@echo "  make run-backend       - Start backend server only"
	@echo "  make run-frontend      - Start frontend dev server only"
	@echo "  make test              - Run all tests (backend + frontend)"
	@echo "  make test-backend      - Run backend tests only"
	@echo "  make test-frontend     - Run frontend tests only"
	@echo "  make clean             - Remove generated files and caches"
	@echo "  make docker-up         - Start Docker services"
	@echo "  make docker-down       - Stop Docker services"
	@echo ""

# Install all dependencies
init: install-frontend install-backend
	@echo "All dependencies installed successfully!"

# Frontend dependencies
install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Backend dependencies
install-backend:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt

# Seed database
seed:
	@echo "Seeding DBMS course content..."
	cd backend && python -c "from services.seed_service import seed_all; seed_all()"

# Train all ML models
train: train-confusion train-bandit train-profiler
	@echo "All models trained successfully!"

# Train individual models
train-confusion:
	@echo "Training Confusion Detection model..."
	cd ml && python training/train_confusion.py --synthetic

train-bandit:
	@echo "Training Bandit model..."
	cd ml && python training/train_bandit.py

train-profiler:
	@echo "Training Cognitive Profiler..."
	cd ml && python training/train_profiles.py --synthetic

# Generate synthetic data
generate-data:
	@echo "Generating synthetic training data..."
	cd ml && python synthetic_data_generator.py

# Run services
run: docker-up
	@echo "Starting all services..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"

run-backend:
	@echo "Starting backend server..."
	cd backend && uvicorn main:app --reload --port 8000

run-frontend:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

# Docker commands
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs:
	docker-compose logs -f

# Testing
test: test-backend test-frontend
	@echo "All tests completed!"

test-backend:
	@echo "Running backend tests..."
	cd backend && pytest tests/ -v

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm test

# Linting
lint-backend:
	@echo "Linting backend code..."
	cd backend && python -m flake8 .

lint-frontend:
	@echo "Linting frontend code..."
	cd frontend && npm run lint

# Clean up
clean:
	@echo "Cleaning up generated files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf frontend/.next 2>/dev/null || true
	rm -rf ml/data/*.csv 2>/dev/null || true
	@echo "Cleanup complete!"

# Database management
db-migrate:
	@echo "Running database migrations..."
	cd backend && alembic upgrade head

db-reset:
	@echo "Resetting database..."
	cd backend && python -c "from database import Base, engine; Base.metadata.drop_all(engine); Base.metadata.create_all(engine)"

# Production build
build-frontend:
	@echo "Building frontend for production..."
	cd frontend && npm run build

# Export data for analysis
export-logs:
	@echo "Exporting behavior logs..."
	cd backend && python -c "from services.export_service import export_logs; export_logs()"
