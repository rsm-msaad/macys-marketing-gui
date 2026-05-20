"""Approval Brief Generator skill evaluation.

Tests the deterministic decide_recommendation helper and the
assemble_brief function that produce the VP approval brief.

The decide_recommendation rule: any 'fail' in compliance findings
triggers 'revise', otherwise 'approve'. Warn statuses do not
trigger revise on their own.

Run: uv run pytest evals/test_brief_skill.py -v
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

CASES_PATH = Path(__file__).parent / "datasets" / "brief_cases.json"
CASES = json.loads(CASES_PATH.read_text())["test_cases"]

# Load the brief helpers
HELPERS_PATH = Path(__file__).resolve().parents[1] / "ai_engine" / "skills" / "approval-brief-generator" / "helpers.py"
spec = importlib.util.spec_from_file_location("brief_helpers", HELPERS_PATH)
assert spec and spec.loader
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_decide_recommendation(case: dict) -> None:
    """Verify decide_recommendation matches expected outcome."""
    compliance = case["input"]["compliance_check"]
    risk_flags = case.get("risk_flags", [])
    result = helpers.decide_recommendation(compliance, risk_flags)
    expected = case["expected_recommendation"]
    print(f"\n  Campaign: {case['input']['campaign']['title']}")
    print(
        f"  Compliance statuses: brand={compliance['brand_alignment']['status']}, "
        f"disclaimers={compliance['disclaimers']['status']}, "
        f"pricing={compliance['pricing_cross_check']['status']}"
    )
    print(f"  Result: {result}, Expected: {expected}")
    assert result == expected, f"decide_recommendation returned '{result}' but expected '{expected}'"


def test_assemble_brief_structure() -> None:
    """Verify assemble_brief returns dict with all required fields."""
    brief = helpers.assemble_brief(
        campaign_goal="Drive Beauty revenue +20%",
        target_audience="Women 28 to 55 with Beauty affinity",
        expected_roi="Projected 3.5x ROAS based on Spring 2025 retro",
        risk_flags=["disclaimer warn on percent off language"],
        ai_recommendation="approve",
        retrieved_docs=["RETRO-SP-2025-BTY"],
    )
    assert isinstance(brief, dict)
    assert "campaign_goal" in brief
    assert "target_audience" in brief
    assert "expected_roi" in brief
    assert "risk_flags" in brief
    assert "ai_recommendation" in brief
    assert "retrieved_docs" in brief
    print(f"\n  Brief fields: {list(brief.keys())}")


def test_assemble_brief_preserves_values() -> None:
    """Verify assemble_brief passes through values correctly."""
    brief = helpers.assemble_brief(
        campaign_goal="Test goal",
        target_audience="Test audience",
        expected_roi="4.0x ROAS",
        risk_flags=["risk A", "risk B"],
        ai_recommendation="revise",
        retrieved_docs=["DOC-001", "DOC-002"],
    )
    assert brief["campaign_goal"] == "Test goal"
    assert brief["target_audience"] == "Test audience"
    assert brief["ai_recommendation"] == "revise"
    assert len(brief["risk_flags"]) == 2
    assert len(brief["retrieved_docs"]) == 2


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_recommendation_logic_fail_means_revise(case: dict) -> None:
    """Any 'fail' status in compliance should produce 'revise'."""
    compliance = case["input"]["compliance_check"]
    has_fail = any(
        compliance.get(k, {}).get("status") == "fail" for k in ("brand_alignment", "disclaimers", "pricing_cross_check")
    )
    result = helpers.decide_recommendation(compliance, [])
    if has_fail:
        assert result == "revise", f"Had a fail but got '{result}'"
    else:
        assert result == "approve", f"No fails but got '{result}'"
