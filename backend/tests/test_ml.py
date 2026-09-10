"""
Backend Tests: ML Router

Tests for the ML inference endpoints.
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app

from routers.auth import get_current_user




class TestConfusionInference:
    """Tests for /api/v1/ml/infer/confusion endpoint."""
    
    def test_confusion_basic_request(self, client):
        """Test basic confusion inference with valid payload."""
        response = client.post("/api/v1/ml/infer/confusion", json={
            "user_id": "test_user_001",
            "question_id": "q_rel_001",
            "time_on_question_ms": 15000,
            "hesitation_ms": 2000,
            "tab_switches": 1,
            "scroll_depth_pct": 50.0,
            "attempts": 1,
            "hint_requests": 0
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "confusion_score" in data
        assert 0 <= data["confusion_score"] <= 1
        assert "is_confused" in data
        assert isinstance(data["is_confused"], bool)
    
    def test_confusion_high_hesitation(self, client):
        """Test that high hesitation increases confusion score."""
        response = client.post("/api/v1/ml/infer/confusion", json={
            "user_id": "test_user_002",
            "time_on_question_ms": 60000,
            "hesitation_ms": 8000,  # High hesitation
            "tab_switches": 5,      # Many tab switches
            "scroll_depth_pct": 100.0,
            "attempts": 4,
            "hint_requests": 2
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should indicate confusion
        assert data["confusion_score"] > 0.3
    
    def test_confusion_minimal_payload(self, client):
        """Test with only required field (user_id)."""
        response = client.post("/api/v1/ml/infer/confusion", json={
            "user_id": "test_user_003"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "confusion_score" in data


class TestRecommendationInference:
    """Tests for /api/v1/ml/infer/recommend endpoint."""
    
    def test_recommendation_basic(self, client):
        """Test basic recommendation request."""
        response = client.post("/api/v1/ml/infer/recommend", json={
            "user_id": "test_user_001",
            "confusion_score": 0.7,
            "avg_mastery": 0.4,
            "learning_style": "Balanced"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "explanation_type" in data
        assert data["explanation_type"] in ["visual", "step", "example", "analogy", "easier", "harder"]
        assert "arm_id" in data
        assert "reason" in data
    
    def test_recommendation_different_styles(self, client):
        """Test recommendations for different learning styles."""
        styles = ["Skimmer", "Deep Reader", "Balanced"]
        
        for style in styles:
            response = client.post("/api/v1/ml/infer/recommend", json={
                "user_id": f"test_user_{style}",
                "learning_style": style
            })
            
            assert response.status_code == 200
            assert "explanation_type" in response.json()


class TestMasteryInference:
    """Tests for /api/v1/ml/infer/mastery endpoint."""
    
    def test_mastery_with_history(self, client):
        """Test mastery prediction with interaction history."""
        response = client.post("/api/v1/ml/infer/mastery", json={
            "user_id": "test_user_001",
            "interaction_history": [
                {"skill_id": "relational_model", "correct": 1},
                {"skill_id": "relational_model", "correct": 1},
                {"skill_id": "sql_basics", "correct": 0},
                {"skill_id": "sql_basics", "correct": 1},
                {"skill_id": "normalization", "correct": 0}
            ]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "mastery_by_skill" in data
        assert "weak_skills" in data
        assert "overall_mastery" in data
    
    def test_mastery_empty_history(self, client):
        """Test mastery with no history."""
        response = client.post("/api/v1/ml/infer/mastery", json={
            "user_id": "new_user",
            "interaction_history": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["mastery_by_skill"] == {}


class TestModelStatus:
    """Tests for /api/v1/ml/models/status endpoint."""
    
    def test_model_status(self, client):
        """Test model status endpoint."""
        response = client.get("/api/v1/ml/models/status")
        
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert "confusion" in data["models"]
        assert "bandit" in data["models"]


class TestTrainingEndpoint:
    """Tests for /api/v1/ml/train/{model} endpoint."""
    
    def test_trigger_training_valid_model(self, client):
        """Test triggering training for valid model."""
        response = client.post("/api/v1/ml/train/confusion", json={
            "use_synthetic": True,
            "n_samples": 1000
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert data["model"] == "confusion"
    
    def test_trigger_training_invalid_model(self, client):
        """Test triggering training for invalid model name."""
        response = client.post("/api/v1/ml/train/invalid_model", json={
            "use_synthetic": True
        })
        
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
