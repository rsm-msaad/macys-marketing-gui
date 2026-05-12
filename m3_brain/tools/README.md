# tools

Python implementations of the three MCP tools used by the M3 chained skills.

## Overview

These functions are reusable Python regardless of MCP. The MCP server in [../mcp_server/server.py](../mcp_server/server.py) exposes them as MCP tools, but they can also be imported directly:

```python
from tools import check_pricing_conflicts, find_dam_assets, generate_locale_variants
```

## Tools

### check_pricing_conflicts

File: [check_pricing_conflicts.py](check_pricing_conflicts.py)

```python
def check_pricing_conflicts(
    sku_ids: list[str],
    proposed_discount_pct: float,
) -> dict
```

Validates each SKU against three rules:

1. Brand on the MAP enforced list (Levi's, Coach, Lancome, Estee Lauder, Clinique, La Mer, Dior Beauty, Tag Heuer per PRICE-RULES-2026-001)
2. Combined active promo plus proposed discount over 50 percent
3. SKU exists in the catalog

Example:

```python
>>> check_pricing_conflicts(["BTY-001", "BTY-045"], 40.0)
{
  "status": "fail",
  "conflicts": [
    {"sku_id": "BTY-001", "issue": "Brand Lancome is on the MAP enforced list...", "severity": "fail"}
  ],
  "checked_count": 2
}
```

### find_dam_assets

File: [find_dam_assets.py](find_dam_assets.py)

```python
def find_dam_assets(
    category: str,
    region: str,
    max_results: int = 5,
) -> dict
```

Returns DAM asset metadata for a category and region, with expired model releases filtered out.

Example:

```python
>>> find_dam_assets("Beauty", "FL", max_results=3)
{
  "status": "pass",
  "assets": [
    {"asset_id": "DAM-BTY-SP26-014", "filename": "beauty_skincare_hero.jpg", ...}
  ],
  "result_count": 1
}
```

### generate_locale_variants

File: [generate_locale_variants.py](generate_locale_variants.py)

```python
def generate_locale_variants(
    copy: str,
    target_language: str,
    regional_pricing: dict | None = None,
) -> dict
```

Phrase based simulated translation. Supports `es` (Spanish, Latin America) and `fr-CA` (Quebec French). Does not call any external translation API.

Example:

```python
>>> generate_locale_variants("Up to 40 percent off. Refresh your routine.", "es")
{
  "status": "pass",
  "original_copy": "Up to 40 percent off. Refresh your routine.",
  "translated_copy": "Hasta 40 por ciento de descuento. Renueva tu rutina.",
  "target_language": "es",
  "applied_phrases": ["Refresh your routine.", "percent off", "Up to"]
}
```

## Local development database

The first two tools read from [../data/macys.db](../data/), a small seeded SQLite store. Build or rebuild it with:

```
python tools/seed_db.py
```

The database is committed to the repo because it is tiny (under 100 KB) and lets a fresh clone run the tools without an extra setup step. See [../data/README.md](../data/README.md) for the schema and seed contents.

## CLI

Each tool has a `__main__` entry for quick standalone testing:

```
python -m tools.check_pricing_conflicts BTY-001 BTY-045 BTY-112 --discount 40
python -m tools.find_dam_assets Beauty FL --max 3
python -m tools.generate_locale_variants "Up to 40 percent off." es
```

## Tests

Pytest suite at [../tests/test_tools.py](../tests/test_tools.py). Each tool gets a pass case, a fail case, and at least one edge case. Run:

```
python -m pytest tests/test_tools.py -v
```

## Why these are plain Python functions

Vincent's rule from M2: the model never calculates, tools do. Each tool here returns structured data the model can quote verbatim into its response. No tool generates prose. No tool decides the next workflow step. Those decisions live in the chained skills.
