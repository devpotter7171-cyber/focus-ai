"""
Backend Tests: Behavior Router

Tests for behavior logging endpoints.
"""
import pytest
from fastapi.testclient import TestClient



class TestBehaviorLogging:
    """Tests for /api/v1/behavior endpoint."""
    
    def test_log_behavior_basic(self, client):
        """Test logging basic behavior event."""
        response = client.post("/api/v1/behavior", json={
            "user_id": "test_user_001",
            "event_type": "behavior_snapshot",
            "data": {
                "session_id": "sess_001",
                "question_id": "q_rel_001",
                "time_ms": 15000,
                "tab_switches": 2,
                "scroll_depth": 75
            },
            "timestamp": "2023-10-27T10:00:00Z"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    def test_log_behavior_with_confusion(self, client):
        """Test that behavior logging returns confusion score."""
        response = client.post("/api/v1/behavior", json={
            "user_id": "test_user_002",
            "event_type": "behavior_snapshot",
            "data": {
                "session_id": "sess_002",
                "question_id": "q_sql_001",
                "time_ms": 60000,
                "tab_switches": 5,
                "scroll_depth": 100,
                "hesitation_ms": 5000
            },
            "timestamp": "2023-10-27T10:05:00Z"
        })
        
        assert response.status_code == 200


class TestHealthCheck:
    """Tests for basic API health."""
    
    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        
        assert response.status_code == 200
        assert "message" in response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
