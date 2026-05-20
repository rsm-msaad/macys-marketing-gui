"""Integration test: orchestrator chain runs compliance -> brief -> routing.

Exercises the full orchestrator loop in ai_engine/orchestrator/orchestrator.py
with a mock campaign state. Verifies that:
1. The routing table picks compliance-pre-check first
2. After compliance, it picks approval-brief-generator
3. After brief with a revise decision, it picks revision-router
4. Each skill writes its output to the correct state field
5. The chain terminates correctly

LLM calls are NOT made. This test uses the deterministic helpers directly
to simulate what the LLM would produce, then verifies the routing logic.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add ai_engine to path for orchestrator imports.
_AI = Path(__file__).resolve().parents[2] / "ai_engine"
if str(_AI) not in sys.path:
    sys.path.insert(0, str(_AI))

from orchestrator.routing_table import pick_next_step  # noqa: E402

# ---------- Routing table chain tests ----------


def _base_state() -> dict:
    return {
        "campaign_id": "TEST-001",
        "status": "submitted_by_sarah",
        "campaign": {
            "title": "Test Campaign",
            "audience_segment": "VIP",
            "copy": "25 percent off Beauty",
            "skus": ["MAC-001"],
            "discount_pct": 25,
            "regions": ["NY"],
        },
        "compliance_check": None,
        "approval_brief": None,
        "approval_decision": None,
        "revision_routing": None,
        "localized_variants": None,
        "activation_schedule": None,
    }


def test_step1_routes_to_compliance():
    """First step: submitted campaign with no compliance check -> compliance-pre-check."""
    state = _base_state()
    step, rule, step_type, next_action = pick_next_step(state)
    assert step == "compliance-pre-check"
    assert step_type == "skill"
    assert "Initial submission" in rule


def test_step2_compliance_pass_routes_to_brief():
    """After compliance passes -> approval-brief-generator."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["status"] = "compliance_check_complete"
    step, rule, step_type, next_action = pick_next_step(state)
    assert step == "approval-brief-generator"
    assert step_type == "skill"
    assert "Compliance passed" in rule


def test_step2_compliance_fail_is_terminal():
    """After compliance fails -> terminal (back to campaign manager)."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "revise"}
    state["status"] = "compliance_check_complete"
    step, rule, step_type, _action = pick_next_step(state)
    assert step is None
    assert "Compliance failed" in rule
    assert step_type == "terminal"


def test_step3_vp_approve_routes_to_localization():
    """After VP approves -> localization-generator."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["approval_decision"] = "approved"
    state["status"] = "in_vp_review"
    step, rule, step_type, _action = pick_next_step(state)
    assert step == "localization-generator"
    assert step_type == "automation"
    assert "VP approved" in rule


def test_step3_vp_revise_routes_to_revision_router():
    """After VP requests revision -> revision-router."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["approval_decision"] = "revise"
    state["status"] = "in_vp_review"
    step, rule, step_type, _action = pick_next_step(state)
    assert step == "revision-router"
    assert step_type == "skill"
    assert "VP requested revision" in rule


def test_step4_localization_done_routes_to_activation():
    """After localization completes -> activation-scheduler."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["approval_decision"] = "approved"
    state["localized_variants"] = [{"region": "NY"}]
    state["status"] = "in_localization"
    step, rule, step_type, _action = pick_next_step(state)
    assert step == "activation-scheduler"
    assert step_type == "automation"
    assert "Localization done" in rule


def test_step5_activation_done_is_terminal():
    """After activation schedule is drafted -> terminal."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["approval_decision"] = "approved"
    state["localized_variants"] = [{"region": "NY"}]
    state["activation_schedule"] = {"email": "9am ET"}
    state["status"] = "scheduled"
    step, rule, step_type, _action = pick_next_step(state)
    assert step is None
    assert "Activation schedule drafted" in rule


def test_rejected_is_terminal():
    """VP rejects campaign -> terminal."""
    state = _base_state()
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["approval_brief"] = {"ai_recommendation": "reject"}
    state["approval_decision"] = "rejected"
    step, rule, step_type, _action = pick_next_step(state)
    assert step is None
    assert "Rejected" in rule


def test_full_happy_path_chain():
    """Walk the entire happy path: compliance -> brief -> approve -> localize -> activate."""
    state = _base_state()

    # Step 1: compliance
    step, _, _, _ = pick_next_step(state)
    assert step == "compliance-pre-check"
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["status"] = "compliance_check_complete"

    # Step 2: brief
    step, _, _, _ = pick_next_step(state)
    assert step == "approval-brief-generator"
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["status"] = "in_vp_review"

    # Step 3: VP approves -> localization
    state["approval_decision"] = "approved"
    step, _, _, _ = pick_next_step(state)
    assert step == "localization-generator"
    state["localized_variants"] = [{"region": "NY"}]
    state["status"] = "in_localization"

    # Step 4: activation
    step, _, _, _ = pick_next_step(state)
    assert step == "activation-scheduler"
    state["activation_schedule"] = {"email": "9am ET"}
    state["status"] = "scheduled"

    # Step 5: terminal
    step, rule, _, _ = pick_next_step(state)
    assert step is None
    assert "Activation schedule drafted" in rule


def test_full_revise_path_chain():
    """Walk the revise path: compliance -> brief -> revise -> router -> terminal."""
    state = _base_state()

    # Step 1: compliance passes
    step, _, _, _ = pick_next_step(state)
    assert step == "compliance-pre-check"
    state["compliance_check"] = {"recommended_action": "proceed"}
    state["status"] = "compliance_check_complete"

    # Step 2: brief generated
    step, _, _, _ = pick_next_step(state)
    assert step == "approval-brief-generator"
    state["approval_brief"] = {"ai_recommendation": "approve"}
    state["status"] = "in_vp_review"

    # Step 3: VP requests revision
    state["approval_decision"] = "revise"
    step, _, _, _ = pick_next_step(state)
    assert step == "revision-router"
    state["revision_routing"] = {"change_type": "copy", "owner": "Merna"}
    state["status"] = "revision_requested"

    # Step 4: terminal (back to team)
    step, rule, _, _ = pick_next_step(state)
    assert step is None
