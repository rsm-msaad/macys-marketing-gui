"""
MCP tool: find_dam_assets.

Queries the seeded DAM database for assets matching a category and region.
Filters out assets whose model release has already expired. Used by the
localization-generator skill at workflow step 7 to pull the right imagery
for each regional variant.

CLI:
    python -m tools.find_dam_assets Beauty FL --max 3
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import date
from pathlib import Path
from typing import Any

DB_PATH: Path = Path(__file__).resolve().parent.parent / "macys_m3.db"


def _connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Open a read only connection to the seeded DAM database."""
    if not db_path.exists():
        raise FileNotFoundError(
            f"DAM database not found at {db_path}. "
            "Build it first with: python tools/seed_db.py"
        )
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _is_active(expires: str | None, today: date | None = None) -> bool:
    """Return True if the model release has not yet expired.

    expires is an ISO 8601 date string. None or empty means no release on
    file, which we treat as active (covers owned brand and product still
    photography that has no model).
    """
    if not expires:
        return True
    today = today or date.today()
    try:
        return date.fromisoformat(expires) >= today
    except ValueError:
        return True


def find_dam_assets(
    category: str,
    region: str,
    max_results: int = 5,
    db_path: Path = DB_PATH,
    today: date | None = None,
) -> dict[str, Any]:
    """Find DAM assets for a category and region with active model rights.

    Args:
        category: top level category, for example 'Beauty' or 'Home'.
        region: region code, for example 'NY', 'FL', 'PR', 'QC'.
        max_results: cap on the number of assets returned.
        db_path: optional override, used by tests.
        today: optional override for the current date, used by tests.

    Returns:
        Dict with:
          status: 'pass' if at least one match, 'empty' otherwise
          assets: list of {asset_id, filename, tag_list, region_rights}
          result_count: number of assets returned after the expiry filter
    """
    conn = _connect(db_path)
    try:
        rows = conn.execute(
            "SELECT asset_id, category, region_rights, filename, tag_list, "
            "model_release_expires "
            "FROM dam_assets WHERE category = ? AND region_rights LIKE ?",
            (category, f"%{region}%"),
        ).fetchall()
    finally:
        conn.close()
    assets: list[dict[str, Any]] = []
    for row in rows:
        if not _is_active(row["model_release_expires"], today):
            continue
        assets.append(
            {
                "asset_id": row["asset_id"],
                "filename": row["filename"],
                "tag_list": row["tag_list"],
                "region_rights": row["region_rights"],
            }
        )
        if len(assets) >= max_results:
            break
    return {
        "status": "pass" if assets else "empty",
        "assets": assets,
        "result_count": len(assets),
    }


def _cli(argv: list[str]) -> int:
    """CLI entry, run a lookup and pretty print the result."""
    parser = argparse.ArgumentParser(description="Find DAM assets by category and region.")
    parser.add_argument("category")
    parser.add_argument("region")
    parser.add_argument("--max", type=int, default=5, dest="max_results")
    args = parser.parse_args(argv)
    result = find_dam_assets(args.category, args.region, max_results=args.max_results)
    print(f"status: {result['status']}, count: {result['result_count']}")
    for asset in result["assets"]:
        print(f"  {asset['asset_id']:20s} {asset['filename']:34s} {asset['tag_list']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
