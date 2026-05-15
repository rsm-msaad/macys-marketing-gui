"""
MCP tool: check_pricing_conflicts.

Given a list of SKUs and a proposed discount percentage, returns any
conflicts:

  1. Brand on the MAP enforced list (Levi's, Coach, Lancome, Estee Lauder,
     Clinique, La Mer, Dior Beauty, Tag Heuer per PRICE-RULES-2026-001)
  2. An active promo already in place that, combined with the proposed
     discount, would exceed the 50 percent stacking ceiling
  3. SKU does not exist in the catalog

Used by the compliance-pre-check skill at workflow step 6a.

CLI:
    python -m tools.check_pricing_conflicts BTY-001 BTY-045 BTY-112 --discount 40
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path
from typing import Any

MAP_ENFORCED_BRANDS: set[str] = {
    "Levi's",
    "Coach",
    "Lancome",
    "Estee Lauder",
    "Clinique",
    "La Mer",
    "Dior Beauty",
    "Tag Heuer",
}
STACK_CEILING_PCT: float = 50.0

DB_PATH: Path = Path(__file__).resolve().parent.parent / "macys_m3.db"


def _connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Open a read only connection to the seeded SKU database."""
    if not db_path.exists():
        raise FileNotFoundError(
            f"SKU database not found at {db_path}. "
            "Build it first with: python tools/seed_db.py"
        )
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def check_pricing_conflicts(
    sku_ids: list[str],
    proposed_discount_pct: float,
    db_path: Path = DB_PATH,
) -> dict[str, Any]:
    """Check a SKU list against brand, stacking, and existence rules.

    Args:
        sku_ids: SKU identifiers to check.
        proposed_discount_pct: discount the campaign plans to run (for
            example 40 for 40 percent off).
        db_path: optional override, used by tests.

    Returns:
        Dict with:
          status: 'pass', 'warn', or 'fail'
          conflicts: list of {sku_id, issue, severity} dicts
          checked_count: how many SKUs were inspected
    """
    conflicts: list[dict[str, Any]] = []
    conn = _connect(db_path)
    try:
        for sku_id in sku_ids:
            row = conn.execute(
                "SELECT sku_id, name, brand, current_promo_pct FROM skus WHERE sku_id = ?",
                (sku_id,),
            ).fetchone()
            if row is None:
                conflicts.append(
                    {
                        "sku_id": sku_id,
                        "issue": "SKU not found in catalog.",
                        "severity": "fail",
                    }
                )
                continue
            if row["brand"] in MAP_ENFORCED_BRANDS:
                conflicts.append(
                    {
                        "sku_id": sku_id,
                        "issue": (
                            f"Brand {row['brand']} is on the MAP enforced list "
                            "per PRICE-RULES-2026-001. Discount requires written "
                            "Merchandising approval."
                        ),
                        "severity": "fail",
                    }
                )
                continue
            active = float(row["current_promo_pct"] or 0.0)
            stacked = active + proposed_discount_pct
            if active > 0 and stacked > STACK_CEILING_PCT:
                conflicts.append(
                    {
                        "sku_id": sku_id,
                        "issue": (
                            f"Active promo {active:.0f} percent stacks with proposed "
                            f"{proposed_discount_pct:.0f} percent to {stacked:.0f} percent, "
                            "above the 50 percent ceiling."
                        ),
                        "severity": "warn",
                    }
                )
    finally:
        conn.close()
    if any(c["severity"] == "fail" for c in conflicts):
        status = "fail"
    elif any(c["severity"] == "warn" for c in conflicts):
        status = "warn"
    else:
        status = "pass"
    return {
        "status": status,
        "conflicts": conflicts,
        "checked_count": len(sku_ids),
    }


def _cli(argv: list[str]) -> int:
    """CLI entry, run a check and pretty print the result."""
    parser = argparse.ArgumentParser(description="Check pricing conflicts for a SKU list.")
    parser.add_argument("sku_ids", nargs="+", help="One or more SKU identifiers")
    parser.add_argument(
        "--discount",
        type=float,
        required=True,
        help="Proposed discount percentage (for example 40 for 40 percent off)",
    )
    args = parser.parse_args(argv)
    result = check_pricing_conflicts(args.sku_ids, args.discount)
    print(f"status: {result['status']}")
    print(f"checked: {result['checked_count']} SKUs")
    for conflict in result["conflicts"]:
        print(f"  [{conflict['severity']}] {conflict['sku_id']}: {conflict['issue']}")
    return 0 if result["status"] != "fail" else 1


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
