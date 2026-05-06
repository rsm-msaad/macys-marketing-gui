"""Download retail product photos from Unsplash and link them into dam_assets.

Pulls 50 photos across 10 retail-relevant search terms, saves them to
`data/images/dam/`, then updates `dam_assets.filename` for the first 50 clean
product/lifestyle assets so the database points at real local files.

Usage:
    uv run python data/generators/download_images.py

Requires `UNSPLASH_ACCESS_KEY` in `.env` at the repo root.

Rate limit notes:
    Unsplash demo tier allows 50 requests/hour. This script makes one search
    request per term (10 total), well under the limit. Image bytes are
    fetched from images.unsplash.com (CDN) which is not API rate limited.
    Search calls are throttled at ~6s apart to be a good citizen.

Reproducibility:
    Random seed is fixed at SEED=42, used only for sampling which dam_assets
    rows to link to. Unsplash search ranking itself can drift over time as
    new photos are indexed, so the exact file set may differ run to run.
"""

from __future__ import annotations

import os
import random
import sqlite3
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / ".env"
DB_PATH = REPO_ROOT / "data" / "macys.db"
IMAGES_DIR = REPO_ROOT / "data" / "images" / "dam"

SEED = 42

SEARCH_TERMS: list[str] = [
    "beauty product",
    "fashion accessories",
    "home decor",
    "skincare",
    "perfume",
    "cosmetics",
    "jewelry",
    "spring fashion",
    "gift wrapping",
    "lifestyle products",
]
PHOTOS_PER_TERM = 5  # 10 terms x 5 = 50 images

UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"
THROTTLE_SECONDS = 6.0  # 10 search calls x 6s = ~60s, well under 50/hr
HTTP_TIMEOUT = 60


def load_api_key() -> str:
    load_dotenv(ENV_PATH)
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise RuntimeError(
            f"UNSPLASH_ACCESS_KEY not found in {ENV_PATH}. "
            "Add `UNSPLASH_ACCESS_KEY=...` to .env at the repo root."
        )
    return key


def slugify(s: str) -> str:
    return "-".join(s.lower().split())


def search_photos(api_key: str, query: str, per_page: int) -> list[dict]:
    response = requests.get(
        UNSPLASH_SEARCH_URL,
        params={
            "query": query,
            "per_page": per_page,
            "page": 1,
            "orientation": "landscape",
            "content_filter": "high",
        },
        headers={
            "Authorization": f"Client-ID {api_key}",
            "Accept-Version": "v1",
        },
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get("results", [])


def download_image(url: str, dest: Path) -> int:
    response = requests.get(url, timeout=HTTP_TIMEOUT)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return len(response.content)


def filename_for(query: str, idx: int, photo_id: str) -> str:
    return f"{slugify(query)}_{idx:02d}_{photo_id}.jpg"


def fetch_all(api_key: str) -> list[tuple[str, str]]:
    """Run all searches and download every photo. Returns list of (filename, query)."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    downloaded: list[tuple[str, str]] = []
    for term_idx, query in enumerate(SEARCH_TERMS, start=1):
        print(f"[{term_idx:>2}/{len(SEARCH_TERMS)}] search: {query!r}")
        results = search_photos(api_key, query, per_page=PHOTOS_PER_TERM)
        if len(results) < PHOTOS_PER_TERM:
            print(f"        WARN: only {len(results)} results returned")
        for i, photo in enumerate(results[:PHOTOS_PER_TERM], start=1):
            url = photo["urls"]["regular"]
            photo_id = photo["id"]
            fname = filename_for(query, i, photo_id)
            dest = IMAGES_DIR / fname
            if dest.exists():
                print(f"        SKIP (exists): {fname}")
            else:
                size = download_image(url, dest)
                print(f"        GET  {fname}  ({size:,} bytes)")
            downloaded.append((fname, query))

        # Throttle search API calls (last iteration: no need to sleep).
        if term_idx < len(SEARCH_TERMS):
            time.sleep(THROTTLE_SECONDS)

    return downloaded


def update_dam_assets(downloaded: list[tuple[str, str]]) -> int:
    """Replace filename on the first N clean product/lifestyle dam_assets rows.

    Returns the number of rows updated.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(f"macys.db not found at {DB_PATH}")

    random.seed(SEED)
    shuffled = list(downloaded)
    random.shuffle(shuffled)

    conn = sqlite3.connect(str(DB_PATH))
    try:
        rows = conn.execute(
            """
            SELECT asset_id
            FROM dam_assets
            WHERE degradation_flag = 'clean'
              AND asset_type IN ('product', 'lifestyle')
            ORDER BY asset_id
            LIMIT ?
            """,
            (len(shuffled),),
        ).fetchall()

        if len(rows) < len(shuffled):
            print(
                f"        WARN: only {len(rows)} candidate dam_assets rows; "
                f"linking the first {len(rows)}."
            )

        n_updated = 0
        for (asset_id,), (fname, _query) in zip(rows, shuffled):
            conn.execute(
                "UPDATE dam_assets SET filename = ? WHERE asset_id = ?",
                (fname, asset_id),
            )
            n_updated += 1
        conn.commit()
        return n_updated
    finally:
        conn.close()


def main() -> int:
    api_key = load_api_key()
    print(f"Unsplash key loaded ({len(api_key)} chars). Saving to {IMAGES_DIR}")

    downloaded = fetch_all(api_key)
    print(f"\nTotal downloaded: {len(downloaded)} images")

    print("\n[db] updating dam_assets.filename ...")
    n = update_dam_assets(downloaded)
    print(f"        updated {n} dam_assets rows")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
