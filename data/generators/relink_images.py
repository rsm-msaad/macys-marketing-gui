"""Relink dam_assets.filename to existing JPGs in data/images/dam/.

After running build_database.py from scratch, dam_assets.filename gets reset
to the synthetic names produced by generate_dam.py. This script re-points
those rows at the real Unsplash JPGs already on disk, without making any
API calls.

The selection rule and seed match download_images.py, so a relink lands on
the same dam_assets rows that the download originally chose.

Usage:
    uv run python data/generators/relink_images.py
"""

from __future__ import annotations

import random
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "data" / "macys.db"
IMAGES_DIR = REPO_ROOT / "data" / "images" / "dam"

SEED = 42  # must match download_images.py


def list_local_jpgs(images_dir: Path) -> list[str]:
    if not images_dir.exists():
        raise FileNotFoundError(
            f"Images directory not found: {images_dir}. "
            "Run download_images.py first to populate it."
        )
    return sorted(p.name for p in images_dir.iterdir() if p.suffix.lower() == ".jpg")


def relink(db_path: Path, image_filenames: list[str]) -> int:
    """Update dam_assets.filename on the first N clean product/lifestyle rows.

    Returns the number of rows updated.
    """
    if not db_path.exists():
        raise FileNotFoundError(f"macys.db not found at {db_path}")
    if not image_filenames:
        raise RuntimeError("No JPGs found on disk to relink.")

    random.seed(SEED)
    shuffled = list(image_filenames)
    random.shuffle(shuffled)

    conn = sqlite3.connect(str(db_path))
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
                f"WARN: only {len(rows)} candidate dam_assets rows; "
                f"linking the first {len(rows)} of {len(shuffled)} images.",
                file=sys.stderr,
            )

        n_updated = 0
        for (asset_id,), fname in zip(rows, shuffled):
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
    print(f"Scanning {IMAGES_DIR} ...")
    files = list_local_jpgs(IMAGES_DIR)
    print(f"Found {len(files)} JPG files on disk.")

    print(f"Updating {DB_PATH} ...")
    n = relink(DB_PATH, files)
    print(f"Updated {n} dam_assets rows.")

    print("Done. No API calls were made.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
