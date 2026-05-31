"""SKU Recommender automation for Step 3: SKU Selection.

Reads from macys.db sku_catalog (2,000 SKUs across 5 categories: Beauty,
Apparel, Accessories, Home, Shoes) instead of the legacy product_catalog.json.

Deterministic scoring of SKUs against a campaign brief. Same brief + same
database = same ranked list every time. No LLM needed.

Scoring formula (weights sum to 1.0):
    inventory_score   * 0.25   (higher inventory = less stockout risk)
    margin_score      * 0.25   (higher margin = more profitable)
    vendor_score      * 0.30   (active vendor commitment = co-funded)
    seasonality_score * 0.20   (seasonal tag match = better fit)

MAP exclusion: if a SKU's brand is on the MAP-enforced list and the
campaign discount would breach the MAP floor, the SKU is excluded.
"""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "macys.db"
DEFAULT_MAX_RESULTS = 18

# Scoring weights
W_INVENTORY = 0.25
W_MARGIN = 0.25
W_VENDOR = 0.30
W_SEASONALITY = 0.20

# Normalization ceilings
INVENTORY_CEILING = 2000
MARGIN_CEILING = 0.65

# Vendor commitment score levels
VENDOR_HIGH_SCORE = 1.0
VENDOR_MEDIUM_SCORE = 0.65
VENDOR_LOW_SCORE = 0.3

# Seasonality match vs. mismatch
SEASON_MATCH_SCORE = 1.0
SEASON_MISMATCH_SCORE = 0.5

# ---- MAP-enforced brands (case-insensitive) ----
# Per PRICE-RULES-2026-001. These brands require written Merchandising
# approval for any discount exceeding their MAP floor.
MAP_ENFORCED_BRANDS: set[str] = {
    "lancome",
    "estee lauder",
    "clinique",
    "la mer",
    "dior",          # matches "Dior" and "Dior Beauty"
    "dior beauty",
    "tag heuer",
    "coach",
    "michael kors",
    "kate spade",
    "levi's",
    "levis",         # handle apostrophe-free variant
    "calvin klein",
    "tommy hilfiger",
    "cole haan",
    "polo ralph lauren",
    "ralph lauren",
}

# Default MAP floor: 10% max discount for MAP-protected brands.
DEFAULT_MAP_FLOOR_PCT = 0.10

# ---- Macy's private-label / house brands (HIGH vendor commitment) ----
_HOUSE_BRANDS: set[str] = {
    "alfani", "inc", "inc international concepts", "style & co",
    "hotel collection", "martha stewart", "tasso elba", "bar iii",
    "club room", "charter club", "ideology", "macy's beauty",
    "macy's house",
}

# ---- Category margin defaults ----
# Industry-standard proxies, not actual cost data. In production these
# would be replaced by real margins from the merchandising system.
_CATEGORY_MARGIN: dict[str, float] = {
    "beauty": 0.45,
    "accessories": 0.50,
    "apparel": 0.45,
    "shoes": 0.40,
    "home": 0.38,
}
_MARGIN_VARIANCE = 0.05  # +/- 5 percentage points around category avg


def _is_map_brand(brand: str) -> bool:
    """Case-insensitive check whether a brand is MAP-enforced."""
    lower = brand.lower().strip()
    # Exact match first
    if lower in MAP_ENFORCED_BRANDS:
        return True
    # Prefix match for "Dior ..." variants
    for enforced in MAP_ENFORCED_BRANDS:
        if lower.startswith(enforced) or enforced.startswith(lower):
            return True
    return False


def _derive_margin(sku_id: int, category: str) -> float:
    """Deterministic margin with per-SKU variance.

    Uses a hash of sku_id to produce stable +/- 5pp variance so the same
    SKU always gets the same margin, but different SKUs within a category
    have different margins for realistic scoring differentiation.
    """
    base = _CATEGORY_MARGIN.get(category.lower(), 0.42)
    # Deterministic pseudo-random offset from sku_id hash
    h = int(hashlib.md5(str(sku_id).encode()).hexdigest()[:8], 16)
    offset = ((h % 1000) / 1000.0 - 0.5) * 2 * _MARGIN_VARIANCE
    return round(max(0.10, min(0.65, base + offset)), 4)


def _derive_vendor_commitment(brand: str, supplier: str | None) -> str:
    """Map brand/supplier to a vendor commitment level."""
    lower_brand = brand.lower().strip()
    lower_supplier = (supplier or "").lower().strip()

    # House brands → HIGH
    if lower_brand in _HOUSE_BRANDS or "macy" in lower_brand or "macy" in lower_supplier:
        return "high"
    # MAP-enforced national brands → MEDIUM
    if _is_map_brand(brand):
        return "medium"
    # Known large suppliers → MEDIUM
    if lower_supplier in ("premier apparel co", "global beauty group", "footwear partners llc"):
        return "medium"
    return "low"


def _vendor_score(commitment: str) -> float:
    """Score based on vendor commitment level."""
    level = commitment.lower().strip()
    if level == "high":
        return VENDOR_HIGH_SCORE
    if level == "medium":
        return VENDOR_MEDIUM_SCORE
    return VENDOR_LOW_SCORE


def _load_catalog_from_db(
    category: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict[str, Any]]:
    """Load SKUs from macys.db sku_catalog, filtered by category."""
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        if category:
            rows = conn.execute(
                "SELECT * FROM sku_catalog WHERE category = ?",
                (category,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM sku_catalog").fetchall()

        skus: list[dict[str, Any]] = []
        for row in rows:
            sid = int(row["sku_id"])
            cat = str(row["category"])
            brand = str(row["brand"])
            supplier = row["supplier"]
            margin = _derive_margin(sid, cat)
            commitment = _derive_vendor_commitment(brand, supplier)
            season_val = str(row["season"] or "All")

            skus.append({
                "sku_id": str(sid),
                "name": str(row["product_name"]),
                "brand": brand,
                "category": cat,
                "subcategory": str(row["subcategory"] or ""),
                "msrp": float(row["base_price"]),
                "margin_pct": margin,
                "inventory_level": int(row["inventory_count"] or 0),
                "map_protected": _is_map_brand(brand),
                "map_floor_pct": DEFAULT_MAP_FLOOR_PCT if _is_map_brand(brand) else 0,
                "vendor_commitment": commitment,
                "seasonal_tags": [season_val.lower()]
                    + (["everyday"] if season_val == "All" else []),
            })
        return skus
    finally:
        conn.close()


def _inventory_score(units: int) -> float:
    return min(units / INVENTORY_CEILING, 1.0)


def _margin_score(margin_pct: float) -> float:
    return min(margin_pct / MARGIN_CEILING, 1.0)


def _seasonality_score(seasonal_tags: list[str], campaign_season: str) -> float:
    """Score 1.0 if any seasonal tag matches the campaign season, else 0.5."""
    if not campaign_season:
        return SEASON_MISMATCH_SCORE
    season_lower = campaign_season.lower()
    for tag in seasonal_tags:
        if tag.lower() in season_lower or season_lower in tag.lower():
            return SEASON_MATCH_SCORE
    if "everyday" in [t.lower() for t in seasonal_tags]:
        return SEASON_MATCH_SCORE
    if "gift" in [t.lower() for t in seasonal_tags]:
        return SEASON_MATCH_SCORE
    return SEASON_MISMATCH_SCORE


def _is_map_violation(sku: dict, discount_pct: float) -> bool:
    """Check if applying discount_pct would breach this SKU's MAP floor."""
    if not sku.get("map_protected", False):
        return False
    floor = sku.get("map_floor_pct", 0.0)
    return (discount_pct / 100.0) > floor


def score_sku(
    sku: dict,
    category: str,
    discount_pct: float,
    campaign_season: str,
    segment_top_category: str | None = None,
) -> dict[str, Any]:
    """Score a single SKU. Returns the SKU dict augmented with score fields."""
    # Category filter (already filtered at DB level, but belt-and-suspenders)
    if category and sku.get("category", "").lower() != category.lower():
        return {**sku, "score": -1, "excluded": True, "excluded_reason": "Wrong category"}

    # MAP exclusion
    if _is_map_violation(sku, discount_pct):
        return {
            **sku,
            "score": 0,
            "excluded": True,
            "excluded_reason": (
                f"Would violate MAP at {discount_pct}% discount "
                f"(floor: {sku.get('map_floor_pct', 0) * 100:.0f}%)"
            ),
        }

    inv = _inventory_score(sku.get("inventory_level", 0))
    mar = _margin_score(sku.get("margin_pct", 0))
    ven = _vendor_score(sku.get("vendor_commitment", "low"))
    sea = _seasonality_score(sku.get("seasonal_tags", []), campaign_season)

    # Segment affinity bonus: if the selected segment's top category matches
    # this SKU's subcategory, apply a small lift. This means choosing a
    # different segment (e.g., "VIP Loyalists" whose top category is
    # "Accessories") shifts the ranking even within the same main category.
    # The bonus is additive and capped at 5% of the composite score.
    seg_bonus = 0.0
    if segment_top_category:
        subcat = sku.get("subcategory", "").lower()
        if subcat and segment_top_category.lower() in subcat:
            seg_bonus = 0.05

    composite = inv * W_INVENTORY + mar * W_MARGIN + ven * W_VENDOR + sea * W_SEASONALITY + seg_bonus

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
    db_path: Path | str | None = None,
) -> dict[str, Any]:
    """Recommend SKUs for a campaign based on the brief.

    Args:
        brief: dict with keys category, discount_pct, campaign_period, season.
        max_results: how many top SKUs to return.
        catalog_path: ignored (kept for backward compat). Use db_path.
        db_path: override path to macys.db (for testing).

    Returns:
        Dict with recommended_skus, excluded_skus, and criteria_used.
    """
    category = brief.get("category", "Beauty")
    discount_pct = brief.get("discount_pct", 25)
    campaign_season = brief.get("season", "")
    seg_top_cat = brief.get("segment_top_category")

    effective_db = Path(db_path) if db_path else DEFAULT_DB_PATH
    catalog = _load_catalog_from_db(category, db_path=effective_db)

    scored = [
        score_sku(sku, category, discount_pct, campaign_season, seg_top_cat)
        for sku in catalog
    ]

    eligible = [s for s in scored if not s.get("excluded", False)]
    excluded = [s for s in scored if s.get("excluded", False) and s.get("score", -1) == 0]

    eligible.sort(key=lambda s: (s["score"], s.get("inventory_level", 0)), reverse=True)
    recommended = eligible[:max_results]

    return {
        "recommended_skus": recommended,
        "excluded_skus": [
            {
                "sku_id": s["sku_id"],
                "name": s["name"],
                "brand": s["brand"],
                "reason": s["excluded_reason"],
            }
            for s in excluded
        ],
        "total_in_category": len(eligible) + len(excluded),
        "criteria_used": "Inventory (25%) + Margin (25%) + Vendor commitment (30%) + Seasonality (20%)",
    }
