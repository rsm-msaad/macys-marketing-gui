"""Helpers for the Layout Copy Generator skill.

Provides:
- validate_placements(): checks output structure and character limits
- generate_fallback(): deterministic copy when the LLM is unavailable
- PLACEMENT_SPECS: character limits and dimensions per placement
"""

from __future__ import annotations

from typing import Any

PLACEMENTS = ["web_banner", "email", "mobile", "in_store_signage"]

PLACEMENT_SPECS: dict[str, dict[str, Any]] = {
    "web_banner": {
        "dimensions": "1200x628",
        "tagline_max": 50,
        "body_max": 100,
        "cta_max": 25,
    },
    "email": {
        "dimensions": "600x800",
        "tagline_max": 60,
        "body_max": 200,
        "cta_max": 25,
    },
    "mobile": {
        "dimensions": "414x896",
        "tagline_max": 40,
        "body_max": 80,
        "cta_max": 20,
    },
    "in_store_signage": {
        "dimensions": "1080x1920",
        "tagline_max": 40,
        "body_max": 60,
        "cta_max": 20,
    },
}

REQUIRED_FIELDS = ["tagline", "body", "cta", "visual_direction"]


def validate_placements(data: dict[str, Any]) -> list[str]:
    """Validate the LLM output. Returns a list of error strings (empty = valid)."""
    errors: list[str] = []
    for placement in PLACEMENTS:
        if placement not in data:
            errors.append(f"Missing placement: {placement}")
            continue
        block = data[placement]
        if not isinstance(block, dict):
            errors.append(f"{placement}: expected dict, got {type(block).__name__}")
            continue
        for field in REQUIRED_FIELDS:
            if field not in block:
                errors.append(f"{placement}: missing field '{field}'")
            elif not isinstance(block[field], str):
                errors.append(f"{placement}.{field}: expected str")
        # Check character limits (warn, don't fail)
        spec = PLACEMENT_SPECS[placement]
        for field, limit_key in [
            ("tagline", "tagline_max"),
            ("body", "body_max"),
            ("cta", "cta_max"),
        ]:
            val = block.get(field, "")
            if isinstance(val, str) and len(val) > spec[limit_key]:
                errors.append(f"{placement}.{field}: {len(val)} chars exceeds limit of {spec[limit_key]}")
    return errors


def generate_fallback(brief: dict[str, Any]) -> dict[str, dict[str, str]]:
    """Generate deterministic layout copy when the LLM is not available.

    Uses the campaign brief to produce reasonable copy. This is NOT a
    replacement for the LLM; it is a demo fallback so the UI always has
    content to show even if the TritonAI endpoint is down.
    """
    name = brief.get("name", "Campaign")
    offers = brief.get("promotional_offer", [])
    offer_line = offers[0] if offers else "Special offer"
    target = brief.get("target_customer", "valued customers")

    # Detect campaign theme from name
    name_lc = name.lower()
    if "mother" in name_lc:
        theme_adj = "heartfelt"
        theme_noun = "gift"
        season_word = "Mother's Day"
    elif "spring" in name_lc:
        theme_adj = "fresh"
        theme_noun = "look"
        season_word = "spring"
    elif "summer" in name_lc:
        theme_adj = "bold"
        theme_noun = "style"
        season_word = "summer"
    elif "holiday" in name_lc:
        theme_adj = "festive"
        theme_noun = "gift"
        season_word = "holiday"
    else:
        theme_adj = "stunning"
        theme_noun = "pick"
        season_word = "this season"

    return {
        "web_banner": {
            "tagline": f"{theme_adj.title()} {theme_noun}s for {season_word}",
            "body": f"{offer_line}. Hand-picked for {target.split(',')[0].strip()}.",
            "cta": f"Shop {season_word}",
            "visual_direction": f"Hero photo on neutral cream backdrop with {season_word} color palette, Macy's logo upper left.",
        },
        "email": {
            "tagline": f"Your {season_word} beauty edit is here",
            "body": f"{offer_line}. We picked the best for you. Star Rewards members get free shipping.",
            "cta": "Shop the edit",
            "visual_direction": "Editorial layout: 3-up product grid above the fold, then loyalty bonus, then in-store call-out.",
        },
        "mobile": {
            "tagline": f"{theme_adj.title()} picks, {theme_adj} prices",
            "body": f"{offer_line}.",
            "cta": "Shop now",
            "visual_direction": "Vertical product carousel; CTA pinned at bottom for thumb reach.",
        },
        "in_store_signage": {
            "tagline": f"{theme_adj.title()} {theme_noun}s. Real savings.",
            "body": f"{offer_line}. Today only.",
            "cta": "See associate",
            "visual_direction": "Large-format vertical poster for storefront windows and counter end caps.",
        },
    }
