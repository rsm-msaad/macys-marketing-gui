"""Localization Generator skill.

Produces all 40 regional/placement variants (10 US regions x 4 placements) for
one or more master SKUs after a campaign master ad is approved. Maps to
workflow step 7 (Localization), the fully automated step.

Usage:
    uv run python skills/localization-generator/generate.py "Mother's Day Beauty Event"
    uv run python skills/localization-generator/generate.py "Mother's Day Beauty Event" --skus 1,2

If `--skus` is omitted the script picks two Beauty SKUs from `sku_catalog` so
the demo runs without args.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "macys.db"

# All 10 US regions present in regional_pricing.
DEFAULT_REGIONS = [
    "Northeast",
    "Mid-Atlantic",
    "Southeast",
    "Midwest-North",
    "Midwest-South",
    "South",
    "Southwest",
    "Mountain",
    "Pacific-Northwest",
    "Pacific-Southwest",
]

# Default placement set (4) × 10 regions = 40 variants per SKU.
DEFAULT_PLACEMENTS = ["web_banner", "email", "in_store_signage", "mobile"]

PLACEMENT_DIMENSIONS = {
    "web_banner": "1200x628",
    "email": "600x800",
    "in_store_signage": "1080x1920",
    "mobile": "1080x1920",
}

# Regional voice. Each entry is a small bag of phrases that the placement
# templates draw from. Keep the strings short enough that the longest
# placement headline (email) stays inside the 12 to 15 word target.
REGIONAL_CONTEXT: dict[str, dict[str, str]] = {
    "Northeast": {
        "weather": "spring blooms",
        "lifestyle": "weekend treat",
        "shopping": "weekend treat moments",
    },
    "Mid-Atlantic": {
        "weather": "city evenings",
        "lifestyle": "city sophistication",
        "shopping": "city polish",
    },
    "Southeast": {
        "weather": "porch-side sunshine",
        "lifestyle": "porch-side moments",
        "shopping": "easy southern style",
    },
    "Midwest-North": {
        "weather": "crisp mornings",
        "lifestyle": "neighborly gatherings",
        "shopping": "honest value",
    },
    "Midwest-South": {
        "weather": "warm afternoons",
        "lifestyle": "family weekends",
        "shopping": "everyday essentials",
    },
    "South": {
        "weather": "sun-drenched days",
        "lifestyle": "everyday luxury",
        "shopping": "classic Southern hospitality",
    },
    "Southwest": {
        "weather": "warm desert evenings",
        "lifestyle": "desert chic",
        "shopping": "desert-ready style",
    },
    "Mountain": {
        "weather": "alpine mornings",
        "lifestyle": "fresh-air rituals",
        "shopping": "mountain-ready basics",
    },
    "Pacific-Northwest": {
        "weather": "rainy day glow",
        "lifestyle": "rainy day self-care",
        "shopping": "indoor day picks",
    },
    "Pacific-Southwest": {
        "weather": "coastal sunshine",
        "lifestyle": "beach-day brightness",
        "shopping": "sunny everyday looks",
    },
}

# Per-category tone of voice. These short phrases plug into the placement
# templates so a Beauty SKU and an Apparel SKU read differently.
CATEGORY_VOICE: dict[str, dict[str, str]] = {
    "Apparel": {"hook": "fresh looks", "noun": "wardrobe pick", "verb": "refresh"},
    "Beauty": {"hook": "bold lips", "noun": "favorite shade", "verb": "discover"},
    "Home": {"hook": "cozy spaces", "noun": "home essentials", "verb": "refresh"},
    "Accessories": {"hook": "perfect finishes", "noun": "go-to accessory", "verb": "complete"},
    "Shoes": {"hook": "step-out style", "noun": "next pair", "verb": "step into"},
}
DEFAULT_VOICE = {"hook": "standout picks", "noun": "next favorite", "verb": "shop"}

# Inventory thresholds.
LOW_STOCK_MAX = 50  # 1..50 → low_stock; >50 → in_stock; 0 → out_of_stock.

# Regional unit count is sampled deterministically since the schema only
# stores a boolean `in_stock_locally`, not a per-region unit count.
SYNTHETIC_UNITS_RANGE = 200

# Pricing thresholds.
PRICE_FLAG_PCT = 0.15


# ---------- DB ----------


def connect_db(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    return sqlite3.connect(str(db_path))


def _load_skus(conn: sqlite3.Connection, sku_ids: list[int]) -> dict[int, dict]:
    if not sku_ids:
        return {}
    placeholders = ",".join("?" * len(sku_ids))
    rows = conn.execute(
        f"""
        SELECT sku_id, product_name, category, base_price, inventory_count
        FROM sku_catalog
        WHERE sku_id IN ({placeholders})
        """,
        tuple(int(s) for s in sku_ids),
    ).fetchall()
    return {
        int(r[0]): {
            "sku_id": int(r[0]),
            "product_name": r[1],
            "category": r[2],
            "base_price": float(r[3]),
            "master_inventory": int(r[4] or 0),
        }
        for r in rows
    }


def _load_regional_pricing(
    conn: sqlite3.Connection, sku_ids: list[int]
) -> dict[tuple[int, str], dict]:
    if not sku_ids:
        return {}
    placeholders = ",".join("?" * len(sku_ids))
    rows = conn.execute(
        f"""
        SELECT sku_id, region, regional_price, in_stock_locally
        FROM regional_pricing
        WHERE sku_id IN ({placeholders})
        """,
        tuple(int(s) for s in sku_ids),
    ).fetchall()
    return {
        (int(r[0]), str(r[1])): {
            "regional_price": float(r[2]),
            "in_stock_locally": int(r[3]),
        }
        for r in rows
    }


def _pick_default_skus(conn: sqlite3.Connection, n: int = 2) -> list[int]:
    rows = conn.execute(
        "SELECT sku_id FROM sku_catalog WHERE category = 'Beauty' "
        "ORDER BY sku_id LIMIT ?",
        (n,),
    ).fetchall()
    if len(rows) < n:
        more = conn.execute(
            "SELECT sku_id FROM sku_catalog ORDER BY sku_id LIMIT ?",
            (n,),
        ).fetchall()
        return [int(r[0]) for r in more[:n]]
    return [int(r[0]) for r in rows]


# ---------- pure helpers ----------


def _slugify_region(region: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", region.lower()).strip("_")


def _slugify_filename(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _regional_units(region: str, sku_id: int, in_stock_locally: int) -> int:
    """Deterministic per-(region, sku) unit count.

    Returns 0 when the region has the SKU out of stock. Otherwise returns a
    stable integer in [0, SYNTHETIC_UNITS_RANGE) keyed off the (region, sku)
    pair. Same inputs always give the same number.
    """
    if not in_stock_locally:
        return 0
    h = hashlib.md5(f"{region}|{sku_id}".encode()).hexdigest()
    return int(h[:8], 16) % SYNTHETIC_UNITS_RANGE


def _inventory_status(units: int) -> str:
    if units <= 0:
        return "out_of_stock"
    if units <= LOW_STOCK_MAX:
        return "low_stock"
    return "in_stock"


def _price_diff_pct(regional_price: float, master_price: float) -> float:
    if master_price <= 0:
        return 0.0
    return (regional_price - master_price) / master_price


def _price_flag(diff_pct: float) -> str | None:
    if abs(diff_pct) <= PRICE_FLAG_PCT:
        return None
    return "significantly_higher" if diff_pct > 0 else "significantly_lower"


def _master_image_reference(sku_id: int, product_name: str) -> str:
    slug = _slugify_filename(product_name or f"sku-{sku_id}")
    return f"{slug}_{sku_id:05d}_master.jpg"


# ---------- copy generation ----------


def _make_copy(
    region: str,
    placement: str,
    brief: str,
    category: str,
) -> dict[str, str]:
    """Deterministic, regional + category aware copy for one (region, placement)."""
    ctx = REGIONAL_CONTEXT.get(region, {"weather": "everyday picks", "lifestyle": "everyday looks"})
    voice = CATEGORY_VOICE.get(category, DEFAULT_VOICE)

    weather = ctx["weather"]
    lifestyle = ctx["lifestyle"]
    hook = voice["hook"]
    noun = voice["noun"]
    brief_clean = brief.strip()

    if placement == "web_banner":
        # Max 8 words. Headline is short and punchy.
        return {
            "headline": f"{weather.title()}, {hook.title()}",
            "subhead": f"Shop {brief_clean}",
            "cta": f"Shop {brief_clean}",
        }
    if placement == "email":
        # 12 to 15 words. Conversational.
        return {
            "headline": f"{lifestyle.title()} call for {noun}",
            "subhead": (
                f"From {weather} to standout {noun}, this is {brief_clean}. "
                f"Free shipping on {category} orders over $50."
            ),
            "cta": f"Shop {brief_clean} now",
        }
    if placement == "in_store_signage":
        # Max 5 words. Action-oriented.
        return {
            "headline": f"{hook.title()}.",
            "subhead": f"{brief_clean}.",
            "cta": "Shop now.",
        }
    if placement == "mobile":
        # Max 10 words. Swipe friendly.
        return {
            "headline": f"{weather.title()}: {hook}",
            "subhead": f"Your {brief_clean} pick, picked locally.",
            "cta": f"Shop {brief_clean}",
        }
    return {
        "headline": f"{hook.title()}",
        "subhead": brief_clean,
        "cta": f"Shop {brief_clean}",
    }


# ---------- variant assembly ----------


def _make_variant_id(region: str, placement: str, sku_id: int) -> str:
    return f"V-{_slugify_region(region)}-{placement}-{sku_id:05d}"


def _build_variant(
    sku: dict,
    region: str,
    placement: str,
    brief: str,
    pricing_row: dict | None,
    now_iso: str,
) -> dict:
    sku_id = sku["sku_id"]
    master_price = sku["base_price"]
    category = sku["category"]

    if pricing_row is None:
        regional_price = master_price
        in_stock_locally = 0
        price_flag: str | None = "no_regional_data"
    else:
        regional_price = pricing_row["regional_price"]
        in_stock_locally = pricing_row["in_stock_locally"]
        diff_pct = _price_diff_pct(regional_price, master_price)
        price_flag = _price_flag(diff_pct)

    diff_pct = _price_diff_pct(regional_price, master_price)
    units = _regional_units(region, sku_id, in_stock_locally)
    status = _inventory_status(units)

    copy = _make_copy(region, placement, brief, category)

    variant: dict = {
        "variant_id": _make_variant_id(region, placement, sku_id),
        "region": region,
        "placement": placement,
        "sku_id": sku_id,
        "sku_name": sku["product_name"],
        "regional_price": round(regional_price, 2),
        "master_price": round(master_price, 2),
        "price_difference_pct": round(diff_pct, 4),
        "inventory_status": status,
        "inventory_units": units,
        "copy_headline": copy["headline"],
        "copy_subhead": copy["subhead"],
        "cta_text": copy["cta"],
        "placement_dimensions": PLACEMENT_DIMENSIONS.get(placement, "auto"),
        "master_image_reference": _master_image_reference(sku_id, sku["product_name"]),
        "generated_at": now_iso,
    }
    if price_flag is not None:
        variant["price_flag"] = price_flag
    return variant


def generate_variants(
    campaign_brief: str,
    master_sku_ids: list,
    regions: list[str] | None = None,
    placements: list[str] | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict]:
    """Generate one variant per (region, placement, sku) combination."""
    variants, _ = generate_variants_with_stats(
        campaign_brief, master_sku_ids, regions, placements, db_path
    )
    return variants


def generate_variants_with_stats(
    campaign_brief: str,
    master_sku_ids: list,
    regions: list[str] | None = None,
    placements: list[str] | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> tuple[list[dict], dict]:
    """As above but also returns an analytics summary dict."""
    regions = list(regions) if regions is not None else list(DEFAULT_REGIONS)
    placements = list(placements) if placements is not None else list(DEFAULT_PLACEMENTS)
    sku_ids = [int(s) for s in master_sku_ids]
    now_iso = datetime.now(timezone.utc).isoformat()

    if not sku_ids:
        empty_stats = _empty_stats(regions, placements)
        return [], empty_stats

    conn = connect_db(db_path)
    try:
        skus = _load_skus(conn, sku_ids)
        pricing = _load_regional_pricing(conn, sku_ids)
    finally:
        conn.close()

    variants: list[dict] = []
    for sku_id in sku_ids:
        sku = skus.get(int(sku_id))
        if sku is None:
            continue
        for region in regions:
            pricing_row = pricing.get((sku["sku_id"], region))
            for placement in placements:
                variants.append(
                    _build_variant(sku, region, placement, campaign_brief, pricing_row, now_iso)
                )

    stats = _summarize(variants, regions, placements, sku_ids, skus)
    return variants, stats


def _empty_stats(regions: list[str], placements: list[str]) -> dict:
    return {
        "total_variants": 0,
        "regions": len(regions),
        "placements": len(placements),
        "skus": 0,
        "by_region": {},
        "by_placement": {},
        "inventory_alerts": [],
        "price_alerts": [],
        "avg_price_diff_pct": 0.0,
    }


def _summarize(
    variants: list[dict],
    regions: list[str],
    placements: list[str],
    requested_sku_ids: list[int],
    skus_loaded: dict[int, dict],
) -> dict:
    by_region: dict[str, int] = {}
    by_placement: dict[str, int] = {}
    inventory_alerts: list[dict] = []
    price_alerts: list[dict] = []
    diff_total = 0.0
    diff_n = 0

    seen_inventory: set[tuple[int, str]] = set()
    seen_price: set[tuple[int, str]] = set()

    for v in variants:
        by_region[v["region"]] = by_region.get(v["region"], 0) + 1
        by_placement[v["placement"]] = by_placement.get(v["placement"], 0) + 1
        diff_total += abs(v["price_difference_pct"])
        diff_n += 1

        inv_key = (v["sku_id"], v["region"])
        if v["inventory_status"] != "in_stock" and inv_key not in seen_inventory:
            seen_inventory.add(inv_key)
            inventory_alerts.append(
                {
                    "sku_id": v["sku_id"],
                    "sku_name": v["sku_name"],
                    "region": v["region"],
                    "status": v["inventory_status"],
                    "units": v["inventory_units"],
                }
            )

        price_key = (v["sku_id"], v["region"])
        if "price_flag" in v and v["price_flag"] != "no_regional_data" and price_key not in seen_price:
            seen_price.add(price_key)
            price_alerts.append(
                {
                    "sku_id": v["sku_id"],
                    "sku_name": v["sku_name"],
                    "region": v["region"],
                    "regional_price": v["regional_price"],
                    "master_price": v["master_price"],
                    "pct_diff": v["price_difference_pct"],
                }
            )

    avg_diff = diff_total / diff_n if diff_n else 0.0

    return {
        "total_variants": len(variants),
        "regions": len(regions),
        "placements": len(placements),
        "skus": len([s for s in requested_sku_ids if int(s) in skus_loaded]),
        "by_region": by_region,
        "by_placement": by_placement,
        "inventory_alerts": inventory_alerts,
        "price_alerts": price_alerts,
        "avg_price_diff_pct": round(avg_diff, 4),
    }


# ---------- formatter ----------


def _fmt_int(n: int) -> str:
    return f"{n:,}"


def _fmt_pct(x: float) -> str:
    return f"{x * 100:+.0f}%"


def format_results(
    brief: str,
    sku_ids: list[int],
    sku_names: dict[int, str],
    variants: list[dict],
    stats: dict,
    sample_size: int = 3,
) -> str:
    bar = "=" * 60
    lines = [bar, f'LOCALIZATION VARIANTS for: "{brief}"']

    sku_label = ", ".join(
        f"{sku_names.get(int(s), '?')} (sku_id={s})" for s in sku_ids
    )
    lines.append(f"Master SKUs: {sku_label}")
    lines.append(bar)
    lines.append("")

    lines.append(f"Total variants generated: {_fmt_int(stats['total_variants'])}")
    lines.append(f"Regions: {stats['regions']}")
    lines.append(f"Placements: {stats['placements']}")
    lines.append(f"SKUs: {stats['skus']}")
    lines.append("")

    inv = stats["inventory_alerts"]
    lines.append(
        f"Inventory alerts: {_fmt_int(len(inv))} region/SKU combinations "
        f"with low or no stock"
    )
    for a in inv[:10]:
        units_str = "" if a["status"] == "out_of_stock" else f" ({a['units']} units)"
        lines.append(f"  - sku_id {a['sku_id']} in {a['region']}: {a['status']}{units_str}")
    if len(inv) > 10:
        lines.append(f"  ...and {len(inv) - 10} more")
    lines.append("")

    pa = stats["price_alerts"]
    lines.append(
        f"Price variation alerts: {_fmt_int(len(pa))} region/SKU pairs "
        f"with regional pricing >15% from master"
    )
    for a in pa[:10]:
        lines.append(
            f"  - sku_id {a['sku_id']} in {a['region']}: "
            f"${a['regional_price']:.2f} ({_fmt_pct(a['pct_diff'])} vs master "
            f"${a['master_price']:.2f})"
        )
    lines.append("")

    lines.append(f"Average regional price difference: {stats['avg_price_diff_pct'] * 100:.1f}%")
    lines.append("")

    if variants:
        sample = variants[:sample_size]
        lines.append(
            f"Sample of generated variants ({len(sample)} of {len(variants)} shown):"
        )
        lines.append("")
        for v in sample:
            lines.append(f"VARIANT {v['variant_id']}")
            lines.append(f"Region:         {v['region']}")
            lines.append(
                f"Placement:      {v['placement']} ({v['placement_dimensions']})"
            )
            lines.append(f"SKU:            sku_id {v['sku_id']} ({v['sku_name']})")
            price_line = (
                f"Price:          ${v['regional_price']:.2f} "
                f"(master: ${v['master_price']:.2f}, "
                f"{_fmt_pct(v['price_difference_pct'])})"
            )
            lines.append(price_line)
            inv_line = (
                f"Inventory:      {v['inventory_status']} "
                + (f"({v['inventory_units']} units)" if v["inventory_units"] else "")
            )
            lines.append(inv_line)
            lines.append(f"Headline:       {v['copy_headline']}")
            lines.append(f"Subhead:        {v['copy_subhead']}")
            lines.append(f"CTA:            {v['cta_text']}")
            lines.append(f"Image:          {v['master_image_reference']}")
            lines.append("")
        if len(variants) > sample_size:
            lines.append(
                f"({len(variants) - sample_size} more variants generated, "
                "full list available via the function return)"
            )
    lines.append(bar)
    return "\n".join(lines)


# ---------- main ----------


def _parse_skus(arg: str | None) -> list[int] | None:
    if not arg:
        return None
    parts = [p.strip() for p in arg.split(",") if p.strip()]
    out: list[int] = []
    for p in parts:
        try:
            out.append(int(p))
        except ValueError as e:
            raise ValueError(f"--skus expects comma separated integers, got {p!r}") from e
    return out


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Generate regional/placement variants for a campaign.")
    parser.add_argument("brief", help='Campaign brief, e.g. "Mother\'s Day Beauty Event"')
    parser.add_argument("--skus", help="Comma separated SKU IDs (integers). Defaults to two Beauty SKUs.")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to macys.db")
    args = parser.parse_args(argv[1:])

    db_path = Path(args.db)
    sku_ids = _parse_skus(args.skus)
    if sku_ids is None:
        conn = connect_db(db_path)
        try:
            sku_ids = _pick_default_skus(conn, 2)
        finally:
            conn.close()

    variants, stats = generate_variants_with_stats(
        args.brief, sku_ids, db_path=db_path
    )

    conn = connect_db(db_path)
    try:
        sku_names = {
            int(r[0]): r[1]
            for r in conn.execute(
                f"SELECT sku_id, product_name FROM sku_catalog WHERE sku_id IN ({','.join('?' * len(sku_ids))})",
                tuple(sku_ids),
            ).fetchall()
        }
    finally:
        conn.close()

    print(format_results(args.brief, sku_ids, sku_names, variants, stats))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
