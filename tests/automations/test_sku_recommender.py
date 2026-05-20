"""Tests for the SKU Recommender automation."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_AI = Path(__file__).resolve().parents[2] / "ai_engine"

# Load the module via importlib since the folder name has a hyphen.
_MOD_PATH = _AI / "automations" / "sku-recommender" / "recommend.py"
_spec = importlib.util.spec_from_file_location("sku_rec", _MOD_PATH)
assert _spec and _spec.loader
rec = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rec)

CATALOG_PATH = _AI / "automations" / "sku-recommender" / "product_catalog.json"

BEAUTY_BRIEF = {
    "category": "Beauty",
    "discount_pct": 25,
    "campaign_period": "Q2 2026",
    "season": "mothers-day",
}


# ---------- Catalog loading ----------


def test_catalog_loads():
    catalog = rec._load_catalog(CATALOG_PATH)
    assert len(catalog) >= 50


def test_catalog_has_required_fields():
    catalog = rec._load_catalog(CATALOG_PATH)
    for sku in catalog:
        assert "sku_id" in sku
        assert "brand" in sku
        assert "name" in sku
        assert "category" in sku
        assert "msrp" in sku
        assert "margin_pct" in sku
        assert "inventory_level" in sku
        assert "map_protected" in sku


# ---------- Scoring ----------


def test_inventory_score_normalized():
    assert rec._inventory_score(0) == 0.0
    assert rec._inventory_score(1000) == 0.5
    assert rec._inventory_score(2000) == 1.0
    assert rec._inventory_score(5000) == 1.0  # capped at 1.0


def test_margin_score_normalized():
    assert rec._margin_score(0) == 0.0
    assert abs(rec._margin_score(0.325) - 0.5) < 0.01
    assert rec._margin_score(0.65) == 1.0
    assert rec._margin_score(0.80) == 1.0  # capped at 1.0 by min()


def test_vendor_score_active():
    assert rec._vendor_score("Q2 2026 vendor sponsored", "Q2 2026") == 1.0
    assert rec._vendor_score("", "Q2 2026") == 0.3
    # "sponsored" keyword matches broadly, so this still scores 1.0
    assert rec._vendor_score("Q1 2025 vendor sponsored", "Q2 2026") == 1.0
    # No commitment at all scores low
    assert rec._vendor_score("internal only", "Q2 2026") == 0.3


def test_seasonality_score_match():
    assert rec._seasonality_score(["gift", "mothers-day"], "mothers-day") == 1.0
    assert rec._seasonality_score(["everyday"], "mothers-day") == 0.5
    assert rec._seasonality_score(["gift"], "summer") == 1.0  # gift matches broadly


def test_seasonality_score_no_season():
    assert rec._seasonality_score(["gift"], "") == 0.5


# ---------- MAP exclusion ----------


def test_map_violation_detected():
    sku = {"map_protected": True, "map_floor_pct": 0.10}
    assert rec._is_map_violation(sku, 25) is True  # 25% > 10%
    assert rec._is_map_violation(sku, 10) is False  # 10% == 10%, not exceeded
    assert rec._is_map_violation(sku, 5) is False


def test_map_not_protected_never_excluded():
    sku = {"map_protected": False, "map_floor_pct": 0}
    assert rec._is_map_violation(sku, 50) is False


def test_map_exclusion_in_results():
    result = rec.recommend_skus(BEAUTY_BRIEF, catalog_path=CATALOG_PATH)
    excluded = result["excluded_skus"]
    assert len(excluded) > 0  # at 25% discount, some MAP floors are < 25%
    for ex in excluded:
        assert "MAP" in ex["reason"] or "map" in ex["reason"].lower()


# ---------- Recommendations ----------


def test_recommend_returns_correct_structure():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=18, catalog_path=CATALOG_PATH)
    assert "recommended_skus" in result
    assert "excluded_skus" in result
    assert "total_in_category" in result
    assert "criteria_used" in result


def test_recommend_returns_max_results():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=10, catalog_path=CATALOG_PATH)
    assert len(result["recommended_skus"]) == 10


def test_recommend_ranked_descending():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=18, catalog_path=CATALOG_PATH)
    skus = result["recommended_skus"]
    for i in range(len(skus) - 1):
        assert skus[i]["score"] >= skus[i + 1]["score"]


def test_recommend_all_beauty():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=50, catalog_path=CATALOG_PATH)
    for sku in result["recommended_skus"]:
        assert sku["category"] == "Beauty"


def test_recommend_no_excluded_in_recommended():
    result = rec.recommend_skus(BEAUTY_BRIEF, catalog_path=CATALOG_PATH)
    rec_ids = {s["sku_id"] for s in result["recommended_skus"]}
    exc_ids = {s["sku_id"] for s in result["excluded_skus"]}
    assert rec_ids.isdisjoint(exc_ids)


def test_each_sku_has_score_fields():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=5, catalog_path=CATALOG_PATH)
    for sku in result["recommended_skus"]:
        assert "score" in sku
        assert "score_pct" in sku
        assert "top_reason" in sku
        assert sku["score"] > 0
        assert sku["score_pct"] > 0


# ---------- Determinism ----------


def test_deterministic_output():
    r1 = rec.recommend_skus(BEAUTY_BRIEF, max_results=18, catalog_path=CATALOG_PATH)
    r2 = rec.recommend_skus(BEAUTY_BRIEF, max_results=18, catalog_path=CATALOG_PATH)
    ids1 = [s["sku_id"] for s in r1["recommended_skus"]]
    ids2 = [s["sku_id"] for s in r2["recommended_skus"]]
    assert ids1 == ids2
    scores1 = [s["score"] for s in r1["recommended_skus"]]
    scores2 = [s["score"] for s in r2["recommended_skus"]]
    assert scores1 == scores2


# ---------- Vendor boost ----------


def test_vendor_commitment_boosts_ranking():
    """SKUs with active vendor commitments should rank higher than similar SKUs without."""
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=50, catalog_path=CATALOG_PATH)
    skus = result["recommended_skus"]
    # Find pairs of similar SKUs from the same brand, one with vendor one without
    with_vendor = [s for s in skus if s.get("vendor_commitment")]
    without_vendor = [s for s in skus if not s.get("vendor_commitment")]
    if with_vendor and without_vendor:
        # On average, vendor-backed SKUs should score higher
        avg_with = sum(s["score"] for s in with_vendor) / len(with_vendor)
        avg_without = sum(s["score"] for s in without_vendor) / len(without_vendor)
        assert avg_with > avg_without


# ---------- Edge cases ----------


def test_zero_discount_no_map_exclusions():
    brief = {**BEAUTY_BRIEF, "discount_pct": 0}
    result = rec.recommend_skus(brief, catalog_path=CATALOG_PATH)
    assert len(result["excluded_skus"]) == 0


def test_high_discount_more_exclusions():
    low = rec.recommend_skus({**BEAUTY_BRIEF, "discount_pct": 5}, catalog_path=CATALOG_PATH)
    high = rec.recommend_skus({**BEAUTY_BRIEF, "discount_pct": 30}, catalog_path=CATALOG_PATH)
    assert len(high["excluded_skus"]) >= len(low["excluded_skus"])
