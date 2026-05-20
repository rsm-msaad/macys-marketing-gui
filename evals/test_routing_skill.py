"""Revision Router skill evaluation.

Tests whether the router correctly classifies free text revision
comments into the expected change_type (copy, imagery, pricing,
targeting, legal, localization).

Does NOT call the live LLM. Instead tests the deterministic helpers
that map change_type to owner and compute urgency. The LLM classification
is tested separately if TritonAI is available.

Run: uv run pytest evals/test_routing_skill.py -v
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

CASES_PATH = Path(__file__).parent / "datasets" / "routing_cases.json"
CASES = json.loads(CASES_PATH.read_text())["test_cases"]

# Load the routing helpers
HELPERS_PATH = Path(__file__).resolve().parents[1] / "ai_engine" / "skills" / "revision-router" / "helpers.py"
spec = importlib.util.spec_from_file_location("routing_helpers", HELPERS_PATH)
assert spec and spec.loader
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_owner_lookup_for_change_type(case: dict) -> None:
    """Verify that the expected change_type maps to a valid owner."""
    ct = case["expected_change_type"]
    owner = helpers.lookup_owner(ct)
    assert owner, f"No owner found for change_type={ct}"
    print(f"\n  {ct} -> owner={owner}")


def test_urgency_high_spend_short_timeline() -> None:
    """High spend + short timeline = high urgency."""
    campaign = {"estimated_spend": 600_000, "business_days_to_launch": 3}
    result = helpers.assess_urgency(campaign)
    assert result == "high", f"Expected high, got {result}"


def test_urgency_low_spend_long_timeline() -> None:
    """Low spend + long timeline = low urgency."""
    campaign = {"estimated_spend": 50_000, "business_days_to_launch": 20}
    result = helpers.assess_urgency(campaign)
    assert result == "low", f"Expected low, got {result}"


def test_urgency_medium_cases() -> None:
    """Either high spend OR short timeline alone = medium."""
    # High spend, long timeline
    r1 = helpers.assess_urgency({"estimated_spend": 600_000, "business_days_to_launch": 15})
    assert r1 == "medium", f"Expected medium, got {r1}"
    # Low spend, short timeline
    r2 = helpers.assess_urgency({"estimated_spend": 50_000, "business_days_to_launch": 3})
    assert r2 == "medium", f"Expected medium, got {r2}"
