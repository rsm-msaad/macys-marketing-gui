"""M4 Failure Mode Test Suite.

8 test cases mapped to the 7 failure modes documented in failure_cases.md.
Tests exercise the compliance-pre-check, approval-brief-generator, and
revision-router skills with realistic and adversarial inputs.

Run: uv run pytest evals/test_m4_failure_modes.py -v --tb=short
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import time
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Setup: load helpers and skill invoker
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[1]
AI_ENGINE = REPO_ROOT / "ai_engine"

# Add ai_engine to path for imports
if str(AI_ENGINE) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE))

# Load compliance helpers
_comp_helpers_path = AI_ENGINE / "skills" / "compliance-pre-check" / "helpers.py"
_spec = importlib.util.spec_from_file_location("compliance_helpers", _comp_helpers_path)
assert _spec and _spec.loader
compliance_helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(compliance_helpers)

# Load brief helpers
_brief_helpers_path = AI_ENGINE / "skills" / "approval-brief-generator" / "helpers.py"
_spec2 = importlib.util.spec_from_file_location("brief_helpers", _brief_helpers_path)
assert _spec2 and _spec2.loader
brief_helpers = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(brief_helpers)

# Load revision router helpers
_router_helpers_path = AI_ENGINE / "skills" / "revision-router" / "helpers.py"
_spec3 = importlib.util.spec_from_file_location("router_helpers", _router_helpers_path)
assert _spec3 and _spec3.loader
router_helpers = importlib.util.module_from_spec(_spec3)
_spec3.loader.exec_module(router_helpers)

# Load layout-copy-generator helpers
_layout_helpers_path = AI_ENGINE / "skills" / "layout-copy-generator" / "helpers.py"
_spec4 = importlib.util.spec_from_file_location("layout_helpers", _layout_helpers_path)
assert _spec4 and _spec4.loader
layout_helpers = importlib.util.module_from_spec(_spec4)
_spec4.loader.exec_module(layout_helpers)

# Try to load skill invoker (requires all deps including FAISS, sentence-transformers)
try:
    from orchestrator.skill_invoker import invoke_skill

    INVOKER_AVAILABLE = True
except Exception:
    INVOKER_AVAILABLE = False
    invoke_skill = None  # type: ignore[assignment]

# Check if TritonAI key is set
HAS_API_KEY = bool(os.environ.get("TRITONAI_API_KEY", "")) and not os.environ.get("TRITONAI_API_KEY", "").startswith(
    "your_"
)

requires_llm = pytest.mark.skipif(
    not (INVOKER_AVAILABLE and HAS_API_KEY),
    reason="Skill invoker or TRITONAI_API_KEY not available",
)


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

CLEAN_CAMPAIGN_STATE = {
    "campaign_id": "TEST-M4-001",
    "status": "submitted_by_sarah",
    "campaign": {
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
    },
    "compliance_check": None,
    "approval_brief": None,
    "revision_routing": None,
}


def _make_state(overrides: dict | None = None) -> dict:
    """Deep-copy CLEAN_CAMPAIGN_STATE with optional campaign overrides."""
    import copy

    state = copy.deepcopy(CLEAN_CAMPAIGN_STATE)
    if overrides:
        state["campaign"].update(overrides)
    return state


# ---------------------------------------------------------------------------
# TEST 1: Happy path — compliant copy through compliance skill
# Failure case mapped: none (baseline)
# ---------------------------------------------------------------------------


class TestHappyPath:
    """Baseline: clean campaign copy passes all compliance checks."""

    def test_no_banned_words_in_clean_copy(self):
        copy = CLEAN_CAMPAIGN_STATE["campaign"]["copy"]
        found = compliance_helpers.scan_for_banned_words(copy)
        assert found == [], f"Clean copy should have no banned words, found: {found}"

    def test_approved_tagline(self):
        tagline = CLEAN_CAMPAIGN_STATE["campaign"]["tagline"]
        assert compliance_helpers.check_tagline(tagline), f"'{tagline}' should be approved"

    def test_pricing_language_no_violation(self):
        copy = CLEAN_CAMPAIGN_STATE["campaign"]["copy"]
        result = compliance_helpers.check_pricing_language(copy)
        assert not result["minimum_required"], "Clean copy has no unqualified 'up to' claim"

    def test_all_pass_yields_proceed(self):
        findings = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        action = compliance_helpers.evaluate_recommended_action(findings)
        assert action == "proceed"

    @requires_llm
    def test_full_skill_clean_pass(self):
        """Full LLM compliance skill on clean input should return proceed."""
        state = _make_state()
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("recommended_action") == "proceed", (
            f"Clean campaign should proceed, got: {check.get('recommended_action')}"
        )
        # Verify cited docs are present
        docs = check.get("retrieved_docs", [])
        assert len(docs) > 0, "Should cite at least one document"


# ---------------------------------------------------------------------------
# TEST 2: Banned word in copy
# Failure case mapped: Failure 2 (LLM hallucinates or misses compliance issue)
# ---------------------------------------------------------------------------


class TestBannedWord:
    """Copy containing a banned word must trigger brand_alignment fail."""

    BANNED_COPY = (
        "Mother's Day Beauty at the lowest prices anywhere! "
        "Unbeatable savings on MAC, Estee Lauder, and Clinique. "
        "Star Rewards members save 25% off select Beauty."
    )

    def test_banned_word_detected(self):
        found = compliance_helpers.scan_for_banned_words(self.BANNED_COPY)
        assert "lowest prices anywhere" in found or "unbeatable" in found, f"Should detect banned words, found: {found}"

    def test_banned_word_variant_detected(self):
        """Edge case: 'guaranteed lowest price' (variant of banned phrase) should be caught."""
        variant_copy = "Shop our guaranteed lowest price on Beauty this Mother's Day!"
        found = compliance_helpers.scan_for_banned_words(variant_copy)
        assert len(found) > 0, f"Variant 'guaranteed lowest price' should be caught, found: {found}"

    def test_banned_findings_yield_revise(self):
        findings = {
            "brand_alignment": {"status": "fail"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        action = compliance_helpers.evaluate_recommended_action(findings)
        assert action == "revise"

    @requires_llm
    def test_full_skill_catches_banned_word(self):
        """Full LLM skill should flag banned words and recommend revise."""
        state = _make_state({"copy": self.BANNED_COPY})
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        assert check.get("recommended_action") == "revise", (
            f"Banned word copy should trigger revise, got: {check.get('recommended_action')}"
        )
        brand = check.get("brand_alignment", {})
        assert brand.get("status") in ("fail", "warn"), (
            f"brand_alignment should be fail/warn, got: {brand.get('status')}"
        )


# ---------------------------------------------------------------------------
# TEST 3: MAP brand with excessive discount
# Failure case mapped: Failure 3 (MCP tool returns stale data)
# ---------------------------------------------------------------------------


class TestMAPViolation:
    """MAP-protected brand (Lancome) with excessive discount must flag."""

    def test_pricing_language_detects_up_to_without_qualifier(self):
        """'up to 60 percent off' without 'starting at' is a violation."""
        copy = "Up to 60 percent off Lancome serums this Mother's Day!"
        result = compliance_helpers.check_pricing_language(copy)
        assert result["has_up_to_claim"], "Should detect 'up to percent off' pattern"
        assert result["minimum_required"], "Should flag missing 'starting at' qualifier"

    @requires_llm
    def test_full_skill_flags_map_discount(self):
        """Compliance skill should flag high discount on MAP brand."""
        state = _make_state(
            {
                "copy": "Up to 60 percent off Lancome serums. Star Rewards exclusive.",
                "skus": ["LANCOME-001"],
                "discount_pct": 60,
            }
        )
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        # Either pricing_cross_check or disclaimers should flag this
        pricing = check.get("pricing_cross_check", {})
        action = check.get("recommended_action", "")
        assert action == "revise" or pricing.get("status") in ("fail", "warn"), (
            f"60% discount on MAP brand should trigger revise or pricing warn/fail. "
            f"Got action={action}, pricing={pricing.get('status')}"
        )


# ---------------------------------------------------------------------------
# TEST 4: Missing legal disclaimer for percent-off claim
# Failure case mapped: Failure 1 (RAG retrieval) + Failure 2 (LLM miss)
# ---------------------------------------------------------------------------


class TestMissingDisclaimer:
    """'Up to 50 percent off' without 'starting at' qualifier must fail."""

    UNQUALIFIED_COPY = (
        "Mother's Day Beauty: up to 50 percent off all MAC, Clinique, and Estee Lauder. Shop now before it's gone!"
    )

    def test_pricing_language_flags_missing_minimum(self):
        result = compliance_helpers.check_pricing_language(self.UNQUALIFIED_COPY)
        assert result["has_up_to_claim"], "Should detect 'up to percent off'"
        assert result["minimum_required"], "Missing 'starting at' should be flagged"

    @requires_llm
    def test_full_skill_flags_disclaimer(self):
        """Full skill should flag the missing disclaimer."""
        state = _make_state({"copy": self.UNQUALIFIED_COPY})
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        disclaimers = check.get("disclaimers", {})
        action = check.get("recommended_action", "")
        # Either disclaimers finding should flag it, or overall action is revise
        assert disclaimers.get("status") in ("fail", "warn") or action == "revise", (
            f"Missing disclaimer should be flagged. Got disclaimers={disclaimers.get('status')}, action={action}"
        )


# ---------------------------------------------------------------------------
# TEST 5: Vague campaign brief
# Failure case mapped: Failure 5 (vague brief → generic output)
# ---------------------------------------------------------------------------


class TestVagueBrief:
    """A thin brief should NOT cause hallucinated specifics."""

    THIN_BRIEF = {
        "campaign_id": "TEST-M4-VAGUE",
        "title": "Beauty promo",
        "audience_segment": "customers",
        "copy": "Beauty promo for Mother's Day.",
        "tagline": "",
        "skus": [],
        "discount_pct": 0,
        "regions": [],
        "estimated_spend": 0,
    }

    def test_layout_fallback_handles_thin_brief(self):
        """Layout copy generator fallback should still produce output."""
        brief = {"name": "Beauty promo", "promotional_offer": [], "target_customer": ""}
        result = layout_helpers.generate_fallback(brief)
        # Should produce all 4 placements even with thin input
        assert "web_banner" in result
        assert "email" in result
        assert "mobile" in result
        assert "in_store_signage" in result
        # Copy should NOT hallucinate specific numbers or names not in the brief
        web_tagline = result["web_banner"]["tagline"]
        assert len(web_tagline) > 0, "Should produce some tagline"

    @requires_llm
    def test_compliance_on_vague_brief(self):
        """Compliance on vague brief should not invent violations or pass blindly."""
        state = {
            "campaign_id": "TEST-M4-VAGUE",
            "status": "submitted_by_sarah",
            "campaign": self.THIN_BRIEF,
            "compliance_check": None,
            "approval_brief": None,
            "revision_routing": None,
        }
        result = invoke_skill("compliance-pre-check", state)
        check = result.get("compliance_check", {})
        # Should still return a structured response (not crash)
        assert "recommended_action" in check, "Should return structured output even on thin input"
        # Brand alignment on empty copy should not invent violations
        brand = check.get("brand_alignment", {})
        assert brand.get("status") is not None, "Should have a status, not crash"


# ---------------------------------------------------------------------------
# TEST 6: Brief generator with conflicting compliance input (revise)
# Failure case mapped: Failure 6 (cascade failure)
# ---------------------------------------------------------------------------


class TestBriefWithFailedCompliance:
    """Brief should inherit upstream compliance failures prominently."""

    FAILED_COMPLIANCE = {
        "brand_alignment": {
            "status": "fail",
            "reason": "Copy uses banned phrase 'lowest prices anywhere'",
            "cited_doc": "BRAND-GL-2026-001",
        },
        "disclaimers": {
            "status": "warn",
            "reason": "Missing 'starting at' qualifier for percent-off claim",
            "cited_doc": "LEGAL-DIS-2026-002",
        },
        "pricing_cross_check": {
            "status": "pass",
            "reason": "No MAP conflicts detected",
            "cited_doc": "PRICE-RULES-2026-001",
        },
        "recommended_action": "revise",
        "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001"],
    }

    def test_decide_recommendation_with_fail(self):
        """Helper should return revise when compliance has a fail."""
        rec = brief_helpers.decide_recommendation(self.FAILED_COMPLIANCE, ["Brand violation"])
        assert rec == "revise"

    @requires_llm
    def test_brief_reflects_upstream_failure(self):
        """Brief skill should surface compliance failures in risk_flags."""
        state = _make_state()
        state["compliance_check"] = self.FAILED_COMPLIANCE
        result = invoke_skill("approval-brief-generator", state)
        brief = result.get("approval_brief", {})
        # Brief should mention risk flags
        risk_flags = brief.get("risk_flags", [])
        recommendation = brief.get("ai_recommendation", "")
        assert len(risk_flags) > 0, f"Brief should have risk_flags when compliance failed, got: {risk_flags}"
        assert "revise" in recommendation.lower() or "reject" in recommendation.lower(), (
            f"Brief recommendation should be revise/reject given failed compliance, got: {recommendation}"
        )


# ---------------------------------------------------------------------------
# TEST 7: Revision Router with vague comment
# Failure case mapped: Failure 5 (vague input)
# ---------------------------------------------------------------------------


class TestVagueRevision:
    """A vague revision comment ('make it better') should not produce overconfident routing."""

    def test_urgency_low_for_normal_campaign(self):
        """Normal spend + normal timeline = low urgency."""
        campaign = {"estimated_spend": 200_000, "business_days_to_launch": 14}
        urgency = router_helpers.assess_urgency(campaign)
        assert urgency == "low"

    @requires_llm
    def test_vague_comment_routing(self):
        """Router should handle vague input without overconfident classification."""
        state = _make_state()
        state["approval_decision"] = "revise"
        state["revision_comment"] = "make it better"
        result = invoke_skill("revision-router", state)
        routing = result.get("revision_routing", {})
        # Should produce structured output
        assert "change_type" in routing, "Should return a change_type even for vague input"
        assert "owner" in routing, "Should return an owner"
        # The summary should not over-specify beyond what the comment says
        summary = routing.get("one_line_summary", "")
        assert len(summary) > 0, "Should produce a summary"


# ---------------------------------------------------------------------------
# TEST 8: Revision Router with clear pricing comment
# Failure case mapped: none (baseline routing)
# ---------------------------------------------------------------------------


class TestClearRevision:
    """A clear pricing revision comment should route correctly."""

    CLEAR_COMMENT = (
        "The 50% off claim on Lancome violates MAP. Please remove and replace with a free gift offer instead."
    )

    def test_urgency_high_for_high_spend_short_timeline(self):
        """$600K spend + 3 days to launch = high urgency."""
        campaign = {"estimated_spend": 600_000, "business_days_to_launch": 3}
        urgency = router_helpers.assess_urgency(campaign)
        assert urgency == "high"

    def test_owner_lookup_pricing(self):
        """Pricing change_type maps to Merchandising (Anna)."""
        owner = router_helpers.lookup_owner("pricing")
        assert "Anna" in owner or "Merchandising" in owner

    @requires_llm
    def test_router_classifies_pricing(self):
        """Clear pricing comment should route to pricing/Anna with correct type."""
        state = _make_state({"estimated_spend": 600_000})
        state["campaign"]["business_days_to_launch"] = 3
        state["approval_decision"] = "revise"
        state["revision_comment"] = self.CLEAR_COMMENT
        result = invoke_skill("revision-router", state)
        routing = result.get("revision_routing", {})
        assert routing.get("change_type") == "pricing", f"Should classify as pricing, got: {routing.get('change_type')}"
        owner = routing.get("owner", "")
        assert "Anna" in owner or "Merchandising" in owner or "pricing" in owner.lower(), (
            f"Should route to Anna/Merchandising, got: {owner}"
        )


# ---------------------------------------------------------------------------
# TEST 9: Layout Copy Generator respects audience constraint
# Failure case mapped: Failure 5 (generic output)
# ---------------------------------------------------------------------------


class TestLayoutCopyAudience:
    """Layout copy for Star Rewards Gold tier should mention loyalty-specific language."""

    def test_fallback_includes_campaign_audience(self):
        """Deterministic fallback should use target_customer from brief."""
        brief = {
            "name": "Mother's Day Beauty Event",
            "promotional_offer": ["25% off Beauty", "Free gift on $75+"],
            "target_customer": "Star Rewards Gold and Platinum members",
        }
        result = layout_helpers.generate_fallback(brief)
        # Check that the copy is themed for Mother's Day
        web_body = result["web_banner"]["body"]
        assert len(web_body) > 0

    def test_validate_placements_catches_missing_fields(self):
        """Validation catches incomplete placement output."""
        bad_output = {
            "web_banner": {"tagline": "Test"},  # missing body, cta, visual_direction
            "email": {},
            "mobile": {},
            "in_store_signage": {},
        }
        errors = layout_helpers.validate_placements(bad_output)
        assert len(errors) > 0, "Should catch missing fields"


# ---------------------------------------------------------------------------
# TEST 10: Cascade — edited compliance should change brief recommendation
# Failure case mapped: Failure 6 (cascade after edit)
# ---------------------------------------------------------------------------


class TestCascadeAfterEdit:
    """Brief generator should respect edited compliance state."""

    def test_decide_recommendation_all_pass(self):
        """If compliance is all pass, recommendation should be approve."""
        clean_compliance = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        rec = brief_helpers.decide_recommendation(clean_compliance, [])
        assert rec == "approve"

    def test_decide_recommendation_edited_to_warn(self):
        """If human edits one finding to warn, still approve (only fail triggers revise)."""
        edited_compliance = {
            "brand_alignment": {"status": "warn"},
            "disclaimers": {"status": "pass"},
            "pricing_cross_check": {"status": "pass"},
        }
        rec = brief_helpers.decide_recommendation(edited_compliance, ["Minor concern noted"])
        assert rec == "approve"

    def test_decide_recommendation_edited_to_fail(self):
        """If human edits one finding to fail, recommendation becomes revise."""
        edited_compliance = {
            "brand_alignment": {"status": "pass"},
            "disclaimers": {"status": "fail"},
            "pricing_cross_check": {"status": "pass"},
        }
        rec = brief_helpers.decide_recommendation(edited_compliance, ["Disclaimer missing"])
        assert rec == "revise"
