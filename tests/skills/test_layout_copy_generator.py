"""Tests for the Layout Copy Generator skill helpers."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_SKILL_PATH = Path(__file__).resolve().parents[2] / "ai_engine" / "skills" / "layout-copy-generator" / "helpers.py"
_spec = importlib.util.spec_from_file_location("layout_helpers", _SKILL_PATH)
assert _spec and _spec.loader
helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(helpers)

MOTHERS_DAY_BRIEF = {
    "name": "Mother's Day Beauty Event",
    "objective": "Drive Beauty category revenue +20%",
    "target_customer": "Women 28 to 55, Macy's Star Rewards members",
    "promotional_offer": ["25% off all Beauty", "Free gift with purchase $75+"],
    "category": "Beauty",
}

SUMMER_BRIEF = {
    "name": "Summer Style",
    "objective": "Drive summer apparel revenue",
    "target_customer": "Women and Men 22 to 40",
    "promotional_offer": ["25% off Swim and Resort Wear"],
    "category": "Beauty",
}

EMPTY_BRIEF = {
    "name": "Generic Campaign",
    "objective": "",
    "target_customer": "",
    "promotional_offer": [],
    "category": "",
}


# ---------- generate_fallback ----------


def test_fallback_returns_all_placements():
    result = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    for p in helpers.PLACEMENTS:
        assert p in result, f"Missing placement: {p}"


def test_fallback_has_required_fields():
    result = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    for p in helpers.PLACEMENTS:
        for field in helpers.REQUIRED_FIELDS:
            assert field in result[p], f"{p} missing field: {field}"
            assert isinstance(result[p][field], str), f"{p}.{field} is not a string"


def test_fallback_mothers_day_theme():
    result = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    # Should reference Mother's Day in at least one placement
    all_text = " ".join(f"{v['tagline']} {v['body']} {v['cta']}" for v in result.values()).lower()
    assert "mother" in all_text


def test_fallback_summer_theme():
    result = helpers.generate_fallback(SUMMER_BRIEF)
    all_text = " ".join(f"{v['tagline']} {v['body']} {v['cta']}" for v in result.values()).lower()
    assert "summer" in all_text


def test_fallback_empty_brief_does_not_crash():
    result = helpers.generate_fallback(EMPTY_BRIEF)
    assert len(result) == 4
    for p in helpers.PLACEMENTS:
        assert result[p]["tagline"]  # non-empty string


def test_fallback_includes_offer():
    result = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    # The first promotional offer should appear in at least one body
    offer = MOTHERS_DAY_BRIEF["promotional_offer"][0]
    bodies = [v["body"] for v in result.values()]
    assert any(offer in b for b in bodies)


# ---------- validate_placements ----------


def test_validate_valid_output():
    result = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    errors = helpers.validate_placements(result)
    assert errors == []


def test_validate_missing_placement():
    data = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    del data["mobile"]
    errors = helpers.validate_placements(data)
    assert any("Missing placement: mobile" in e for e in errors)


def test_validate_missing_field():
    data = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    del data["email"]["cta"]
    errors = helpers.validate_placements(data)
    assert any("email" in e and "cta" in e for e in errors)


def test_validate_character_limit():
    data = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    data["mobile"]["tagline"] = "x" * 100  # exceeds 40 char limit
    errors = helpers.validate_placements(data)
    assert any("mobile.tagline" in e and "exceeds" in e for e in errors)


# ---------- determinism ----------


def test_fallback_is_deterministic():
    r1 = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    r2 = helpers.generate_fallback(MOTHERS_DAY_BRIEF)
    assert r1 == r2


# ---------- PLACEMENT_SPECS ----------


def test_specs_cover_all_placements():
    for p in helpers.PLACEMENTS:
        assert p in helpers.PLACEMENT_SPECS
        spec = helpers.PLACEMENT_SPECS[p]
        assert "dimensions" in spec
        assert "tagline_max" in spec
        assert "body_max" in spec
        assert "cta_max" in spec
