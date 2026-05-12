"""Workflow pipeline state for each persona."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api import state as state_mod

router = APIRouter(prefix="/workflow", tags=["workflow"])

# Canonical 10 step workflow. owner_persona_id is the dropdown id used by
# the frontend (or "all" / persona pair).
# For demo purposes, Merna (campaign-manager) acts as proxy for Marketing
# Leadership at step 1, the Approval committee at step 6, and the Media
# Coordinator at step 8. The display owner reflects the real world role; the
# acting persona id is who the GUI lets click the action button.
STEPS = [
    {
        "number": 1,
        "name": "Briefing",
        "owner": "Marketing Leadership (via Merna)",
        "owner_persona_id": "campaign-manager",
        "label": "HUMAN_ONLY",
    },
    {
        "number": 2,
        "name": "Segmentation",
        "owner": "Campaign Manager",
        "owner_persona_id": "campaign-manager",
        "label": "HUMAN_PLUS_AI",
    },
    {
        "number": 3,
        "name": "SKU Selection",
        "owner": "Campaign Manager",
        "owner_persona_id": "campaign-manager",
        "label": "HUMAN_PLUS_AI",
    },
    {
        "number": 4,
        "name": "Creative Production",
        "owner": "Senior Designer",
        "owner_persona_id": "senior-designer",
        "label": "HUMAN_PLUS_AI",
    },
    {
        "number": 5,
        "name": "Layout Assembly",
        "owner": "Senior Designer",
        "owner_persona_id": "senior-designer",
        "label": "HUMAN_PLUS_AI",
    },
    {
        "number": 6,
        "name": "Final Approval",
        "owner": "Campaign Manager + VP + Legal",
        "owner_persona_id": "campaign-manager",
        "label": "HUMAN_ONLY",
    },
    {
        "number": 7,
        "name": "Localization",
        "owner": "Production Artist",
        "owner_persona_id": "production-artist",
        "label": "FULLY_AUTOMATED",
    },
    {
        "number": 8,
        "name": "Activation",
        "owner": "Media Coordinator (via Merna)",
        "owner_persona_id": "campaign-manager",
        "label": "HUMAN_PLUS_AI",
    },
    {
        "number": 9,
        "name": "Monitoring",
        "owner": "Marketing Analyst",
        "owner_persona_id": "marketing-analyst",
        "label": "FULLY_AUTOMATED",
    },
    {
        "number": 10,
        "name": "Reporting",
        "owner": "Marketing Analyst",
        "owner_persona_id": "marketing-analyst",
        "label": "HUMAN_PLUS_AI",
    },
]

VALID_PERSONAS = {
    "campaign-manager",
    "senior-designer",
    "production-artist",
    "marketing-analyst",
}


@router.get("/{persona_id}")
def workflow_for_persona(persona_id: str) -> dict:
    """Return the 10 steps with statuses derived from live campaign state."""
    if persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=404, detail=f"unknown persona: {persona_id}")
    out = []
    for step in STEPS:
        out.append(
            {
                **step,
                "status": state_mod.status_for_step(state_mod.DEMO_CAMPAIGN_ID, step["number"]),
                "my_step": step["owner_persona_id"] == persona_id,
            }
        )
    return {"persona_id": persona_id, "steps": out}


# ---------- pre seeded campaigns ----------
#
# Static demo data so the dashboard feels populated across personas. The
# four skills always run against the real database; this list is purely
# for the "Campaigns" panel in the left sidebar so reviewers see a
# realistic mix of active, planned, and completed campaigns.

CAMPAIGNS = [
    {
        "id": "MDC-2026-MD-001",
        "name": "Mother's Day Beauty Event",
        "status": "active",
        "current_step": 4,
        "current_step_name": "Creative Production",
        "days_remaining": 12,
        "days_label": "12 days remaining",
        "owner_role": "Campaign Manager",
        "color_indicator": "green",
    },
    {
        "id": "MDC-2026-MS-002",
        "name": "Memorial Day Home Sale",
        "status": "planned",
        "current_step": 1,
        "current_step_name": "Briefing",
        "days_remaining": 28,
        "days_label": "Starts in 28 days",
        "owner_role": "Marketing leadership",
        "color_indicator": "yellow",
    },
    {
        "id": "MDC-2026-SS-003",
        "name": "Spring Style Refresh",
        "status": "completed",
        "current_step": 10,
        "current_step_name": "Reporting",
        "days_remaining": -14,
        "days_label": "Completed 14 days ago",
        "owner_role": "Marketing Analyst",
        "color_indicator": "gray",
    },
]

# Separate router with no prefix so the path is `/campaigns`, not
# `/workflow/campaigns`. main.py registers both routers.
campaigns_router = APIRouter(tags=["campaigns"])


def _merged_campaign(c: dict[str, Any]) -> dict[str, Any]:
    """Inject live state into the demo campaign so the sidebar reflects it."""
    if c["id"] != state_mod.DEMO_CAMPAIGN_ID:
        return c
    live = state_mod.get_state(c["id"])
    if not live:
        return c
    is_complete = live["is_complete"]
    if is_complete:
        return {
            **c,
            "current_step": state_mod.LAST_STEP,
            "current_step_name": "Complete",
            "status": "completed",
            "color_indicator": "gray",
            "days_label": "Campaign complete",
        }
    step = live["current_step"]
    return {
        **c,
        "current_step": step,
        "current_step_name": state_mod.STEP_NAMES.get(step, f"Step {step}"),
    }


@campaigns_router.get("/campaigns")
def list_campaigns() -> list[dict]:
    return [_merged_campaign(c) for c in CAMPAIGNS]


@campaigns_router.get("/campaigns/{campaign_id}/state")
def get_campaign_state(campaign_id: str) -> dict:
    s = state_mod.get_state(campaign_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"unknown campaign: {campaign_id}")
    return s


class AdvanceBody(BaseModel):
    step: int
    action: str
    # Either field is accepted; both feed state.step_outputs[step].
    step_output: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


@campaigns_router.post("/campaigns/{campaign_id}/advance")
def advance_campaign(campaign_id: str, body: AdvanceBody) -> dict:
    payload = body.step_output if body.step_output is not None else body.metadata
    try:
        return state_mod.advance(campaign_id, body.step, body.action, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@campaigns_router.get("/campaigns/{campaign_id}/context")
def campaign_context(campaign_id: str) -> dict:
    """Return everything the GUI needs to render rich step content.

    Includes the static campaign brief, the live state (with step_outputs
    accumulated as steps are completed), and the per-step mock data tables
    used for the steps that don't run a real skill.
    """
    s = state_mod.get_state(campaign_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"unknown campaign: {campaign_id}")
    return {
        "campaign_brief": state_mod.CAMPAIGN_BRIEF,
        "state": s,
        "mock_data": {
            "sku_suggestions": state_mod.MOCK_SKU_SUGGESTIONS,
            "layout_previews": state_mod.MOCK_LAYOUT_PREVIEWS,
            "approval_checkpoints": state_mod.MOCK_APPROVAL_CHECKPOINTS,
            "channel_schedule": state_mod.MOCK_CHANNEL_SCHEDULE,
            "executive_summary_template": state_mod.EXECUTIVE_SUMMARY_TEMPLATE,
        },
    }


@campaigns_router.post("/campaigns/{campaign_id}/reset")
def reset_campaign(campaign_id: str) -> dict:
    try:
        return state_mod.reset(campaign_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class RequestRevisionsBody(BaseModel):
    step: int
    send_back_to_step: int
    comment: str
    requested_by_persona_id: str = "campaign-manager"


@campaigns_router.post("/campaigns/{campaign_id}/request-revisions")
def request_revisions(campaign_id: str, body: RequestRevisionsBody) -> dict:
    try:
        return state_mod.request_revisions(
            campaign_id,
            body.step,
            body.send_back_to_step,
            body.comment,
            body.requested_by_persona_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@campaigns_router.post("/campaigns/{campaign_id}/resubmit/{step}")
def resubmit_step(campaign_id: str, step: int) -> dict:
    try:
        return state_mod.resubmit(campaign_id, step)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
