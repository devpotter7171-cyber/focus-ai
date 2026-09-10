from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

from routers import auth, courses, behavior, admin, questions, recommendations, ml, answers, assessment, flashcards, tutor, classes
from routers.auth import get_current_user
from services.ml_service import ml_service


import logging
import sys

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(module)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Cache flush trigger: 1

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize ML Models
    # Startup: Initialize ML Models
    # (Firestore init happens on first request or explicitly if needed)
    ml_service.load_models()
    yield
    # Shutdown
    logger.info("Shutting down Focus-AI Backend...")

app = FastAPI(title="FOCUS-AI API", version="1.0.0", lifespan=lifespan)

    # Latency Tracking Middleware (Performance SLA)
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import time
from services.latency_metrics import latency_metrics

class LatencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

        # Use the matched route template if available (e.g. "/api/v1/admin/risk/{user_id}")
        # so we don't fragment the buffer on path parameters.
        try:
            route = request.scope.get("route")
            route_path = getattr(route, "path", None) or request.url.path
        except Exception:
            route_path = request.url.path
        latency_metrics.record(f"{request.method} {route_path}", process_time)

        # Log SLA violation (200ms target for real-time adaptive responses)
        if process_time > 200:
            logger.warning(f"LATENCY VIOLATION: {process_time:.2f}ms (SLA: 200ms)")

        return response

app.add_middleware(LatencyMiddleware)

# CORS
# Default to allowing all for dev if not set, but prefer explicit list in prod
origins = ["*"] # Forced for debugging
# origins = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
# if "*" in origins:
#     origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Secure configuration warning
if "*" in origins:
    logger.warning("CORS configured to allow all origins ('*'). This is insecure for production.")

# Latency Tracking Middleware (Performance SLA)


# Register all routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(courses.router, prefix="/api/v1/courses", tags=["courses"]) # Auth temporarily disabled for debugging
app.include_router(behavior.router, prefix="/api/v1/behavior", tags=["behavior"]) # Auth temporarily disabled
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(get_current_user)])
app.include_router(questions.router, prefix="/api/v1/questions", tags=["questions"], dependencies=[Depends(get_current_user)])
app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["recommendations"], dependencies=[Depends(get_current_user)])
app.include_router(ml.router, prefix="/api/v1/ml", tags=["ml"], dependencies=[Depends(get_current_user)])
app.include_router(answers.router, prefix="/api/v1/answers", tags=["answers"], dependencies=[Depends(get_current_user)])
app.include_router(assessment.router, prefix="/api/v1/assessment", tags=["assessment"])
app.include_router(flashcards.router, prefix="/api/v1/flashcards", tags=["flashcards"], dependencies=[Depends(get_current_user)])
app.include_router(tutor.router, prefix="/api/v1/tutor", tags=["tutor"], dependencies=[Depends(get_current_user)])
app.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"], dependencies=[Depends(get_current_user)])

@app.get("/")
def read_root():
    return {"message": "Welcome to FOCUS-AI API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
