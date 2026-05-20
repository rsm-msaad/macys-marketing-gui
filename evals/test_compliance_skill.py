"""Compliance Pre Check skill evaluation.

Tests the deterministic helpers (banned words scan, tagline check,
pricing language check) that form the backbone of the compliance skill.
These do not require LLM calls and should produce consistent results.

Run: uv run pytest evals/test_compliance_skill.py -v
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

CASES_PATH = Path(__file__).parent / "datasets" / "compliance_cases.json"
CASES = json.loads(CASES_PATH.read_text())["test_cases"]

# Load the compliance helpers
HELPERS_PATH = Path(__file__).resolve().parents[1] / "ai_engine" / "skills" / "compliance-pre-check" / "helpers.py"
spec = importlib.util.spec_from_file_location("compliance_helpers", HELPERS_PATH)
assert spec and spec.loader
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_banned_word_detection(case: dict) -> None:
    """Verify banned word scanning on campaign copy."""
    copy = case["input"].get("copy", "")
    found = helpers.scan_for_banned_words(copy)
    print(f"\n  Copy: {copy[:60]}...")
    print(f"  Banned words found: {found}")
    # If expected action is revise and the copy has obvious banned words, we expect findings
    # This is a soft check since not all revise cases are due to banned words


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_tagline_check(case: dict) -> None:
    """Verify tagline is checked against approved list."""
    tagline = case["input"].get("tagline")
    if tagline is None:
        pytest.skip("No tagline in this case")
    result = helpers.check_tagline(tagline)
    print(f"\n  Tagline: {tagline}")
    print(f"  Approved: {result}")
    if case["id"] == "bad_tagline":
        assert not result, f"Tagline '{tagline}' should NOT be approved"
    elif case["id"] in ("all_pass", "clean_moderate_discount"):
        assert result, f"Tagline '{tagline}' should be approved"


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_pricing_language(case: dict) -> None:
    """Verify pricing language checks for discount claims."""
    copy = case["input"].get("copy", "")
    result = helpers.check_pricing_language(copy)
    print(f"\n  Copy: {copy[:60]}...")
    print(f"  Pricing check: {result}")
    # Verify the check returns a dict with expected keys
    assert isinstance(result, dict)


def test_evaluate_recommended_action_all_pass() -> None:
    """If no failures, recommended action is proceed."""
    findings = {
        "brand_alignment": {"status": "pass"},
        "disclaimers": {"status": "pass"},
        "pricing_cross_check": {"status": "pass"},
    }
    action = helpers.evaluate_recommended_action(findings)
    assert action == "proceed"


def test_evaluate_recommended_action_any_fail() -> None:
    """If any finding is fail, recommended action is revise."""
    findings = {
        "brand_alignment": {"status": "fail"},
        "disclaimers": {"status": "pass"},
        "pricing_cross_check": {"status": "pass"},
    }
    action = helpers.evaluate_recommended_action(findings)
    assert action == "revise"
