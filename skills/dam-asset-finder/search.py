"""DAM Asset Finder skill.

Searches `data/macys.db` for clean, on-brief DAM assets ranked by how well
their tags and asset_type match a campaign brief, with quality boosts for
recent and high-resolution assets. Filters out degraded, expired, or low
resolution assets so a designer like Priya does not have to scroll through
800 noisy results.

Usage:
    uv run python skills/dam-asset-finder/search.py "Mother's Day Beauty Event"
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from datetime import date
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "macys.db"

# Filter thresholds.
MIN_PIXELS = 1024 * 768  # below this counts as low resolution

# Ranking parameters.
RECENCY_DAYS = 365  # "recent" means created in the last N days
RECENCY_BOOST = 0.20
RES_4K_PIXELS = 3840 * 2160
RES_HD_PIXELS = 1920 * 1080
RES_4K_BOOST = 0.10
RES_HD_BOOST = 0.05
DEFAULT_MAX_RESULTS = 12

STOPWORDS = frozenset({
    "the", "a", "an", "for", "of", "and", "or", "to", "in", "on",
    "at", "by", "with", "this", "that", "is", "are", "was", "were",
    "be", "been", "being", "from",
})


# ---------- DB ----------


def connect_db(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    return sqlite3.connect(str(db_path))


# ---------- pure helpers ----------


def _tokenize(text: str | None) -> list[str]:
    """Lowercase, drop apostrophes, split on non word and on hyphens, drop stopwords.

    Apostrophes are stripped (not split) so "Mother's" becomes "mothers" and
    matches a tag like "mothers-day", which is the common DAM convention.
    """
    if not text:
        return []
    no_apostrophes = text.lower().replace("'", "").replace("’", "")
    cleaned = re.sub(r"[^\w\s-]", " ", no_apostrophes)
    parts = cleaned.replace("-", " ").split()
    return [t for t in parts if t and t not in STOPWORDS]


def _parse_tags(tags_json: str | None) -> list[str]:
    if not tags_json:
        return []
    try:
        loaded = json.loads(tags_json)
    except (json.JSONDecodeError, TypeError):
        return []
    if isinstance(loaded, list):
        return [str(t).strip() for t in loaded if t]
    return []


def _parse_resolution(resolution: str | None) -> tuple[int, int]:
    if not resolution:
        return 0, 0
    try:
        w, h = resolution.lower().split("x")
        return int(w), int(h)
    except (ValueError, AttributeError):
        return 0, 0


def _resolution_pixels(resolution: str | None) -> int:
    w, h = _parse_resolution(resolution)
    return w * h


def _resolution_boost(resolution: str | None) -> float:
    pixels = _resolution_pixels(resolution)
    if pixels >= RES_4K_PIXELS:
        return RES_4K_BOOST
    if pixels >= RES_HD_PIXELS:
        return RES_HD_BOOST
    return 0.0


def _recency_boost(created_date: str | None, today: date) -> float:
    if not created_date:
        return 0.0
    try:
        created = date.fromisoformat(created_date)
    except (ValueError, TypeError):
        return 0.0
    age_days = (today - created).days
    if 0 <= age_days <= RECENCY_DAYS:
        return RECENCY_BOOST
    return 0.0


def compute_relevance(
    brief_tokens: list[str],
    tags: list[str],
    asset_type: str | None,
) -> float:
    """Fraction of brief tokens present in the asset's tag/type haystack."""
    if not brief_tokens:
        return 0.0
    haystack: set[str] = set()
    for tag in tags:
        haystack.update(_tokenize(tag))
    haystack.update(_tokenize(asset_type))
    matched = sum(1 for tok in brief_tokens if tok in haystack)
    return matched / len(brief_tokens)


def _is_degraded(degradation_flag: str | None) -> bool:
    return (degradation_flag or "").strip().lower() != "clean"


def _is_expired(usage_rights: str | None) -> bool:
    return (usage_rights or "").strip().lower() == "expired"


# ---------- core pipeline ----------


def _classify_filter_reason(
    degradation_flag: str | None,
    usage_rights: str | None,
    resolution: str | None,
) -> str | None:
    """First filter reason that disqualifies this asset, or None."""
    if _is_degraded(degradation_flag):
        return "degraded"
    if _is_expired(usage_rights):
        return "expired_rights"
    if _resolution_pixels(resolution) < MIN_PIXELS:
        return "low_resolution"
    return None


def _row_to_asset(row: tuple, brief_tokens: list[str], today: date) -> dict:
    (
        asset_id,
        filename,
        asset_type,
        tags_json,
        _associated_skus,
        _season,
        _brand,
        created_date,
        _last_used_date,
        _file_size_mb,
        resolution,
        usage_rights,
        degradation_flag,
    ) = row

    tags = _parse_tags(tags_json)
    raw_relevance = compute_relevance(brief_tokens, tags, asset_type)
    boost = _recency_boost(created_date, today) + _resolution_boost(resolution)
    composite = max(0.0, min(1.0, raw_relevance + boost))

    return {
        "asset_id": int(asset_id),
        "filename": filename,
        "asset_type": asset_type,
        "tags": tags,
        "resolution": resolution,
        "usage_rights": usage_rights,
        "relevance_score": round(composite, 4),
        "quality_flag": "clean" if not _is_degraded(degradation_flag) else "degraded",
        "_raw_relevance": round(raw_relevance, 4),
        "_created_date": created_date,
    }


def search_with_stats(
    brief_description: str,
    max_results: int = DEFAULT_MAX_RESULTS,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> tuple[list[dict], dict]:
    """Run the full pipeline. Returns (top_results, stats)."""
    conn = connect_db(db_path)
    try:
        rows = conn.execute(
            """
            SELECT asset_id, filename, asset_type, tags, associated_skus,
                   season, brand, created_date, last_used_date,
                   file_size_mb, resolution, usage_rights, degradation_flag
            FROM dam_assets
            """
        ).fetchall()
    finally:
        conn.close()

    today = date.today()
    brief_tokens = _tokenize(brief_description)

    filtered_counts = {"degraded": 0, "expired_rights": 0, "low_resolution": 0}
    candidates: list[dict] = []

    for row in rows:
        reason = _classify_filter_reason(
            degradation_flag=row[12],
            usage_rights=row[11],
            resolution=row[10],
        )
        if reason is not None:
            filtered_counts[reason] += 1
            continue
        candidates.append(_row_to_asset(row, brief_tokens, today))

    candidates.sort(key=lambda a: (a["relevance_score"], a["asset_id"]), reverse=True)
    top = candidates[: max(0, int(max_results))]
    for i, asset in enumerate(top, start=1):
        asset["rank"] = i

    avg_relevance = (
        sum(a["relevance_score"] for a in top) / len(top) if top else 0.0
    )

    stats = {
        "total_searched": len(rows),
        "filtered_out": dict(filtered_counts),
        "filtered_total": sum(filtered_counts.values()),
        "kept": len(candidates),
        "returned": len(top),
        "avg_relevance": round(avg_relevance, 4),
    }
    return top, stats


def find_assets(
    brief_description: str,
    max_results: int = DEFAULT_MAX_RESULTS,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """Public entry point: top ranked candidate assets for the brief."""
    top, _stats = search_with_stats(brief_description, max_results, db_path)
    return top


# ---------- formatters ----------


def _fmt_int(n: int) -> str:
    return f"{n:,}"


def format_results(brief: str, results: list[dict], stats: dict) -> str:
    bar = "=" * 60
    lines = [bar, f'DAM ASSET SEARCH for: "{brief}"', bar, ""]

    lines.append(f"Total assets searched: {_fmt_int(stats['total_searched'])}")
    lines.append(f"Filtered out: {_fmt_int(stats['filtered_total'])}")
    fo = stats["filtered_out"]
    label_map = {
        "degraded": "Degraded",
        "expired_rights": "Expired rights",
        "low_resolution": "Low resolution",
    }
    for key in ("degraded", "expired_rights", "low_resolution"):
        if fo.get(key, 0) > 0:
            lines.append(f"  - {label_map[key]}: {_fmt_int(fo[key])}")

    lines.append(f"Kept after filters: {_fmt_int(stats['kept'])}")
    lines.append("")

    if not results:
        lines.append("No assets matched after filtering.")
        lines.append(bar)
        return "\n".join(lines)

    lines.append(f"Top {stats['returned']} ranked assets:")
    lines.append("")

    for asset in results:
        type_label = (asset["asset_type"] or "").title()
        tags_str = ", ".join(asset["tags"]) if asset["tags"] else "(none)"
        lines.append(f"RANK {asset['rank']}")
        lines.append(f"Asset ID:   A-{asset['asset_id']:05d}")
        lines.append(f"Filename:   {asset['filename']}")
        lines.append(f"Type:       {type_label}")
        lines.append(f"Resolution: {asset['resolution']}")
        lines.append(f"Tags:       {tags_str}")
        lines.append(f"Rights:     {asset['usage_rights']}")
        lines.append(f"Relevance:  {asset['relevance_score']:.2f}")
        lines.append("")

    lines.append(f"Average relevance of returned set: {stats['avg_relevance']:.2f}")
    lines.append(bar)
    return "\n".join(lines)


# ---------- main ----------


def main(argv: list[str]) -> int:
    if len(argv) < 2 or not argv[1].strip():
        print('Usage: python search.py "<campaign brief description>"', file=sys.stderr)
        return 1
    brief = argv[1]
    max_results = int(argv[2]) if len(argv) > 2 else DEFAULT_MAX_RESULTS
    results, stats = search_with_stats(brief, max_results=max_results)
    print(format_results(brief, results, stats))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
