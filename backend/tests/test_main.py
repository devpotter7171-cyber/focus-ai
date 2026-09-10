from fastapi.testclient import TestClient
from main import app
import pytest

from routers.auth import get_current_user



def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to FOCUS-AI API"}

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_courses_list(client):
    response = client.get("/api/v1/courses/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

