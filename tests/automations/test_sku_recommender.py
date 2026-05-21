"""Tests for the SKU Recommender automation.

The recommender now reads from macys.db sku_catalog (2,000 SKUs across
5 categories) instead of the deprecated product_catalog.json.
"""

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

BEAUTY_BRIEF = {
    "category": "Beauty",
    "discount_pct": 25,
    "campaign_period": "Q2 2026",
    "season": "mothers-day",
}


# ---------- Database loading ----------


def test_db_loads_beauty():
    catalog = rec._load_catalog_from_db("Beauty")
    assert len(catalog) >= 300  # macys.db has 377 Beauty SKUs


def test_db_loads_all_categories():
    for cat in ["Beauty", "Apparel", "Accessories", "Home", "Shoes"]:
        catalog = rec._load_catalog_from_db(cat)
        assert len(catalog) >= 100, f"{cat} should have 100+ SKUs, got {len(catalog)}"


def test_db_skus_have_required_fields():
    catalog = rec._load_catalog_from_db("Beauty")
    for sku in catalog[:10]:
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


def test_vendor_score_levels():
    assert rec._vendor_score("high") == rec.VENDOR_HIGH_SCORE
    assert rec._vendor_score("medium") == rec.VENDOR_MEDIUM_SCORE
    assert rec._vendor_score("low") == rec.VENDOR_LOW_SCORE


def test_seasonality_score_match():
    assert rec._seasonality_score(["spring", "mothers-day"], "mothers-day") == 1.0
    assert rec._seasonality_score(["winter"], "mothers-day") == 0.5
    assert rec._seasonality_score(["everyday"], "summer") == 1.0


def test_seasonality_score_no_season():
    assert rec._seasonality_score(["spring"], "") == 0.5


# ---------- MAP brand detection ----------


def test_map_brand_detection():
    assert rec._is_map_brand("Coach") is True
    assert rec._is_map_brand("coach") is True
    assert rec._is_map_brand("Lancome") is True
    assert rec._is_map_brand("Dior") is True
    assert rec._is_map_brand("Dior Beauty") is True
    assert rec._is_map_brand("Kate Spade") is True
    assert rec._is_map_brand("Calvin Klein") is True
    assert rec._is_map_brand("Levi's") is True
    assert rec._is_map_brand("Fossil") is False
    assert rec._is_map_brand("Adidas") is False


def test_map_violation_detected():
    sku = {"map_protected": True, "map_floor_pct": 0.10}
    assert rec._is_map_violation(sku, 25) is True  # 25% > 10%
    assert rec._is_map_violation(sku, 10) is False  # 10% == 10%, not exceeded
    assert rec._is_map_violation(sku, 5) is False


def test_map_not_protected_never_excluded():
    sku = {"map_protected": False, "map_floor_pct": 0}
    assert rec._is_map_violation(sku, 50) is False


def test_map_exclusion_in_results():
    result = rec.recommend_skus(BEAUTY_BRIEF)
    excluded = result["excluded_skus"]
    assert len(excluded) > 0  # at 25% discount, MAP brands are excluded
    for ex in excluded:
        assert "MAP" in ex["reason"] or "map" in ex["reason"].lower()


# ---------- Recommendations ----------


def test_recommend_returns_correct_structure():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=18)
    assert "recommended_skus" in result
    assert "excluded_skus" in result
    assert "total_in_category" in result
    assert "criteria_used" in result


def test_recommend_returns_max_results():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=10)
    assert len(result["recommended_skus"]) == 10


def test_recommend_ranked_descending():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=18)
    skus = result["recommended_skus"]
    for i in range(len(skus) - 1):
        assert skus[i]["score"] >= skus[i + 1]["score"]


def test_recommend_all_beauty():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=50)
    for sku in result["recommended_skus"]:
        assert sku["category"] == "Beauty"


def test_recommend_accessories():
    brief = {**BEAUTY_BRIEF, "category": "Accessories"}
    result = rec.recommend_skus(brief, max_results=18)
    assert len(result["recommended_skus"]) == 18
    for sku in result["recommended_skus"]:
        assert sku["category"] == "Accessories"


def test_recommend_no_excluded_in_recommended():
    result = rec.recommend_skus(BEAUTY_BRIEF)
    rec_ids = {s["sku_id"] for s in result["recommended_skus"]}
    exc_ids = {s["sku_id"] for s in result["excluded_skus"]}
    assert rec_ids.isdisjoint(exc_ids)


def test_each_sku_has_score_fields():
    result = rec.recommend_skus(BEAUTY_BRIEF, max_results=5)
    for sku in result["recommended_skus"]:
        assert "score" in sku
        assert "score_pct" in sku
        assert "top_reason" in sku
        assert sku["score"] > 0
        assert sku["score_pct"] > 0


# ---------- Determinism ----------


def test_deterministic_output():
    r1 = rec.recommend_skus(BEAUTY_BRIEF, max_results=18)
    r2 = rec.recommend_skus(BEAUTY_BRIEF, max_results=18)
    ids1 = [s["sku_id"] for s in r1["recommended_skus"]]
    ids2 = [s["sku_id"] for s in r2["recommended_skus"]]
    assert ids1 == ids2
    scores1 = [s["score"] for s in r1["recommended_skus"]]
    scores2 = [s["score"] for s in r2["recommended_skus"]]
    assert scores1 == scores2


# ---------- Margin variance ----------


def test_margin_varies_within_category():
    """Different SKUs in same category should have different margins."""
    catalog = rec._load_catalog_from_db("Beauty")
    margins = set(s["margin_pct"] for s in catalog[:20])
    assert len(margins) > 1, "All margins are identical — variance not working"


# ---------- Edge cases ----------


def test_zero_discount_no_map_exclusions():
    brief = {**BEAUTY_BRIEF, "discount_pct": 0}
    result = rec.recommend_skus(brief)
    assert len(result["excluded_skus"]) == 0


def test_high_discount_more_exclusions():
    low = rec.recommend_skus({**BEAUTY_BRIEF, "discount_pct": 5})
    high = rec.recommend_skus({**BEAUTY_BRIEF, "discount_pct": 30})
    assert len(high["excluded_skus"]) >= len(low["excluded_skus"])
