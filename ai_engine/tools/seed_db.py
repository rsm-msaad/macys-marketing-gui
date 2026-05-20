"""
Build a small SQLite database for local development and demos.

The schema mirrors the M2 macys.db just enough to drive the three MCP
tools. Run once after a fresh clone, and again any time the seed below
changes:

    python tools/seed_db.py

Writes data/macys.db. Idempotent (drops and recreates the tables on
every run so the seed stays in sync with this file).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "macys_m3.db"

# (sku_id, name, category, brand, regular_price, current_promo_pct)
SKUS: list[tuple[str, str, str, str, float, float]] = [
    ("BTY-001", "Lancome Lifting Cream", "Beauty", "Lancome", 95.00, 0.0),
    ("BTY-045", "Cleansing Gel 200ml", "Beauty", "Macys", 24.00, 0.0),
    ("BTY-112", "Vitamin C Serum 30ml", "Beauty", "Macys", 32.00, 0.0),
    ("BTY-200", "Hydrating Toner 150ml", "Beauty", "Macys", 18.00, 0.0),
    ("BTY-201", "Night Repair Serum 50ml", "Beauty", "Macys", 42.00, 0.0),
    ("BTY-202", "Brightening Eye Cream 15ml", "Beauty", "Macys", 38.00, 0.0),
    ("APP-101", "Levi's 501 Original Jeans", "Apparel", "Levi's", 79.50, 0.0),
    ("APP-102", "Levi's Denim Jacket", "Apparel", "Levi's", 89.50, 0.0),
    ("APP-205", "Coach Tabby Shoulder Bag", "Apparel", "Coach", 495.00, 0.0),
    ("APP-301", "Spring Linen Shirt", "Apparel", "Macys", 39.99, 0.0),
    ("APP-302", "Chino Pants Slim Fit", "Apparel", "Macys", 49.99, 30.0),
    ("APP-303", "Knit Cardigan Pastel", "Apparel", "Macys", 54.99, 0.0),
    ("APP-401", "Floral Print Sundress", "Apparel", "Macys", 64.99, 0.0),
    ("HOM-010", "Cotton Bedding Set Queen", "Home", "Macys", 129.00, 0.0),
    ("HOM-011", "Throw Blanket Knit", "Home", "Macys", 39.99, 0.0),
    ("HOM-012", "Bathroom Towel Set", "Home", "Macys", 49.99, 0.0),
    ("HOM-101", "Ceramic Vase Medium", "Home", "Macys", 29.99, 0.0),
    ("HOM-102", "Decorative Throw Pillow", "Home", "Macys", 24.99, 0.0),
    ("HOM-201", "Kitchen Mixing Bowl Set", "Home", "Macys", 34.99, 25.0),
    ("HOM-202", "Cast Iron Skillet 10in", "Home", "Macys", 44.99, 0.0),
    ("HOM-301", "Wall Art Print Framed", "Home", "Macys", 79.99, 0.0),
]

# (asset_id, category, region_rights, filename, tag_list, model_release_expires)
DAM_ASSETS: list[tuple[str, str, str, str, str, str | None]] = [
    ("DAM-BTY-SP26-014", "Beauty", "NY,CA,FL,TX,PR", "beauty_skincare_hero.jpg", "skincare,hero,spring,model", "2026-12-31"),
    ("DAM-BTY-SP26-021", "Beauty", "NY,CA", "beauty_serum_lifestyle.jpg", "serum,lifestyle,natural light", "2026-09-30"),
    ("DAM-BTY-SP26-022", "Beauty", "FL,TX,PR", "beauty_skincare_southern_market.jpg", "skincare,warm tone,latin model", "2026-10-15"),
    ("DAM-BTY-SP26-031", "Beauty", "NY,CA,FL,TX,PR", "beauty_routine_layered.jpg", "routine,product still,no model", None),
    ("DAM-BTY-EXP-001", "Beauty", "NY,CA", "beauty_old_campaign.jpg", "skincare,expired", "2024-06-30"),
    ("DAM-APP-SP26-001", "Apparel", "NY,CA,FL,TX", "apparel_linen_shirt.jpg", "linen,spring,model", "2026-12-31"),
    ("DAM-APP-SP26-002", "Apparel", "NY,CA,FL,TX,PR", "apparel_chinos_outdoor.jpg", "chinos,outdoor,active", "2026-11-30"),
    ("DAM-APP-SP26-003", "Apparel", "NY,CA", "apparel_dress_studio.jpg", "dress,studio,model", "2026-08-15"),
    ("DAM-APP-PR26-001", "Apparel", "PR", "apparel_three_kings_window.jpg", "three kings,window display", None),
    ("DAM-HOM-SP26-001", "Home", "NY,CA,FL,TX,PR", "home_bedding_set.jpg", "bedding,still life", None),
    ("DAM-HOM-SP26-002", "Home", "NY,CA,FL,TX,PR", "home_kitchen_setup.jpg", "kitchen,still life", None),
    ("DAM-HOM-SP26-003", "Home", "NY,CA", "home_decor_lifestyle.jpg", "decor,lifestyle,model", "2026-10-31"),
    ("DAM-HOM-EXP-001", "Home", "NY,CA,FL,TX", "home_bedding_outdated.jpg", "bedding,expired", "2024-12-31"),
    ("DAM-HOM-QC-001", "Home", "QC", "home_quebec_window.jpg", "quebec national,window", None),
    ("DAM-BTY-QC-001", "Beauty", "QC,NY", "beauty_quebec_skincare.jpg", "skincare,bilingual,model", "2026-12-15"),
]


def build_database(db_path: Path = DB_PATH) -> None:
    """Drop and recreate the seeded tables. Write SKU and asset rows."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(
            """
            DROP TABLE IF EXISTS skus;
            DROP TABLE IF EXISTS dam_assets;
            CREATE TABLE skus (
                sku_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                brand TEXT NOT NULL,
                regular_price REAL NOT NULL,
                current_promo_pct REAL NOT NULL DEFAULT 0
            );
            CREATE TABLE dam_assets (
                asset_id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                region_rights TEXT NOT NULL,
                filename TEXT NOT NULL,
                tag_list TEXT NOT NULL,
                model_release_expires TEXT
            );
            """
        )
        conn.executemany(
            "INSERT INTO skus (sku_id, name, category, brand, regular_price, current_promo_pct) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            SKUS,
        )
        conn.executemany(
            "INSERT INTO dam_assets (asset_id, category, region_rights, filename, "
            "tag_list, model_release_expires) VALUES (?, ?, ?, ?, ?, ?)",
            DAM_ASSETS,
        )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    """CLI entry, build the dev database and print a summary."""
    build_database()
    print(f"Wrote {len(SKUS)} SKUs and {len(DAM_ASSETS)} DAM assets to {DB_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
