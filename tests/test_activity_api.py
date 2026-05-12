"""Tests for the /api/ai/activity endpoint and log_ai_activity helper."""

import pytest
from fastapi.testclient import TestClient

from api.main import AI_ACTIVITY_LOG, app, log_ai_activity

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_log():
    """Start each test with an empty activity log."""
    AI_ACTIVITY_LOG.clear()
    yield
    AI_ACTIVITY_LOG.clear()


def test_activity_empty_on_start():
    resp = client.get("/api/ai/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert data["events"] == []
    assert data["count"] == 0


def test_log_ai_activity_adds_event():
    log_ai_activity(
        skill_name="compliance_pre_check",
        summary="Compliance check passed, 3 docs cited",
        retrieved_docs=["DOC-1", "DOC-2", "DOC-3"],
        campaign_id="C-001",
    )
    resp = client.get("/api/ai/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    evt = data["events"][0]
    assert evt["skill_name"] == "compliance_pre_check"
    assert evt["summary"] == "Compliance check passed, 3 docs cited"
    assert evt["retrieved_docs"] == ["DOC-1", "DOC-2", "DOC-3"]
    assert evt["campaign_id"] == "C-001"
    assert "timestamp" in evt


def test_activity_newest_first():
    log_ai_activity(skill_name="a", summary="first")
    log_ai_activity(skill_name="b", summary="second")
    log_ai_activity(skill_name="c", summary="third")
    resp = client.get("/api/ai/activity")
    names = [e["skill_name"] for e in resp.json()["events"]]
    assert names == ["c", "b", "a"]


def test_activity_limit_param():
    for i in range(5):
        log_ai_activity(skill_name=f"s{i}", summary=f"event {i}")
    resp = client.get("/api/ai/activity?limit=2")
    assert len(resp.json()["events"]) == 2
    assert resp.json()["count"] == 5


def test_activity_filter_by_campaign_id():
    log_ai_activity(skill_name="x", summary="for A", campaign_id="A")
    log_ai_activity(skill_name="y", summary="for B", campaign_id="B")
    log_ai_activity(skill_name="z", summary="for A again", campaign_id="A")

    resp = client.get("/api/ai/activity?campaign_id=A")
    events = resp.json()["events"]
    assert len(events) == 2
    assert all(e["campaign_id"] == "A" for e in events)


def test_activity_filter_empty_result():
    log_ai_activity(skill_name="x", summary="test", campaign_id="X")
    resp = client.get("/api/ai/activity?campaign_id=NONE")
    assert resp.json()["events"] == []


def test_log_without_optional_fields():
    log_ai_activity(skill_name="test", summary="no extras")
    resp = client.get("/api/ai/activity")
    evt = resp.json()["events"][0]
    assert evt["retrieved_docs"] == []
    assert evt["campaign_id"] is None


def test_deque_maxlen_respected():
    for i in range(55):
        log_ai_activity(skill_name=f"s{i}", summary=f"event {i}")
    assert len(AI_ACTIVITY_LOG) == 50
    resp = client.get("/api/ai/activity?limit=100")
    assert len(resp.json()["events"]) == 50
