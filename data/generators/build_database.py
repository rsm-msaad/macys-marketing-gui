"""Build the macys.db SQLite database from all generators in one shot.

Run from the milestone02 folder root:

    python data/generators/build_database.py

Output:
    data/macys.db
    data/samples/<table>.csv  (100 row CSV slice per table)
"""

from __future__ import annotations

import sqlite3
import sys
import time
from pathlib import Path

import pandas as pd

GEN_DIR = Path(__file__).resolve().parent
DATA_DIR = GEN_DIR.parent
SCHEMA_PATH = DATA_DIR / "schemas" / "schema.sql"
DB_PATH = DATA_DIR / "macys.db"
SAMPLES_DIR = DATA_DIR / "samples"

if str(GEN_DIR) not in sys.path:
    sys.path.insert(0, str(GEN_DIR))

from generate_customers import generate_customers, generate_transactions  # noqa: E402
from generate_skus import generate_skus, generate_regional_pricing  # noqa: E402
from generate_dam import generate_dam_assets  # noqa: E402
from generate_campaigns import generate_campaigns, generate_campaign_performance  # noqa: E402


def apply_schema(conn: sqlite3.Connection) -> None:
    sql = SCHEMA_PATH.read_text()
    conn.executescript(sql)
    conn.commit()


def write_table(conn: sqlite3.Connection, name: str, df: pd.DataFrame) -> None:
    df.to_sql(name, conn, if_exists="append", index=False)


def write_sample(name: str, df: pd.DataFrame, n: int = 100) -> None:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    df.head(n).to_csv(SAMPLES_DIR / f"{name}.csv", index=False)


def main() -> None:
    t0 = time.time()
    print(f"Building {DB_PATH} ...")

    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    try:
        apply_schema(conn)
        print("[1/7] Schema applied.")

        print("[2/7] Generating customers ...")
        customers = generate_customers()
        write_table(conn, "customers", customers)
        write_sample("customers", customers)
        print(f"        {len(customers):,} customers")

        print("[3/7] Generating SKUs and regional pricing ...")
        skus = generate_skus()
        regional = generate_regional_pricing(skus)
        write_table(conn, "sku_catalog", skus)
        write_table(conn, "regional_pricing", regional)
        write_sample("sku_catalog", skus)
        write_sample("regional_pricing", regional)
        print(f"        {len(skus):,} SKUs, {len(regional):,} regional prices")

        print("[4/7] Generating transactions ...")
        transactions = generate_transactions(customers, skus, regional)
        write_table(conn, "transactions", transactions)
        write_sample("transactions", transactions)
        print(f"        {len(transactions):,} transactions")

        print("[5/7] Generating DAM assets ...")
        dam = generate_dam_assets(skus=skus)
        write_table(conn, "dam_assets", dam)
        write_sample("dam_assets", dam)
        print(f"        {len(dam):,} DAM assets")

        print("[6/7] Generating campaigns ...")
        campaigns = generate_campaigns()
        write_table(conn, "campaigns", campaigns)
        write_sample("campaigns", campaigns)
        print(f"        {len(campaigns)} campaigns")

        print("[7/7] Generating campaign performance ...")
        perf = generate_campaign_performance(campaigns)
        write_table(conn, "campaign_performance", perf)
        write_sample("campaign_performance", perf)
        print(f"        {len(perf):,} performance rows")

        conn.commit()
    finally:
        conn.close()

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s. Database at {DB_PATH}")
    print(f"Samples written to {SAMPLES_DIR}/")


if __name__ == "__main__":
    main()
