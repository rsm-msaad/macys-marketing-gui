"""Tests for the /api/images/hero endpoint and persona avatar fields."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routes.images import _hero_cache
from api.routes.personas import PERSONAS


@pytest.fixture(autouse=True)
def _clear_hero_cache():
    """Ensure the in memory cache is empty before each test."""
    _hero_cache.clear()
    yield
    _hero_cache.clear()


client = TestClient(app)


# ---- Persona avatars ----


def test_personas_have_avatar_field():
    """Every persona returned by the API should include an avatar URL."""
    resp = client.get("/personas")
    assert resp.status_code == 200
    personas = resp.json()
    assert len(personas) == 4
    for p in personas:
        assert "avatar" in p, f"Persona {p['name']} missing avatar field"
        assert p["avatar"].startswith("/avatars/")


def test_persona_avatar_urls_are_unique():
    avatars = [p["avatar"] for p in PERSONAS]
    assert len(set(avatars)) == len(avatars), "Each persona should have a unique avatar URL"


# ---- Hero image endpoint ----

MOCK_UNSPLASH_RESPONSE = {
    "results": [
        {
            "urls": {"regular": "https://images.unsplash.com/photo-test123"},
            "alt_description": "a beautiful scene",
            "description": None,
            "user": {
                "name": "Jane Photographer",
                "links": {"html": "https://unsplash.com/@janep"},
            },
        }
    ]
}


@patch("api.routes.images.requests.get")
def test_hero_image_returns_expected_fields(mock_get: MagicMock):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_UNSPLASH_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    resp = client.get("/api/images/hero?category=Beauty&audience=Loyalists")
    assert resp.status_code == 200
    data = resp.json()
    assert data["image_url"] == "https://images.unsplash.com/photo-test123"
    assert data["photographer"] == "Jane Photographer"
    assert data["photographer_url"] == "https://unsplash.com/@janep"
    assert data["alt"] == "a beautiful scene"


@patch("api.routes.images.requests.get")
def test_hero_image_caches_results(mock_get: MagicMock):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_UNSPLASH_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    # First call hits the API
    resp1 = client.get("/api/images/hero?category=Home&audience=Gift%20Givers")
    assert resp1.status_code == 200
    assert mock_get.call_count == 1

    # Second identical call should come from cache
    resp2 = client.get("/api/images/hero?category=Home&audience=Gift%20Givers")
    assert resp2.status_code == 200
    assert mock_get.call_count == 1  # no new API call


@patch("api.routes.images.requests.get")
def test_hero_image_no_results(mock_get: MagicMock):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"results": []}
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    resp = client.get("/api/images/hero?category=Unknown&audience=Nobody")
    assert resp.status_code == 404


@patch("api.routes.images.requests.get")
def test_hero_image_custom_query_override(mock_get: MagicMock):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_UNSPLASH_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    resp = client.get("/api/images/hero?category=X&audience=Y&query=custom+search")
    assert resp.status_code == 200
    # Verify the API was called with the custom query, not the default
    call_params = mock_get.call_args
    assert call_params[1]["params"]["query"] == "custom search"


def test_hero_image_missing_unsplash_key():
    """When the UNSPLASH_ACCESS_KEY is missing the endpoint returns 503."""
    with patch.dict("os.environ", {"UNSPLASH_ACCESS_KEY": ""}, clear=False):
        _hero_cache.clear()
        resp = client.get("/api/images/hero?category=Test&audience=Test")
        assert resp.status_code == 503
