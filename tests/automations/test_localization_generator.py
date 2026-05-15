"""Tests for `ai_engine/automations/localization-generator-v1/generate.py`."""

from __future__ import annotations

import importlib.util
import sqlite3
from pathlib import Path

import pytest

_MODULE_PATH = (
    Path(__file__).resolve().parents[2] / "ai_engine" / "automations" / "localization-generator-v1" / "generate.py"
)
_spec = importlib.util.spec_from_file_location("loc_generate", _MODULE_PATH)
assert _spec and _spec.loader
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


SCHEMA_SQL = """
CREATE TABLE sku_catalog (
    sku_id          INTEGER PRIMARY KEY,
    product_name    TEXT,
    category        TEXT,
    subcategory     TEXT,
    brand           TEXT,
    base_price      REAL,
    season          TEXT,
    inventory_count INTEGER,
    supplier        TEXT
);
CREATE TABLE regional_pricing (
    sku_id           INTEGER,
    region           TEXT,
    regional_price   REAL,
    in_stock_locally INTEGER,
    PRIMARY KEY (sku_id, region)
);
"""

SKUS = [
    # (sku_id, product_name, category, subcat, brand, base_price, season, inv, supplier)
    (1, "Mac Red Lipstick", "Beauty", "Makeup", "MAC", 20.00, "Spring", 1000, "X"),
    (2, "INC Spring Dress", "Apparel", "Dresses", "INC", 80.00, "Spring", 500, "X"),
    (3, "Charter Club Bedding", "Home", "Bedding", "Charter Club", 120.00, "Spring", 200, "X"),
]

# Engineered pricing rows. sku=2 in Mountain is omitted to test "no regional data".
PRICING = [
    # (sku_id, region, regional_price, in_stock_locally)
    (1, "Northeast", 22.00, 1),  # +10% no flag
    (1, "Pacific-Northwest", 24.00, 1),  # +20% significantly_higher
    (1, "Mountain", 15.00, 1),  # -25% significantly_lower
    (2, "Northeast", 80.00, 1),  # 0% no flag
    (2, "Pacific-Northwest", 85.00, 0),  # in_stock_locally=0 -> out_of_stock
    # NO row for (2, Mountain) -> no_regional_data
    (3, "Northeast", 120.00, 1),
    (3, "Pacific-Northwest", 130.00, 1),
    (3, "Mountain", 125.00, 1),
]

REGIONS = ["Northeast", "Pacific-Northwest", "Mountain"]


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "loc_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    conn.executemany(
        "INSERT INTO sku_catalog VALUES (?,?,?,?,?,?,?,?,?)",
        SKUS,
    )
    conn.executemany(
        "INSERT INTO regional_pricing VALUES (?,?,?,?)",
        PRICING,
    )
    conn.commit()
    conn.close()
    return db_path


# ---------- DB / connect ----------


def test_connect_db_missing_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        gen.connect_db(tmp_path / "nope.db")


def test_generate_variants_missing_db_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        gen.generate_variants("brief", [1], db_path=tmp_path / "missing.db")


# ---------- pure helpers ----------


def test_slugify_region_replaces_hyphens_and_lowercases():
    assert gen._slugify_region("Pacific-Northwest") == "pacific_northwest"
    assert gen._slugify_region("Northeast") == "northeast"
    assert gen._slugify_region("Mid-Atlantic") == "mid_atlantic"


def test_make_variant_id_format():
    vid = gen._make_variant_id("Pacific-Northwest", "web_banner", 42)
    assert vid == "V-pacific_northwest-web_banner-00042"


def test_inventory_status_thresholds():
    assert gen._inventory_status(0) == "out_of_stock"
    assert gen._inventory_status(1) == "low_stock"
    assert gen._inventory_status(50) == "low_stock"
    assert gen._inventory_status(51) == "in_stock"
    assert gen._inventory_status(1000) == "in_stock"


def test_regional_units_zero_when_locally_out_of_stock():
    assert gen._regional_units("Northeast", 1, 0) == 0
    assert gen._regional_units("Mountain", 99, 0) == 0


def test_regional_units_is_deterministic_and_in_range():
    a = gen._regional_units("Northeast", 1, 1)
    b = gen._regional_units("Northeast", 1, 1)
    assert a == b
    assert 0 <= a < gen.SYNTHETIC_UNITS_RANGE


def test_regional_units_known_values_match_fixture():
    """Sanity check the engineered fixture values match the function's output."""
    assert gen._regional_units("Northeast", 1, 1) == 181
    assert gen._regional_units("Pacific-Northwest", 1, 1) == 38
    assert gen._regional_units("Mountain", 1, 1) == 119


def test_price_diff_pct_signed():
    assert gen._price_diff_pct(22.0, 20.0) == pytest.approx(0.10)
    assert gen._price_diff_pct(15.0, 20.0) == pytest.approx(-0.25)
    assert gen._price_diff_pct(0.0, 20.0) == pytest.approx(-1.0)
    assert gen._price_diff_pct(20.0, 0.0) == 0.0  # safe div


def test_price_flag_thresholds():
    assert gen._price_flag(0.10) is None
    assert gen._price_flag(-0.10) is None
    assert gen._price_flag(0.15) is None
    assert gen._price_flag(0.16) == "significantly_higher"
    assert gen._price_flag(-0.16) == "significantly_lower"


def test_master_image_reference_uses_product_name():
    out = gen._master_image_reference(42, "Mac Red Lipstick")
    assert out.endswith("_00042_master.jpg")
    assert "mac_red_lipstick" in out


# ---------- copy generation ----------


def test_make_copy_web_banner_max_eight_words():
    c = gen._make_copy("Northeast", "web_banner", "Mother's Day Beauty Event", "Beauty")
    assert len(c["headline"].split()) <= 8


def test_make_copy_in_store_signage_max_five_words():
    c = gen._make_copy("Northeast", "in_store_signage", "Mother's Day Beauty Event", "Beauty")
    assert len(c["headline"].split()) <= 5


def test_make_copy_mobile_max_ten_words():
    c = gen._make_copy("Northeast", "mobile", "Mother's Day Beauty Event", "Beauty")
    assert len(c["headline"].split()) <= 10


def test_make_copy_email_subhead_is_longer_than_web_banner_subhead():
    web = gen._make_copy("Northeast", "web_banner", "MD Beauty", "Beauty")
    email = gen._make_copy("Northeast", "email", "MD Beauty", "Beauty")
    assert len(email["subhead"]) > len(web["subhead"])


def test_make_copy_varies_by_region():
    ne = gen._make_copy("Northeast", "web_banner", "MD Beauty", "Beauty")
    pnw = gen._make_copy("Pacific-Northwest", "web_banner", "MD Beauty", "Beauty")
    assert ne["headline"] != pnw["headline"]


def test_make_copy_varies_by_placement():
    web = gen._make_copy("Northeast", "web_banner", "MD Beauty", "Beauty")
    email = gen._make_copy("Northeast", "email", "MD Beauty", "Beauty")
    sign = gen._make_copy("Northeast", "in_store_signage", "MD Beauty", "Beauty")
    assert web["headline"] != email["headline"]
    assert web["headline"] != sign["headline"]
    assert email["headline"] != sign["headline"]


def test_make_copy_varies_by_category():
    beauty = gen._make_copy("Northeast", "web_banner", "Spring Refresh", "Beauty")
    apparel = gen._make_copy("Northeast", "web_banner", "Spring Refresh", "Apparel")
    assert beauty["headline"] != apparel["headline"]


def test_make_copy_cta_varies_by_placement():
    web = gen._make_copy("Northeast", "web_banner", "MD Beauty", "Beauty")
    email = gen._make_copy("Northeast", "email", "MD Beauty", "Beauty")
    sign = gen._make_copy("Northeast", "in_store_signage", "MD Beauty", "Beauty")
    assert len({web["cta"], email["cta"], sign["cta"]}) == 3


# ---------- full pipeline shape ----------


REQUIRED_FIELDS = {
    "variant_id",
    "region",
    "placement",
    "sku_id",
    "sku_name",
    "regional_price",
    "master_price",
    "price_difference_pct",
    "inventory_status",
    "inventory_units",
    "copy_headline",
    "copy_subhead",
    "cta_text",
    "placement_dimensions",
    "master_image_reference",
    "generated_at",
}


def test_generate_variants_count_matches_regions_x_placements_x_skus(seeded_db: Path):
    variants = gen.generate_variants("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    # 3 regions x 4 default placements x 3 skus
    assert len(variants) == 3 * 4 * 3


def test_generate_variants_with_custom_placements(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty",
        [1, 2],
        regions=["Northeast"],
        placements=["web_banner"],
        db_path=seeded_db,
    )
    assert len(variants) == 1 * 1 * 2


def test_generate_variants_each_variant_has_all_required_fields(seeded_db: Path):
    variants = gen.generate_variants("MD Beauty", [1], regions=["Northeast"], db_path=seeded_db)
    for v in variants:
        assert REQUIRED_FIELDS.issubset(v.keys()), f"missing: {REQUIRED_FIELDS - set(v.keys())}"


def test_generate_variants_variant_id_is_unique(seeded_db: Path):
    variants = gen.generate_variants("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    ids = [v["variant_id"] for v in variants]
    assert len(ids) == len(set(ids))


def test_generate_variants_placement_dimensions_per_placement(seeded_db: Path):
    variants = gen.generate_variants("MD Beauty", [1], regions=["Northeast"], db_path=seeded_db)
    by_p = {v["placement"]: v["placement_dimensions"] for v in variants}
    assert by_p["web_banner"] == "1200x628"
    assert by_p["email"] == "600x800"
    assert by_p["in_store_signage"] == "1080x1920"
    assert by_p["mobile"] == "1080x1920"


def test_generate_variants_empty_sku_list_returns_empty(seeded_db: Path):
    assert gen.generate_variants("MD Beauty", [], db_path=seeded_db) == []


def test_generate_variants_skips_unknown_skus(seeded_db: Path):
    variants = gen.generate_variants("MD Beauty", [1, 9999], regions=["Northeast"], db_path=seeded_db)
    # Only sku 1 exists; sku 9999 is skipped silently.
    sku_ids_in_output = {v["sku_id"] for v in variants}
    assert sku_ids_in_output == {1}


# ---------- pricing logic ----------


def test_pricing_regional_matches_db_when_present(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty", [1], regions=["Northeast"], placements=["web_banner"], db_path=seeded_db
    )
    v = variants[0]
    assert v["regional_price"] == 22.00
    assert v["master_price"] == 20.00
    assert v["price_difference_pct"] == pytest.approx(0.10)
    assert "price_flag" not in v  # 10% deviation, no flag


def test_pricing_flags_significantly_higher(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty", [1], regions=["Pacific-Northwest"], placements=["email"], db_path=seeded_db
    )
    v = variants[0]
    assert v["price_difference_pct"] == pytest.approx(0.20)
    assert v["price_flag"] == "significantly_higher"


def test_pricing_flags_significantly_lower(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty", [1], regions=["Mountain"], placements=["web_banner"], db_path=seeded_db
    )
    v = variants[0]
    assert v["price_difference_pct"] == pytest.approx(-0.25)
    assert v["price_flag"] == "significantly_lower"


def test_pricing_flags_no_regional_data_when_missing(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty", [2], regions=["Mountain"], placements=["web_banner"], db_path=seeded_db
    )
    v = variants[0]
    assert v["regional_price"] == 80.00  # falls back to master
    assert v["price_flag"] == "no_regional_data"


# ---------- inventory logic ----------


def test_inventory_out_of_stock_when_locally_zero(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty",
        [2],
        regions=["Pacific-Northwest"],
        placements=["web_banner"],
        db_path=seeded_db,
    )
    v = variants[0]
    assert v["inventory_status"] == "out_of_stock"
    assert v["inventory_units"] == 0


def test_inventory_in_stock_for_high_synthetic_units(seeded_db: Path):
    """Northeast/sku=1 with in_stock_locally=1 -> 181 units (in_stock)."""
    variants = gen.generate_variants(
        "MD Beauty", [1], regions=["Northeast"], placements=["web_banner"], db_path=seeded_db
    )
    v = variants[0]
    assert v["inventory_status"] == "in_stock"
    assert v["inventory_units"] == 181


def test_inventory_low_stock_for_mid_synthetic_units(seeded_db: Path):
    """Pacific-Northwest/sku=1 -> 38 units (low_stock)."""
    variants = gen.generate_variants(
        "MD Beauty",
        [1],
        regions=["Pacific-Northwest"],
        placements=["web_banner"],
        db_path=seeded_db,
    )
    v = variants[0]
    assert v["inventory_status"] == "low_stock"
    assert v["inventory_units"] == 38


# ---------- copy in variants ----------


def test_variant_copy_varies_by_region(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty",
        [1],
        regions=["Northeast", "Pacific-Northwest"],
        placements=["web_banner"],
        db_path=seeded_db,
    )
    by_region = {v["region"]: v["copy_headline"] for v in variants}
    assert by_region["Northeast"] != by_region["Pacific-Northwest"]


def test_variant_copy_web_banner_shorter_than_email(seeded_db: Path):
    variants = gen.generate_variants(
        "MD Beauty",
        [1],
        regions=["Northeast"],
        placements=["web_banner", "email"],
        db_path=seeded_db,
    )
    web = next(v for v in variants if v["placement"] == "web_banner")
    email = next(v for v in variants if v["placement"] == "email")
    assert len(web["copy_subhead"]) < len(email["copy_subhead"])


# ---------- determinism ----------


def test_generate_variants_is_deterministic(seeded_db: Path):
    a = gen.generate_variants("MD Beauty", [1, 2], regions=REGIONS, db_path=seeded_db)
    b = gen.generate_variants("MD Beauty", [1, 2], regions=REGIONS, db_path=seeded_db)
    keys_to_compare = REQUIRED_FIELDS - {"generated_at"}
    a_subset = [{k: v[k] for k in keys_to_compare} for v in a]
    b_subset = [{k: v[k] for k in keys_to_compare} for v in b]
    assert a_subset == b_subset


# ---------- stats ----------


def test_with_stats_total_matches_returned_list(seeded_db: Path):
    variants, stats = gen.generate_variants_with_stats("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    assert stats["total_variants"] == len(variants)


def test_with_stats_by_region_counts_sum_to_total(seeded_db: Path):
    _, stats = gen.generate_variants_with_stats("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    assert sum(stats["by_region"].values()) == stats["total_variants"]


def test_with_stats_by_placement_counts_sum_to_total(seeded_db: Path):
    _, stats = gen.generate_variants_with_stats("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    assert sum(stats["by_placement"].values()) == stats["total_variants"]


def test_with_stats_inventory_alerts_only_low_or_out(seeded_db: Path):
    _, stats = gen.generate_variants_with_stats("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    for alert in stats["inventory_alerts"]:
        assert alert["status"] in {"low_stock", "out_of_stock"}


def test_with_stats_price_alerts_only_flagged(seeded_db: Path):
    _, stats = gen.generate_variants_with_stats("MD Beauty", [1, 2, 3], regions=REGIONS, db_path=seeded_db)
    for alert in stats["price_alerts"]:
        assert abs(alert["pct_diff"]) > gen.PRICE_FLAG_PCT


def test_with_stats_includes_expected_keys(seeded_db: Path):
    _, stats = gen.generate_variants_with_stats("MD Beauty", [1], regions=["Northeast"], db_path=seeded_db)
    expected = {
        "total_variants",
        "regions",
        "placements",
        "skus",
        "by_region",
        "by_placement",
        "inventory_alerts",
        "price_alerts",
        "avg_price_diff_pct",
    }
    assert expected.issubset(stats.keys())


# ---------- formatter + main ----------


def test_format_results_renders_summary_and_sample(seeded_db: Path):
    variants, stats = gen.generate_variants_with_stats(
        "MD Beauty", [1, 2], regions=["Northeast", "Pacific-Northwest"], db_path=seeded_db
    )
    out = gen.format_results(
        "MD Beauty",
        [1, 2],
        {1: "Mac Red Lipstick", 2: "INC Spring Dress"},
        variants,
        stats,
    )
    assert "LOCALIZATION VARIANTS" in out
    assert "Total variants generated:" in out
    assert "VARIANT V-" in out


def test_main_no_args_returns_nonzero(capsys):
    with pytest.raises(SystemExit) as ei:
        gen.main(["generate.py"])
    assert ei.value.code != 0
