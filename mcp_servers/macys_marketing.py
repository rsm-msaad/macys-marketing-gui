"""
MCP server exposing the three Macys M3 tools over stdio transport.

Tools registered:
    check_pricing_conflicts  pricing and MAP conflict check for a SKU list
    find_dam_assets          DAM lookup by category and region with rights filter
    generate_locale_variants simulated transcreation to Spanish or Quebec French

Run as a module from the repo root:

    python -m mcp_server.server

Or as a script:

    python mcp_server/server.py

The server speaks stdio, suitable for Claude Desktop or Claude Code. The
matching client config is in mcp_server/claude_desktop_config_example.json.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# Make the sibling tools/ package importable when this file is run as a
# script (python mcp_server/server.py), since in that case sys.path[0]
# is the script's directory rather than the repo root. When invoked as
# python -m mcp_server.server the repo root is already on sys.path and
# this line is a no op.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server.fastmcp import FastMCP  # noqa: E402
from tools.check_pricing_conflicts import (  # noqa: E402
    check_pricing_conflicts as _check_pricing,
)
from tools.find_dam_assets import find_dam_assets as _find_dam  # noqa: E402
from tools.generate_locale_variants import (  # noqa: E402
    generate_locale_variants as _generate_locale,
)
mcp = FastMCP("macys-marketing")


@mcp.tool()
def check_pricing_conflicts(
    sku_ids: list[str],
    proposed_discount_pct: float,
) -> dict[str, Any]:
    """Check a SKU list for pricing rule conflicts.

    Validates each SKU against three rules:
      1. Brand on the MAP enforced list (Levi's, Coach, Lancome, Estee Lauder,
         Clinique, La Mer, Dior Beauty, Tag Heuer per PRICE-RULES-2026-001).
      2. Combined active promo plus proposed discount over 50 percent.
      3. SKU exists in the catalog.

    Used by the compliance-pre-check skill at workflow step 6a.

    Args:
        sku_ids: list of SKU identifiers to check.
        proposed_discount_pct: discount the campaign plans to run.

    Returns:
        Dict with status (pass, warn, fail), conflicts list, and checked_count.
    """
    return _check_pricing(sku_ids, proposed_discount_pct)


@mcp.tool()
def find_dam_assets(
    category: str,
    region: str,
    max_results: int = 5,
) -> dict[str, Any]:
    """Find DAM assets matching a category and region with active rights.

    Filters out assets whose model release has expired. Used by the
    localization-generator skill at workflow step 7.

    Args:
        category: top level category (Beauty, Apparel, Home, etc).
        region: region code (NY, CA, FL, TX, PR, QC, etc).
        max_results: cap on the number of assets returned (default 5).

    Returns:
        Dict with status, assets list, and result_count.
    """
    return _find_dam(category, region, max_results=max_results)


@mcp.tool()
def generate_locale_variants(
    copy: str,
    target_language: str,
    regional_pricing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Produce a simulated localized variant of campaign copy.

    Applies phrase level substitutions for 'es' (Spanish, Latin America) or
    'fr-CA' (Quebec French). If regional_pricing is provided, appends a
    formatted price line. Used by the localization-generator skill at
    workflow step 7.

    Args:
        copy: source English copy.
        target_language: 'es' or 'fr-CA'.
        regional_pricing: optional pricing dict (currency, effective price).

    Returns:
        Dict with status, original_copy, translated_copy, target_language,
        applied_pricing, applied_phrases, and unmatched_words.
    """
    return _generate_locale(copy, target_language, regional_pricing)


if __name__ == "__main__":
    mcp.run()
