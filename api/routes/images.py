"""Image endpoints: hero image search via Unsplash."""

from __future__ import annotations

import os
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/images", tags=["images"])

UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"

# Simple in memory cache keyed by the query string so we do not
# re fetch the same image on every page load.
_hero_cache: dict[str, dict] = {}


def _get_unsplash_key() -> str:
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="UNSPLASH_ACCESS_KEY not set in environment.",
        )
    return key


@router.get("/hero")
def hero_image(
    category: str = "Beauty",
    audience: str = "Beauty Loyalists",
    query: Optional[str] = None,
) -> dict:
    """Return a single Unsplash image URL suitable for a campaign hero banner.

    Builds a search query from category + audience unless an explicit query
    override is provided.  Results are cached in memory so repeat requests
    for the same campaign do not count against the Unsplash rate limit.
    """
    search_query = query or f"{category} {audience} lifestyle"
    if search_query in _hero_cache:
        return _hero_cache[search_query]

    key = _get_unsplash_key()
    try:
        resp = requests.get(
            UNSPLASH_SEARCH_URL,
            params={
                "query": search_query,
                "per_page": 1,
                "orientation": "landscape",
                "content_filter": "high",
            },
            headers={
                "Authorization": f"Client-ID {key}",
                "Accept-Version": "v1",
            },
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    results = resp.json().get("results", [])
    if not results:
        raise HTTPException(status_code=404, detail="No images found for this query.")

    photo = results[0]
    payload = {
        "image_url": photo["urls"]["regular"],
        "alt": photo.get("alt_description") or photo.get("description") or search_query,
        "photographer": photo["user"]["name"],
        "photographer_url": photo["user"]["links"]["html"],
    }
    _hero_cache[search_query] = payload
    return payload
