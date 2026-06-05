"""Tests for multi-campaign state: seeded completed/planned campaigns and workflow switching.

Only imports from api.state (no fastapi dependency needed).
"""

from api import state as state_mod

# ---------- Spring Beauty Refresh (completed) ----------


def test_spring_state_is_complete():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    assert s["is_complete"] is True
    assert s["completed_steps"] == list(range(1, 11))


def test_spring_campaign_id():
    assert state_mod.SPRING_CAMPAIGN_ID == "MDC-2025-SP-BTY"


def test_spring_has_all_step_outputs():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    for step_num in range(1, 11):
        assert str(step_num) in s["step_outputs"], f"Missing output for step {step_num}"


def test_spring_step4_has_dam_assets():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    step4 = s["step_outputs"]["4"]
    assert "dam_assets" in step4
    assert len(step4["dam_assets"]) == 6
    assert step4["dam_assets"][0]["quality_flag"] == "approved"


def test_spring_step6_has_compliance_and_approval():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    step6 = s["step_outputs"]["6"]
    assert "compliance" in step6
    assert step6["compliance"]["status"] == "pass"
    assert len(step6["compliance"]["checks"]) == 4
    assert "approval_brief" in step6
    assert (
        step6["approval_brief"]["budget_summary"]
        == "$250K total ($150K paid media, $60K store experience, $40K email/CRM)"
    )
    assert "routing" in step6
    assert step6["routing"]["decision"] == "Approved"
    assert step6["routing"]["revisions_needed"] is False


def test_spring_step7_has_localized_variants():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    step7 = s["step_outputs"]["7"]
    variants = step7["variants"]
    assert len(variants) == 4
    languages = {v["language"] for v in variants}
    assert "Spanish" in languages
    assert "French (Quebec)" in languages


def test_spring_step8_has_schedule():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    step8 = s["step_outputs"]["8"]
    assert len(step8["schedule"]) == 5


def test_spring_step9_has_performance():
    s = state_mod.get_state(state_mod.SPRING_CAMPAIGN_ID)
    assert s is not None
    step9 = s["step_outputs"]["9"]
    assert "totals" in step9
    assert step9["totals"]["revenue"] == "$682K"
    assert step9["totals"]["spend"] == "$250K"
    assert "learnings" in step9
    assert len(step9["learnings"]) > 0


def test_spring_brief_exists():
    b = state_mod.get_brief(state_mod.SPRING_CAMPAIGN_ID)
    assert b is not None
    assert b["name"] == "Spring Beauty Refresh"
    assert b["budget"]["total"] == "$250K"


# ---------- Summer Style (planned, partial progress) ----------


def test_summer_campaign_id():
    assert state_mod.SUMMER_CAMPAIGN_ID == "MDC-2026-SS-003"


def test_summer_state_partial_progress():
    s = state_mod.get_state(state_mod.SUMMER_CAMPAIGN_ID)
    assert s is not None
    assert s["is_complete"] is False
    assert s["current_step"] == 3
    assert s["completed_steps"] == [1, 2]


def test_summer_has_step_outputs_for_completed_steps():
    s = state_mod.get_state(state_mod.SUMMER_CAMPAIGN_ID)
    assert s is not None
    assert "1" in s["step_outputs"]
    assert "2" in s["step_outputs"]
    assert "3" not in s["step_outputs"]


def test_summer_brief_exists():
    b = state_mod.get_brief(state_mod.SUMMER_CAMPAIGN_ID)
    assert b is not None
    assert b["name"] == "Summer Style"
    assert b["budget"]["total"] == "$400K"


# ---------- Workflow step statuses per campaign ----------


def test_workflow_statuses_for_spring():
    """All 10 steps should show as complete for the Spring campaign."""
    for step_num in range(1, 11):
        status = state_mod.status_for_step(state_mod.SPRING_CAMPAIGN_ID, step_num)
        assert status == "complete", f"Step {step_num} should be complete, got {status}"


def test_workflow_statuses_for_summer():
    """Steps 1-2 complete, step 3 active, rest pending."""
    assert state_mod.status_for_step(state_mod.SUMMER_CAMPAIGN_ID, 1) == "complete"
    assert state_mod.status_for_step(state_mod.SUMMER_CAMPAIGN_ID, 2) == "complete"
    assert state_mod.status_for_step(state_mod.SUMMER_CAMPAIGN_ID, 3) == "active"
    assert state_mod.status_for_step(state_mod.SUMMER_CAMPAIGN_ID, 4) == "pending"
    assert state_mod.status_for_step(state_mod.SUMMER_CAMPAIGN_ID, 10) == "pending"


# ---------- Demo campaign not broken ----------


def test_demo_campaign_still_works():
    s = state_mod.get_state(state_mod.DEMO_CAMPAIGN_ID)
    assert s is not None
    assert s["is_complete"] is False
    assert s["current_step"] >= 1
    assert s["current_step"] <= 10


def test_demo_brief_still_exists():
    b = state_mod.get_brief(state_mod.DEMO_CAMPAIGN_ID)
    assert b is not None
    assert b["name"] == "Mother's Day Beauty Event"


# --- Target category drives SKU selection ---


def test_target_category_persists_on_step2_advance():
    """When step 2 advances with top_category, it is stored in state."""
    campaign_id = state_mod.DEMO_CAMPAIGN_ID
    state_mod.reset(campaign_id)
    state_mod.advance(campaign_id, 1, "Approve Brief")
    state_mod.advance(campaign_id, 2, "Approve Segment", {"name": "VIP Loyalists", "top_category": "Apparel"})
    cat = state_mod.get_target_category(campaign_id)
    assert cat == "Apparel"


def test_set_target_category():
    """set_target_category persists the category in state."""
    campaign_id = state_mod.DEMO_CAMPAIGN_ID
    state_mod.set_target_category(campaign_id, "Home")
    cat = state_mod.get_target_category(campaign_id)
    assert cat == "Home"


def test_target_category_fallback_to_step2_output():
    """get_target_category falls back to step_outputs['2']['top_category']."""
    campaign_id = state_mod.DEMO_CAMPAIGN_ID
    state_mod.reset(campaign_id)
    state_mod.advance(campaign_id, 1, "Approve Brief")
    state_mod.advance(campaign_id, 2, "Approve Segment", {"name": "Test", "top_category": "Accessories"})
    # Clear the explicit field to test the fallback
    with state_mod._LOCK:
        s = state_mod._STATE[campaign_id]
        s.pop("target_category", None)
    cat = state_mod.get_target_category(campaign_id)
    assert cat == "Accessories"
