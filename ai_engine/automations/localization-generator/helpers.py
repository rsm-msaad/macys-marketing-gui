"""
Deterministic helpers for the localization generator skill.

The MCP tools find_dam_assets and generate_locale_variants do the asset
lookup and the actual translation. These helpers handle the mappings
(region to language, region to pricing override) and the holiday calendar,
so the model is not reinventing them on each call.
"""

REGION_LANGUAGE = {
    "NY": "en",
    "CA": "en",
    "FL": "es",
    "TX": "es",
    "PR": "es",
    "QC": "fr_ca",
}

REGION_PRICING_OVERRIDE = {
    # Categories where Puerto Rico pricing diverges from continental US.
    "PR": {"Beauty": 1.08, "Fragrance": 1.10},
}

REGIONAL_HOLIDAYS_BY_MONTH = {
    1: {"PR": "Three Kings Day"},
    2: {"CA": "Lunar New Year"},
    6: {"QC": "Quebec National Holiday"},
    11: {"TX": "Dia de los Muertos", "AZ": "Dia de los Muertos", "NM": "Dia de los Muertos"},
}


def region_to_language(region: str) -> str:
    """Return the language code for a region. Defaults to 'en' if unknown."""
    return REGION_LANGUAGE.get(region, "en")


def apply_regional_pricing(discount_pct: int, region: str, category: str = "") -> dict:
    """Apply any regional pricing override.

    Returns a dict with the effective discount and a human readable note. If
    no override applies, the note states that standard continental pricing
    is in use.
    """
    overrides = REGION_PRICING_OVERRIDE.get(region, {})
    multiplier = overrides.get(category)
    if multiplier is None:
        return {
            "effective_discount_pct": discount_pct,
            "pricing_note": "Standard continental pricing applies.",
        }
    return {
        "effective_discount_pct": discount_pct,
        "pricing_note": (
            f"Puerto Rico {category} pricing applies a {multiplier} multiplier "
            "on base price. Confirm the final ticketed price with Pricing Strategy."
        ),
    }


def holiday_overlay(region: str, campaign_window_month: int) -> str | None:
    """Flag any regional holiday that falls in the campaign launch month.

    campaign_window_month is the month integer (1 to 12) of the launch.
    Returns the holiday name if one is on the standing list for that region
    in that month, else None.
    """
    month_map = REGIONAL_HOLIDAYS_BY_MONTH.get(campaign_window_month, {})
    return month_map.get(region)


def assemble_variants(variants: list[dict]) -> list[dict]:
    """Pass through. Kept as a named seam for orchestration uniformity."""
    return variants
