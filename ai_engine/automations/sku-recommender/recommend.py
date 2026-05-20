"""SKU Recommender automation for Step 3: SKU Selection.

Deterministic scoring of product catalog SKUs against a campaign brief.
Same brief + same catalog = same ranked list every time. No LLM needed.

Scoring formula (weights sum to 1.0):
    inventory_score   * 0.25   (higher inventory = less stockout risk)
    margin_score      * 0.25   (higher margin = more profitable)
    vendor_score      * 0.30   (active vendor commitment = co-funded)
    seasonality_score * 0.20   (seasonal tag match = better fit)

MAP exclusion: if a SKU is MAP-protected and the campaign discount would
breach the MAP floor, the SKU is excluded with score = 0.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parent / "product_catalog.json"
DEFAULT_MAX_RESULTS = 18

# Scoring weights
W_INVENTORY = 0.25
W_MARGIN = 0.25
W_VENDOR = 0.30
W_SEASONALITY = 0.20

# Normalization ceilings
INVENTORY_CEILING = 2000
MARGIN_CEILING = 0.65

# Vendor commitment score if active vs. none
VENDOR_ACTIVE_SCORE = 1.0
VENDOR_NONE_SCORE = 0.3

# Seasonality match vs. mismatch
SEASON_MATCH_SCORE = 1.0
SEASON_MISMATCH_SCORE = 0.5


def _load_catalog(catalog_path: Path | str | None = None) -> list[dict[str, Any]]:
    """Load the product catalog JSON."""
    p = Path(catalog_path) if catalog_path else CATALOG_PATH
    if not p.exists():
        raise FileNotFoundError(f"Product catalog not found at {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def _inventory_score(units: int) -> float:
    return min(units / INVENTORY_CEILING, 1.0)


def _margin_score(margin_pct: float) -> float:
    return min(margin_pct / MARGIN_CEILING, 1.0)


def _vendor_score(commitment: str, campaign_period: str) -> float:
    """Score 1.0 if the vendor commitment covers the campaign period, else 0.3."""
    if not commitment:
        return VENDOR_NONE_SCORE
    # Match any commitment that mentions the campaign quarter/year
    commitment_lower = commitment.lower()
    period_lower = campaign_period.lower()
    # Check for quarter or year overlap
    for token in period_lower.split():
        if token in commitment_lower:
            return VENDOR_ACTIVE_SCORE
    # Also accept generic "active" or "sponsored" commitments
    if "active" in commitment_lower or "sponsored" in commitment_lower:
        return VENDOR_ACTIVE_SCORE
    return VENDOR_NONE_SCORE


def _seasonality_score(seasonal_tags: list[str], campaign_season: str) -> float:
    """Score 1.0 if any seasonal tag matches the campaign season, else 0.5."""
    if not campaign_season:
        return SEASON_MISMATCH_SCORE
    season_lower = campaign_season.lower()
    for tag in seasonal_tags:
        if tag.lower() in season_lower or season_lower in tag.lower():
            return SEASON_MATCH_SCORE
    # "everyday" and "gift" match broad campaigns
    if "gift" in [t.lower() for t in seasonal_tags]:
        return SEASON_MATCH_SCORE
    return SEASON_MISMATCH_SCORE


def _is_map_violation(sku: dict, discount_pct: float) -> bool:
    """Check if applying discount_pct would breach this SKU's MAP floor."""
    if not sku.get("map_protected", False):
        return False
    floor = sku.get("map_floor_pct", 0.0)
    # discount_pct is the percent off (e.g., 25 means 25% off)
    # MAP floor is the max allowed discount (e.g., 0.10 means 10% off max)
    return (discount_pct / 100.0) > floor


def score_sku(
    sku: dict,
    category: str,
    discount_pct: float,
    campaign_period: str,
    campaign_season: str,
) -> dict[str, Any]:
    """Score a single SKU. Returns the SKU dict augmented with score fields."""
    # Category filter
    if category and sku.get("category", "").lower() != category.lower():
        return {**sku, "score": -1, "excluded": True, "excluded_reason": "Wrong category"}

    # MAP exclusion
    if _is_map_violation(sku, discount_pct):
        return {
            **sku,
            "score": 0,
            "excluded": True,
            "excluded_reason": f"Would violate MAP at {discount_pct}% discount (floor: {sku.get('map_floor_pct', 0) * 100:.0f}%)",
        }

    inv = _inventory_score(sku.get("inventory_level", 0))
    mar = _margin_score(sku.get("margin_pct", 0))
    ven = _vendor_score(sku.get("vendor_commitment", ""), campaign_period)
    sea = _seasonality_score(sku.get("seasonal_tags", []), campaign_season)

    composite = inv * W_INVENTORY + mar * W_MARGIN + ven * W_VENDOR + sea * W_SEASONALITY

    # Build the top reason
    scores = [
        (inv * W_INVENTORY, "High inventory availability"),
        (mar * W_MARGIN, "Strong margin"),
        (ven * W_VENDOR, "Active vendor commitment"),
        (sea * W_SEASONALITY, "Good seasonal fit"),
    ]
    scores.sort(key=lambda x: x[0], reverse=True)
    top_reason = scores[0][1]

    return {
        **sku,
        "score": round(composite, 4),
        "score_pct": round(composite * 100, 1),
        "top_reason": top_reason,
        "excluded": False,
        "excluded_reason": None,
        "detail": {
            "inventory": round(inv, 3),
            "margin": round(mar, 3),
            "vendor": round(ven, 3),
            "seasonality": round(sea, 3),
        },
    }


def recommend_skus(
    brief: dict[str, Any],
    max_results: int = DEFAULT_MAX_RESULTS,
    catalog_path: Path | str | None = None,
) -> dict[str, Any]:
    """Recommend SKUs for a campaign based on the brief.

    Args:
        brief: dict with keys category, discount_pct, campaign_period, season.
        max_results: how many top SKUs to return.
        catalog_path: override for testing.

    Returns:
        Dict with recommended_skus, excluded_skus, and criteria_used.
    """
    catalog = _load_catalog(catalog_path)
    category = brief.get("category", "Beauty")
    discount_pct = brief.get("discount_pct", 25)
    campaign_period = brief.get("campaign_period", "Q2 2026")
    campaign_season = brief.get("season", "")

    scored = [score_sku(sku, category, discount_pct, campaign_period, campaign_season) for sku in catalog]

    # Split into recommended (score > 0) and excluded
    eligible = [s for s in scored if not s.get("excluded", False)]
    excluded = [s for s in scored if s.get("excluded", False) and s.get("score", -1) == 0]

    # Sort by score descending, tie-break by inventory descending
    eligible.sort(key=lambda s: (s["score"], s.get("inventory_level", 0)), reverse=True)

    recommended = eligible[:max_results]

    return {
        "recommended_skus": recommended,
        "excluded_skus": [
            {"sku_id": s["sku_id"], "name": s["name"], "brand": s["brand"], "reason": s["excluded_reason"]}
            for s in excluded
        ],
        "total_in_category": len(eligible) + len(excluded),
        "criteria_used": "Inventory (25%) + Margin (25%) + Vendor commitment (30%) + Seasonality (20%)",
    }
