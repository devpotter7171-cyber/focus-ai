# TASKS.md — Focus-AI Progress Tracker

> Living scratchpad. Update this as work progresses.

## ✅ Done

- [x] Project reorganization — deleted ~40 junk/debug files, consolidated duplicates, restructured `scripts/` into `data/`, `visualization/`, `debug/` subdirs
- [x] Fixed `.gitignore` — added rules for `.db`, build logs, archives, exports
- [x] Rewrote `README.md` — comprehensive full-stack documentation
- [x] Created AI assistance docs (`AGENTS.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `CONTEXT.md`, `ERRORS.md`, `TASKS.md`)
- [x] Core adaptive loop (confusion detection → bandit → recommendation → reward)
- [x] DBMS course content seeded (3 units, subtopics, multi-level questions)
- [x] Dashboard, course player, assessment, progress, admin, teacher views
- [x] Firebase Auth integration (signup, login, token verification)
- [x] Behavior tracking via `useBehavior` hook
- [x] Neural-themed component library (buttons, badges, cards, skeletons, sidebar)
- [x] Docker Compose setup (Postgres, Redis, Nginx, backend, frontend)
- [x] CI/CD pipeline (`.github/workflows/ci.yml`)
- [x] Makefile with all dev commands
- [x] ML pipeline (training + inference for all 5 models)
- [x] Latency tracking middleware (200ms constraint)

## 🔧 In Progress

- [ ] (Add current work items here)

## 📋 Next

- [ ] (Add upcoming tasks here)

## 🧊 Backlog / Ideas

- [ ] Migrate from Firestore to PostgreSQL (docker-compose already has it)
- [ ] Add Alembic migrations for SQL schema
- [ ] Implement WebSocket for real-time behavior streaming (replace polling)
- [ ] Add frontend unit tests
- [ ] Tighten CORS in production (currently `allow_origins=["*"]`)
- [ ] Remove `# Auth temporarily disabled for debugging` on courses/behavior routers
- [ ] Add rate limiting to public endpoints
