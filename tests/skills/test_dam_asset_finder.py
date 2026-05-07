"""Tests for `skills/dam-asset-finder/search.py`."""

from __future__ import annotations

import importlib.util
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pytest

_MODULE_PATH = Path(__file__).resolve().parents[2] / "skills" / "dam-asset-finder" / "search.py"
_spec = importlib.util.spec_from_file_location("dam_search", _MODULE_PATH)
assert _spec and _spec.loader
search = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(search)


SCHEMA_SQL = """
CREATE TABLE dam_assets (
    asset_id          INTEGER PRIMARY KEY,
    filename          TEXT,
    asset_type        TEXT,
    tags              TEXT,
    associated_skus   TEXT,
    season            TEXT,
    brand             TEXT,
    created_date      TEXT,
    last_used_date    TEXT,
    file_size_mb      REAL,
    resolution        TEXT,
    usage_rights      TEXT,
    degradation_flag  TEXT
);
"""


def _today() -> date:
    return date.today()


def _recent(days_ago: int = 30) -> str:
    return (_today() - timedelta(days=days_ago)).isoformat()


def _old(days_ago: int = 800) -> str:
    return (_today() - timedelta(days=days_ago)).isoformat()


def _row(
    asset_id: int,
    asset_type: str,
    tags: list[str],
    created: str,
    resolution: str,
    rights: str,
    flag: str,
) -> tuple:
    return (
        asset_id,
        f"a{asset_id:02d}.jpg",
        asset_type,
        json.dumps(tags),
        "[]",
        "Spring",
        "INC",
        created,
        created,
        10.0,
        resolution,
        rights,
        flag,
    )


# Engineered fixture: 14 assets where filtering and ranking outcomes are
# entirely predictable for the brief "Mother's Day Beauty Event".
ROWS = [
    _row(1, "hero", ["beauty", "mothers-day"], _recent(30), "3840x2160", "free", "clean"),
    _row(2, "lifestyle", ["spring", "model"], _recent(60), "1920x1080", "free", "clean"),
    _row(3, "hero", ["beauty"], _old(800), "3840x2160", "free", "clean"),
    _row(4, "hero", ["beauty"], _recent(30), "800x600", "free", "clean"),  # low res
    _row(5, "hero", ["beauty"], _recent(30), "3840x2160", "free", "mislabeled"),  # degraded
    _row(6, "hero", ["beauty"], _recent(30), "1920x1080", "expired", "clean"),  # expired rights
    _row(7, "product", [], _recent(30), "1920x1080", "free", "clean"),
    _row(8, "hero", ["beauty"], _recent(30), "640x480", "free", "clean"),  # low res
    _row(9, "lifestyle", ["lifestyle"], _recent(30), "3840x2160", "free", "clean"),
    _row(10, "hero", ["mothers-day"], _recent(30), "1920x1080", "free", "clean"),
    _row(11, "hero", ["beauty"], _recent(30), "800x600", "free", "lowres"),  # degraded
    _row(12, "hero", ["beauty", "day"], _recent(30), "3840x2160", "free", "clean"),
    _row(13, "hero", ["beauty"], _recent(30), "3840x2160", "expired", "expired"),  # degraded
    _row(14, "hero", ["beauty", "mothers", "day", "event"], _recent(30), "3840x2160", "free", "clean"),
]

DEGRADED_IDS = {5, 11, 13}
EXPIRED_RIGHTS_IDS = {6}
LOW_RES_IDS = {4, 8}
KEPT_IDS = {1, 2, 3, 7, 9, 10, 12, 14}

BEAUTY_BRIEF = "Mother's Day Beauty Event"


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "dam_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    conn.executemany(
        "INSERT INTO dam_assets ("
        "asset_id, filename, asset_type, tags, associated_skus, season, brand, "
        "created_date, last_used_date, file_size_mb, resolution, usage_rights, degradation_flag"
        ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ROWS,
    )
    conn.commit()
    conn.close()
    return db_path


# ---------- connect_db ----------


def test_connect_db_missing_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        search.connect_db(tmp_path / "no-such-db.db")


def test_find_assets_missing_db_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        search.find_assets("brief", db_path=tmp_path / "missing.db")


# ---------- pure helpers ----------


def test_tokenize_lowercases_and_drops_stopwords():
    out = search._tokenize("The Mother's Day Beauty Event")
    assert "the" not in out
    assert "mothers" in out
    assert "day" in out
    assert "beauty" in out
    assert "event" in out


def test_tokenize_handles_empty_and_none():
    assert search._tokenize("") == []
    assert search._tokenize(None) == []


def test_tokenize_splits_on_hyphens():
    assert search._tokenize("mothers-day") == ["mothers", "day"]


def test_parse_tags_handles_json_list():
    assert search._parse_tags(json.dumps(["beauty", "spring"])) == ["beauty", "spring"]


def test_parse_tags_handles_empty_and_none_and_malformed():
    assert search._parse_tags("[]") == []
    assert search._parse_tags(None) == []
    assert search._parse_tags("not-json") == []
    assert search._parse_tags("{}") == []  # not a list


def test_parse_resolution_handles_standard_and_bad_input():
    assert search._parse_resolution("1920x1080") == (1920, 1080)
    assert search._parse_resolution("3840X2160") == (3840, 2160)  # case insensitive
    assert search._parse_resolution("garbage") == (0, 0)
    assert search._parse_resolution(None) == (0, 0)


def test_resolution_boost_returns_correct_tier():
    assert search._resolution_boost("3840x2160") == search.RES_4K_BOOST
    assert search._resolution_boost("4096x2304") == search.RES_4K_BOOST
    assert search._resolution_boost("1920x1080") == search.RES_HD_BOOST
    assert search._resolution_boost("2560x1440") == search.RES_HD_BOOST
    assert search._resolution_boost("800x600") == 0.0
    assert search._resolution_boost(None) == 0.0


def test_recency_boost_recent_vs_old():
    today = _today()
    assert search._recency_boost(_recent(30), today) == search.RECENCY_BOOST
    assert search._recency_boost(_recent(364), today) == search.RECENCY_BOOST
    assert search._recency_boost(_old(800), today) == 0.0
    assert search._recency_boost(None, today) == 0.0
    assert search._recency_boost("not-a-date", today) == 0.0


# ---------- compute_relevance ----------


def test_compute_relevance_empty_brief_returns_zero():
    assert search.compute_relevance([], ["beauty"], "hero") == 0.0


def test_compute_relevance_full_match_returns_one():
    tokens = ["beauty", "mothers", "day"]
    score = search.compute_relevance(tokens, ["beauty", "mothers-day"], "hero")
    assert score == pytest.approx(1.0)


def test_compute_relevance_partial_match():
    tokens = ["beauty", "mothers", "day", "event"]
    # 3 of 4 brief tokens appear in tag tokenization.
    score = search.compute_relevance(tokens, ["beauty", "mothers-day"], "hero")
    assert score == pytest.approx(0.75)


def test_compute_relevance_uses_asset_type_tokens():
    tokens = ["lifestyle", "outdoor"]
    # asset_type "lifestyle" should match the first token.
    score = search.compute_relevance(tokens, [], "lifestyle")
    assert score == pytest.approx(0.5)


# ---------- find_assets full pipeline ----------


def test_find_assets_excludes_degraded_assets(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    out_ids = {r["asset_id"] for r in results}
    assert out_ids.isdisjoint(DEGRADED_IDS), f"degraded assets present: {out_ids & DEGRADED_IDS}"
    assert all(r["quality_flag"] == "clean" for r in results)


def test_find_assets_excludes_expired_rights(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    out_ids = {r["asset_id"] for r in results}
    assert out_ids.isdisjoint(EXPIRED_RIGHTS_IDS)
    assert all(r["usage_rights"] != "expired" for r in results)


def test_find_assets_excludes_low_resolution(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    out_ids = {r["asset_id"] for r in results}
    assert out_ids.isdisjoint(LOW_RES_IDS)
    for r in results:
        w, h = search._parse_resolution(r["resolution"])
        assert w * h >= search.MIN_PIXELS


def test_find_assets_returns_only_kept_ids(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    assert {r["asset_id"] for r in results} == KEPT_IDS


def test_find_assets_respects_max_results(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=3, db_path=seeded_db)
    assert len(results) == 3


def test_find_assets_default_max_results_is_12(seeded_db: Path):
    """Fixture has 8 kept assets so default 12 returns all 8."""
    results = search.find_assets(BEAUTY_BRIEF, db_path=seeded_db)
    assert len(results) == 8


def test_find_assets_ranks_descending_by_relevance(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    scores = [r["relevance_score"] for r in results]
    assert scores == sorted(scores, reverse=True)


def test_find_assets_top_result_is_best_match(seeded_db: Path):
    """Asset 14 has all 4 brief tokens in tags plus 4K plus recent boosts;
    it should rank first (clamped to 1.0). Asset 1 ties at 1.0 but loses
    on asset_id tie break (descending)."""
    results = search.find_assets(BEAUTY_BRIEF, max_results=3, db_path=seeded_db)
    assert results[0]["asset_id"] == 14
    assert results[0]["relevance_score"] == 1.0


def test_find_assets_ranks_are_sequential(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    assert [r["rank"] for r in results] == list(range(1, len(results) + 1))


REQUIRED_FIELDS = {
    "rank",
    "asset_id",
    "filename",
    "asset_type",
    "tags",
    "resolution",
    "usage_rights",
    "relevance_score",
    "quality_flag",
}


def test_find_assets_dicts_have_all_required_fields(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=5, db_path=seeded_db)
    for r in results:
        assert REQUIRED_FIELDS.issubset(r.keys())


def test_find_assets_relevance_score_is_in_unit_interval(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    for r in results:
        assert 0.0 <= r["relevance_score"] <= 1.0


def test_find_assets_empty_brief_returns_boost_ranked_results(seeded_db: Path):
    """Empty brief means raw relevance is 0 for everyone; boosts still rank."""
    results = search.find_assets("", max_results=20, db_path=seeded_db)
    assert len(results) == len(KEPT_IDS)
    # Every relevance score should be a pure boost sum (no raw match).
    for r in results:
        assert 0.0 <= r["relevance_score"] <= 0.30  # max boost = 0.20 + 0.10


def test_find_assets_brief_with_no_matching_tags_still_returns_results(seeded_db: Path):
    """Brief with words that match none of the seeded tags should still
    return all kept assets, ranked by boosts only."""
    results = search.find_assets("underwater submarine quantum", max_results=20, db_path=seeded_db)
    assert len(results) == len(KEPT_IDS)
    for r in results:
        assert 0.0 <= r["relevance_score"] <= 0.30


def test_find_assets_max_results_one(seeded_db: Path):
    results = search.find_assets(BEAUTY_BRIEF, max_results=1, db_path=seeded_db)
    assert len(results) == 1
    assert results[0]["rank"] == 1


# ---------- search_with_stats ----------


def test_search_with_stats_filtered_breakdown(seeded_db: Path):
    results, stats = search.search_with_stats(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    assert stats["total_searched"] == len(ROWS)
    assert stats["filtered_out"]["degraded"] == len(DEGRADED_IDS)
    assert stats["filtered_out"]["expired_rights"] == len(EXPIRED_RIGHTS_IDS)
    assert stats["filtered_out"]["low_resolution"] == len(LOW_RES_IDS)
    assert stats["kept"] == len(KEPT_IDS)
    assert stats["returned"] == len(results)


def test_search_with_stats_filter_counts_sum_to_total(seeded_db: Path):
    _, stats = search.search_with_stats(BEAUTY_BRIEF, max_results=20, db_path=seeded_db)
    assert stats["filtered_total"] + stats["kept"] == stats["total_searched"]


def test_search_with_stats_avg_relevance_matches_returned(seeded_db: Path):
    results, stats = search.search_with_stats(BEAUTY_BRIEF, max_results=4, db_path=seeded_db)
    expected = sum(r["relevance_score"] for r in results) / len(results)
    assert stats["avg_relevance"] == pytest.approx(expected)


# ---------- format_results + main ----------


def test_format_results_renders_summary_and_blocks(seeded_db: Path):
    results, stats = search.search_with_stats(BEAUTY_BRIEF, max_results=3, db_path=seeded_db)
    out = search.format_results(BEAUTY_BRIEF, results, stats)
    assert "DAM ASSET SEARCH for:" in out
    assert "Total assets searched:" in out
    assert "Filtered out:" in out
    assert "RANK 1" in out
    assert "Average relevance" in out


def test_main_no_args_returns_nonzero(capsys):
    rc = search.main(["search.py"])
    assert rc != 0
    err = capsys.readouterr().err
    assert "Usage" in err


# ---------- photo backed boost ----------


def _make_images_dir(tmp_path: Path, filenames: list[str]) -> Path:
    """Create a tmp images dir containing zero byte files for each name."""
    images = tmp_path / "images"
    images.mkdir()
    for name in filenames:
        (images / name).write_bytes(b"")
    return images


def test_scan_images_dir_handles_missing(tmp_path: Path):
    assert search._scan_images_dir(tmp_path / "does-not-exist") == frozenset()
    assert search._scan_images_dir(None) == frozenset()


def test_scan_images_dir_returns_filenames(tmp_path: Path):
    images = _make_images_dir(tmp_path, ["a07.jpg", "a14.jpg"])
    out = search._scan_images_dir(images)
    assert out == frozenset({"a07.jpg", "a14.jpg"})


def test_find_assets_includes_has_photo_field(seeded_db: Path):
    """Every returned asset has the has_photo flag."""
    results = search.find_assets(BEAUTY_BRIEF, max_results=5, db_path=seeded_db)
    for r in results:
        assert "has_photo" in r
        assert isinstance(r["has_photo"], bool)


def test_find_assets_no_images_dir_means_no_photo_backed(seeded_db: Path, tmp_path: Path):
    """When images_dir is empty, no asset is photo backed."""
    empty = tmp_path / "empty-images"
    results = search.find_assets(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=empty
    )
    assert all(r["has_photo"] is False for r in results)


def test_find_assets_photo_backed_asset_ranks_first(seeded_db: Path, tmp_path: Path):
    """Asset 7 has the lowest non zero relevance (empty tags, just boosts).
    With a real photo on disk it should still rank above asset 14 which has
    perfect tag match but no photo."""
    images = _make_images_dir(tmp_path, ["a07.jpg"])
    results = search.find_assets(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=images
    )
    assert results[0]["asset_id"] == 7
    assert results[0]["has_photo"] is True
    # Asset 14 (perfect relevance, no photo) is now second.
    assert results[1]["asset_id"] == 14
    assert results[1]["has_photo"] is False


def test_find_assets_multiple_photos_keep_relative_relevance_order(
    seeded_db: Path, tmp_path: Path
):
    """Within the photo backed bucket, relevance still drives the sort.
    Asset 14 (perfect relevance) should beat asset 7 (zero relevance) when
    both are photo backed."""
    images = _make_images_dir(tmp_path, ["a07.jpg", "a14.jpg"])
    results = search.find_assets(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=images
    )
    # Photo backed bucket comes first; ordered by relevance desc within it.
    assert results[0]["asset_id"] == 14
    assert results[1]["asset_id"] == 7
    assert results[0]["has_photo"] is True
    assert results[1]["has_photo"] is True


def test_find_assets_photo_boost_lifts_relevance_score(seeded_db: Path, tmp_path: Path):
    """The boost shows up in relevance_score for photo backed assets."""
    # Two runs against the same fixture: with and without a real photo.
    no_images = tmp_path / "no-images"
    with_image = _make_images_dir(tmp_path, ["a07.jpg"])

    no_photo = search.find_assets(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=no_images
    )
    with_photo = search.find_assets(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=with_image
    )

    no_photo_a7 = next(r for r in no_photo if r["asset_id"] == 7)
    with_photo_a7 = next(r for r in with_photo if r["asset_id"] == 7)

    assert with_photo_a7["relevance_score"] > no_photo_a7["relevance_score"]
    # Difference should be at least the photo boost (or capped at 1.0).
    diff = with_photo_a7["relevance_score"] - no_photo_a7["relevance_score"]
    assert diff == pytest.approx(search.PHOTO_BOOST, abs=1e-3) or with_photo_a7["relevance_score"] == 1.0


def test_find_assets_falls_back_to_non_photo_when_few_photos(
    seeded_db: Path, tmp_path: Path
):
    """Only one photo backed asset on disk; max_results=4 must still return 4
    candidates by falling through to the non photo bucket."""
    images = _make_images_dir(tmp_path, ["a07.jpg"])
    results = search.find_assets(
        BEAUTY_BRIEF, max_results=4, db_path=seeded_db, images_dir=images
    )
    assert len(results) == 4
    photo_count = sum(1 for r in results if r["has_photo"])
    assert photo_count == 1  # the one we put on disk
    assert results[0]["has_photo"] is True
    assert all(r["has_photo"] is False for r in results[1:])


def test_search_with_stats_reports_photo_backed_counts(seeded_db: Path, tmp_path: Path):
    images = _make_images_dir(tmp_path, ["a07.jpg", "a14.jpg"])
    _, stats = search.search_with_stats(
        BEAUTY_BRIEF, max_results=20, db_path=seeded_db, images_dir=images
    )
    assert stats["photo_backed_in_pool"] == 2
    # Both should make it into the kept top.
    assert stats["photo_backed_in_top"] == 2
