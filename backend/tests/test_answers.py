"""
Backend Tests: Answers Router

Tests for the answer submission endpoints.
"""
import pytest
from fastapi.testclient import TestClient



class TestAnswerSubmission:
    """Tests for /api/v1/answers/submit endpoint."""
    
    def test_correct_answer(self, client):
        """Test submitting a correct answer."""
        response = client.post("/api/v1/answers/submit", json={
            "user_id": "test_user_001",
            "question_id": "q_rel_001",  # Correct answer is 0
            "answer": 0,
            "time_taken_ms": 12000,
            "attempts": 1,
            "is_hint_used": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] == True
        assert "updated_mastery" in data
        assert "recommended_explanation" in data
        assert "feedback_message" in data
    
    def test_incorrect_answer(self, client):
        """Test submitting an incorrect answer."""
        response = client.post("/api/v1/answers/submit", json={
            "user_id": "test_user_002",
            "question_id": "q_rel_001",  # Correct answer is 0
            "answer": 2,  # Wrong
            "time_taken_ms": 25000,
            "attempts": 1,
            "is_hint_used": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] == False
        assert data["correct_answer"] == 0  # Revealed after wrong answer
        assert "recommended_explanation" in data
    
    def test_fast_correct_answer(self, client):
        """Test that fast correct answers recommend harder content."""
        response = client.post("/api/v1/answers/submit", json={
            "user_id": "test_user_003",
            "question_id": "q_sql_001",
            "answer": 0,  # Correct (was 2)
            "time_taken_ms": 5000,  # Fast
            "attempts": 1,
            "is_hint_used": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] == True
        assert data["recommended_explanation"] == "harder"
    
    def test_multiple_attempts(self, client):
        """Test answer with multiple attempts."""
        response = client.post("/api/v1/answers/submit", json={
            "user_id": "test_user_004",
            "question_id": "q_norm_001",
            "answer": 1,  # Wrong (correct is 0)
            "time_taken_ms": 45000,
            "attempts": 3,  # Multiple attempts
            "is_hint_used": True
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should recommend easier content for struggling student
        assert data["recommended_explanation"] == "easier"
    
    def test_answer_validation(self, client):
        """Test that invalid payloads are rejected."""
        # Missing required fields
        response = client.post("/api/v1/answers/submit", json={
            "user_id": "test_user"
            # Missing question_id, answer, time_taken_ms
        })
        
        assert response.status_code == 422  # Validation error


class TestAnswerHistory:
    """Tests for /api/v1/answers/history endpoint."""
    
    def test_get_history(self, client):
        """Test getting answer history for a user."""
        response = client.get("/api/v1/answers/history/test_user_001")
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "total_answers" in data
        assert "recent_answers" in data
    
    def test_get_history_with_limit(self, client):
        """Test getting answer history with custom limit."""
        response = client.get("/api/v1/answers/history/test_user_001?limit=10")
        
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
