import pytest
from fastapi.testclient import TestClient
import sys
import os

# Ensure backend root is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from routers.auth import get_current_user

@pytest.fixture
def client():
    # Global Auth Override for all tests
    app.dependency_overrides[get_current_user] = lambda: {"uid": "test_user_001"}
    
    # Global DB Override (Mock Firestore)
    from unittest.mock import MagicMock
    mock_db = MagicMock()
    # Mock document snapshot for get() to return exists=False by default (trigger fallback)
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_doc.to_dict.return_value = {}
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
    
    # Ensure set() works
    mock_db.collection.return_value.document.return_value.set.return_value = None
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set.return_value = None

    from database import get_db
    app.dependency_overrides[get_db] = lambda: mock_db
    
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}
    app.dependency_overrides = {}

@pytest.fixture(autouse=True)
def mock_genai(monkeypatch):
    """Mock GenAI service to prevent network calls."""
    class MockGenAI:
        async def analyze_mistake(self, q, s, c):
            return "Mock AI Feedback: concept explanation."
            
    # Modify the module directly in sys.modules or use monkeypatch if accessible
    # simpler: override the instance in usage
    # Since routers import 'genai_service' instance, we need to patch that Instance.
    from services.genai_service import genai_service
    monkeypatch.setattr(genai_service, "analyze_mistake", MockGenAI().analyze_mistake)

