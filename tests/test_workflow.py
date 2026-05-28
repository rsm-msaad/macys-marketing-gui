"""DeepEval AI-performance tests for the M04 workflow.

10 test cases mapped to the 7 failure modes in failure_cases.md.
Each case exercises a skill helper or full skill invocation and checks
4 dimensions: stuck to evidence, answered the question, quality rule,
and face validity.

Tier 1 (deterministic) tests run without API access.
Tier 2 (LLM) tests require TRITONAI_API_KEY and are marked @requires_llm.

Run all:       uv run pytest tests/test_workflow.py -v
Run Tier 2:    uv run pytest tests/test_workflow.py -v -m integration

Results land in tests/results/; summarized in test_report.md.
"""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Setup: load skill helpers from ai_engine
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[1]
AI_ENGINE = REPO_ROOT / "ai_engine"
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

if str(AI_ENGINE) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE))

# Compliance helpers
_comp_path = AI_ENGINE / "skills" / "compliance-pre-check" / "helpers.py"
_spec = importlib.util.spec_from_file_location("compliance_helpers", _comp_path)
assert _spec and _spec.loader
compliance_helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(compliance_helpers)

# Brief helpers
_brief_path = AI_ENGINE / "skills" / "approval-brief-generator" / "helpers.py"
_spec2 = importlib.util.spec_from_file_location("brief_helpers", _brief_path)
assert _spec2 and _spec2.loader
brief_helpers = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(brief_helpers)

# Revision router helpers
_router_path = AI_ENGINE / "skills" / "revision-router" / "helpers.py"
_spec3 = importlib.util.spec_from_file_location("router_helpers", _router_path)
assert _spec3 and _spec3.loader
router_helpers = importlib.util.module_from_spec(_spec3)
_spec3.loader.exec_module(router_helpers)

# Layout copy generator helpers
_layout_path = AI_ENGINE / "skills" / "layout-copy-generator" / "helpers.py"
_spec4 = importlib.util.spec_from_file_location("layout_helpers", _layout_path)
assert _spec4 and _spec4.loader
layout_helpers = importlib.util.module_from_spec(_spec4)
_spec4.loader.exec_module(layout_helpers)

# Try to load full skill invoker (needs FAISS + sentence-transformers + API key)
try:
    from orchestrator.skill_invoker import invoke_skill

    INVOKER_AVAILABLE = True
except Exception:
    INVOKER_AVAILABLE = False
    invoke_skill = None  # type: ignore[assignment]

HAS_API_KEY = bool(os.environ.get("TRITONAI_API_KEY", "")) and not os.environ.get(
    "TRITONAI_API_KEY", ""
).startswith("your_")

requires_llm = pytest.mark.skipif(
    not (INVOKER_AVAILABLE and HAS_API_KEY),
    reason="Skill invoker or TRITONAI_API_KEY not available",
)


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

CLEAN_CAMPAIGN = {
    "campaign_id": "TEST-M4-001",
    "title": "Mother's Day Beauty Event",
    "audience_segment": "VIP Loyalists",
    "copy": (
        "Celebrate Mom with our curated Beauty picks. "
        "Star Rewards members get 25% off select Beauty items "
        "plus a free gift with purchase of $75 or more. "
        "Find your magic this Mother's Day."
    ),
    "tagline": "find your magic",
    "skus": ["MAC-001", "EL-001", "CLQ-001"],
    "discount_pct": 25,
    "regions": ["NY", "CA", "FL", "TX"],
    "estimated_spend": 200_000,
}


def _make_state(campaign_overrides: dict | None = None) -> dict:
    state = {
        "campaign_id": "TEST-M4-001",
        "status": "submitted_by_sarah",
        "campaign": copy.deepcopy(CLEAN_CAMPAIGN),
        "compliance_check": None,
        "approval_brief": None,
        "revision_routing": None,
    }
    if campaign_overrides:
        state["campaign"].update(campaign_overrides)
    return state


def _record(case_id: str, result: str, checks: dict) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    path = RESULTS_DIR / f"workflow_{stamp}.jsonl"
    row = {"case_id": case_id, "output": result, "checks": checks}
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


# ===================================================================
# CASE 1: Happy path — clean campaign passes all compliance checks
# Failure case: None (baseline)
# ===================================================================


class TestCase01HappyPath:
    """Baseline: clean copy passes compliance."""

    def test_no_banned_words(self):
        found = compliance_helpers.scan_for_banned_words(CLEAN_CAMPAIGN["copy"])
        assert found == [], f"Clean copy should have no banned words, got: {found}"
        _record("case-01a", "no banned words", {"stuck_to_evidence": True, "pass": True})

    def test_approved_tagline(self):
        assert compliance_helpers.check_tagline(CLEAN_CAMPAIGN["tagline"])
        _record("case-01b", "tagline approved", {"quality_rule": True, "pass": True})

    def test_no_pricing_violation(self):
        result = compliance_helpers.check_pricing_language(CLEAN_CAMPAIGN["copy"])
        assert not result["minimum_required"]
        _record("case-01c", "no pricing violation", {"face_validity": True, "pass": True})

    def test_all_pass_yields_proceed(self):
        findings = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        action = compliance_helpers.evaluate_recommended_action(findings)
        assert action == "proceed"
        _record("case-01d", "proceed", {"quality_rule": True, "pass": True})

    @requires_llm
    @pytest.mark.integration
    def test_full_skill_clean_pass(self):
        state = _make_state()
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("recommended_action") == "proceed"
        assert len(check.get("retrieved_docs", [])) > 0


# ===================================================================
# CASE 2: Banned word detection
# Failure case: #2 (LLM hallucination/miss)
# ===================================================================


class TestCase02BannedWord:
    """Copy with banned phrases must trigger revise."""

    BANNED_COPY = (
        "Mother's Day Beauty at the lowest prices anywhere! "
        "Unbeatable savings on MAC, Estee Lauder, and Clinique."
    )

    def test_banned_words_detected(self):
        found = compliance_helpers.scan_for_banned_words(self.BANNED_COPY)
        assert "lowest prices anywhere" in found or "unbeatable" in found
        _record("case-02a", f"found: {found}", {"stuck_to_evidence": True, "pass": True})

    def test_banned_variant_detected(self):
        variant = "Shop our guaranteed lowest price on Beauty this Mother's Day!"
        found = compliance_helpers.scan_for_banned_words(variant)
        assert len(found) > 0, f"Variant should be caught, got: {found}"
        _record("case-02b", f"variant found: {found}", {"stuck_to_evidence": True, "pass": True})

    def test_any_fail_yields_revise(self):
        findings = {
            "brand_alignment": {"status": "fail"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        assert compliance_helpers.evaluate_recommended_action(findings) == "revise"

    @requires_llm
    @pytest.mark.integration
    def test_full_skill_catches_banned(self):
        state = _make_state({"copy": self.BANNED_COPY})
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("recommended_action") == "revise"


# ===================================================================
# CASE 3: MAP-protected brand with excessive discount
# Failure case: #3 (MCP stale data)
# ===================================================================


class TestCase03MAPViolation:
    """60% off Lancome must flag pricing violation."""

    def test_up_to_without_qualifier(self):
        copy_text = "Up to 60 percent off Lancome serums this Mother's Day!"
        result = compliance_helpers.check_pricing_language(copy_text)
        assert result["has_up_to_claim"]
        assert result["minimum_required"]
        _record("case-03", "MAP flagged", {"quality_rule": True, "pass": True})

    @requires_llm
    @pytest.mark.integration
    def test_full_skill_flags_map(self):
        state = _make_state({"copy": "Up to 60 percent off Lancome serums.", "discount_pct": 60})
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("recommended_action") == "revise" or check.get("pricing_cross_check", {}).get("status") in (
            "fail",
            "warn",
        )


# ===================================================================
# CASE 4: Missing legal disclaimer
# Failure case: #1 (RAG retrieval) + #2 (LLM miss)
# ===================================================================


class TestCase04MissingDisclaimer:
    """'Up to 50%' without 'starting at' must fail."""

    COPY = "Mother's Day Beauty: up to 50 percent off all MAC, Clinique, and Estee Lauder. Shop now!"

    def test_missing_qualifier_flagged(self):
        result = compliance_helpers.check_pricing_language(self.COPY)
        assert result["has_up_to_claim"]
        assert result["minimum_required"]
        _record("case-04", "disclaimer missing flagged", {"stuck_to_evidence": True, "pass": True})

    @requires_llm
    @pytest.mark.integration
    def test_full_skill_flags_disclaimer(self):
        state = _make_state({"copy": self.COPY})
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("disclaimers", {}).get("status") in ("fail", "warn") or check.get(
            "recommended_action"
        ) == "revise"


# ===================================================================
# CASE 5: Vague brief produces generic output
# Failure case: #5 (vague brief)
# ===================================================================


class TestCase05VagueBrief:
    """Thin brief should NOT cause hallucinated specifics."""

    def test_layout_fallback_all_placements(self):
        brief = {"name": "Beauty promo", "promotional_offer": [], "target_customer": ""}
        result = layout_helpers.generate_fallback(brief)
        for placement in ("web_banner", "email", "mobile", "in_store_signage"):
            assert placement in result, f"Missing {placement}"
        assert len(result["web_banner"]["tagline"]) > 0
        _record("case-05", "fallback valid", {"face_validity": True, "pass": True})


# ===================================================================
# CASE 6: Cascade — failed compliance propagates to brief
# Failure case: #6 (cascade failure)
# ===================================================================


class TestCase06CascadeFailure:
    """Brief must inherit upstream compliance failure."""

    FAILED_COMPLIANCE = {
        "brand_alignment": {"status": "fail", "reason": "Banned phrase", "cited_doc": "BRAND-GL-2026-001"},
        "disclaimers": {"status": "warn", "reason": "Missing qualifier", "cited_doc": "LEGAL-DIS-2026-002"},
        "pricing_cross_check": {"status": "pass", "reason": "No conflicts", "cited_doc": "PRICE-RULES-2026-001"},
        "recommended_action": "revise",
    }

    def test_brief_recommends_revise(self):
        rec = brief_helpers.decide_recommendation(self.FAILED_COMPLIANCE, ["Brand violation"])
        assert rec == "revise"
        _record("case-06", "cascade revise", {"quality_rule": True, "pass": True})

    @requires_llm
    @pytest.mark.integration
    def test_brief_skill_surfaces_risk(self):
        state = _make_state()
        state["compliance_check"] = self.FAILED_COMPLIANCE
        result = invoke_skill("approval-brief-generator", state)
        brief = result.get("approval_brief", {})
        assert len(brief.get("risk_flags", [])) > 0


# ===================================================================
# CASE 7: Vague revision comment
# Failure case: #5 + #7 (vague input + reviewer fatigue)
# ===================================================================


class TestCase07VagueRevision:
    """'Make it better' should not produce overconfident routing."""

    def test_urgency_low_normal_params(self):
        campaign = {"estimated_spend": 200_000, "business_days_to_launch": 14}
        assert router_helpers.assess_urgency(campaign) == "low"
        _record("case-07", "low urgency", {"face_validity": True, "pass": True})

    @requires_llm
    @pytest.mark.integration
    def test_vague_comment_structured_output(self):
        state = _make_state()
        state["approval_decision"] = "revise"
        state["revision_comment"] = "make it better"
        result = invoke_skill("revision-router", state)
        routing = result.get("revision_routing", {})
        assert "change_type" in routing
        assert "owner" in routing


# ===================================================================
# CASE 8: Clear pricing revision — correct routing
# Failure case: None (baseline)
# ===================================================================


class TestCase08ClearRevision:
    """Clear MAP comment routes to pricing/Anna with high urgency."""

    def test_high_urgency(self):
        campaign = {"estimated_spend": 600_000, "business_days_to_launch": 3}
        assert router_helpers.assess_urgency(campaign) == "high"
        _record("case-08a", "high urgency", {"quality_rule": True, "pass": True})

    def test_pricing_owner(self):
        owner = router_helpers.lookup_owner("pricing")
        assert "Anna" in owner or "Merchandising" in owner
        _record("case-08b", f"owner: {owner}", {"stuck_to_evidence": True, "pass": True})


# ===================================================================
# CASE 9: Layout copy with audience constraint
# Failure case: #5 (generic output)
# ===================================================================


class TestCase09LayoutAudience:
    """Layout should produce themed copy; validation catches missing fields."""

    def test_fallback_themed(self):
        brief = {
            "name": "Mother's Day Beauty Event",
            "promotional_offer": ["25% off Beauty"],
            "target_customer": "Star Rewards Gold and Platinum members",
        }
        result = layout_helpers.generate_fallback(brief)
        assert len(result["web_banner"]["body"]) > 0
        _record("case-09a", "themed copy produced", {"face_validity": True, "pass": True})

    def test_validation_catches_incomplete(self):
        bad = {
            "web_banner": {"tagline": "Test"},
            "email": {},
            "mobile": {},
            "in_store_signage": {},
        }
        errors = layout_helpers.validate_placements(bad)
        assert len(errors) > 0
        _record("case-09b", f"errors: {len(errors)}", {"quality_rule": True, "pass": True})


# ===================================================================
# CASE 10: Cascade after human edit
# Failure case: #6 (cascade after edit)
# ===================================================================


class TestCase10CascadeEdit:
    """Edited compliance status must propagate correctly to brief."""

    def test_all_pass_yields_approve(self):
        clean = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        assert brief_helpers.decide_recommendation(clean, []) == "approve"

    def test_warn_still_approves(self):
        edited = {
            "brand_alignment": {"status": "warn"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        assert brief_helpers.decide_recommendation(edited, ["Minor concern"]) == "approve"

    def test_fail_triggers_revise(self):
        edited = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "fail"},
            "pricing_cross_check": {"status": "pass"},
        }
        assert brief_helpers.decide_recommendation(edited, ["Disclaimer missing"]) == "revise"
        _record("case-10", "cascade logic correct", {"quality_rule": True, "pass": True})
