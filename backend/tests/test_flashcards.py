"""Tests for the flashcard router — SRS scheduling + RL reward loop."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch


def _make_existing_card_doc(arm: str | None = "visual"):
    """Build a Firestore-style mock for an existing flashcard_progress doc
    that already carries an originating bandit arm."""
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "card_id": "card_abc",
        "state": "REVIEW",
        "interval": 5,
        "ease_factor": 2.5,
        "repetition": 3,
        "step_index": 0,
        "next_review_at": datetime.utcnow(),
        "recommended_arm": arm,
        "spawn_confusion_score": 0.81,
        "spawn_mastery": 0.34,
    }
    return snap


def test_review_endpoint_feeds_bandit_when_arm_supplied(client):
    """A review payload that carries an arm should trigger update_bandit."""
    from main import app
    from database import get_db

    mock_db = app.dependency_overrides[get_db]()
    # First .get() returns existing card progress doc (so endpoint reuses path)
    snap = _make_existing_card_doc(arm=None)
    (mock_db.collection.return_value
            .document.return_value
            .collection.return_value
            .document.return_value
            .get.return_value) = snap

    with patch("services.ml_service.ml_service.update_bandit") as upd:
        r = client.post(
            "/api/v1/flashcards/card_abc/review",
            json={
                "answer": "GOOD",
                "recommended_arm": "step",
                "confusion_score": 0.7,
                "mastery": 0.4,
            },
        )

    assert r.status_code == 200
    upd.assert_called_once()
    kwargs = upd.call_args.kwargs
    assert kwargs["arm_name"] == "step"
    # GOOD -> 0.8 in the SRS reward map.
    assert kwargs["reward"] == 0.8
    assert kwargs["context"]["confusion_score"] == 0.7
    assert kwargs["context"]["mastery"] == 0.4


def test_review_endpoint_falls_back_to_stored_arm(client):
    """When the client doesn't supply an arm, we should reuse the one
    captured at spawn time so the RL loop keeps closing."""
    from main import app
    from database import get_db

    mock_db = app.dependency_overrides[get_db]()
    snap = _make_existing_card_doc(arm="analogy")
    (mock_db.collection.return_value
            .document.return_value
            .collection.return_value
            .document.return_value
            .get.return_value) = snap

    with patch("services.ml_service.ml_service.update_bandit") as upd:
        r = client.post(
            "/api/v1/flashcards/card_abc/review",
            json={"answer": "AGAIN"},
        )

    assert r.status_code == 200
    upd.assert_called_once()
    kwargs = upd.call_args.kwargs
    assert kwargs["arm_name"] == "analogy"
    # AGAIN -> 0.0 reward (punish the arm).
    assert kwargs["reward"] == 0.0
    # Stored context should be reused as fallback.
    assert kwargs["context"]["confusion_score"] == 0.81
    assert kwargs["context"]["mastery"] == 0.34


def test_review_endpoint_skips_bandit_when_no_arm_known(client):
    """If neither the client nor Firestore knows an arm, we should
    update SRS state silently without touching the bandit."""
    from main import app
    from database import get_db

    mock_db = app.dependency_overrides[get_db]()
    # Default conftest snap returns exists=False; emulate fresh card.

    with patch("services.ml_service.ml_service.update_bandit") as upd:
        r = client.post(
            "/api/v1/flashcards/new_card/review",
            json={"answer": "EASY"},
        )

    assert r.status_code == 200
    upd.assert_not_called()


def test_review_endpoint_rejects_bad_answer(client):
    r = client.post(
        "/api/v1/flashcards/card_abc/review",
        json={"answer": "MAYBE"},
    )
    assert r.status_code == 400
