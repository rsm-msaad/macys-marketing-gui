"""Workflow pipeline state for each persona."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/workflow", tags=["workflow"])

# Canonical 10 step workflow. owner_persona_id is the dropdown id used by
# the frontend (or "all" / persona pair).
STEPS = [
    {"number": 1,  "name": "Briefing",            "owner": "Marketing leadership", "owner_persona_id": "leadership",        "label": "HUMAN_ONLY"},
    {"number": 2,  "name": "Segmentation",        "owner": "Campaign Manager",     "owner_persona_id": "campaign-manager",  "label": "HUMAN_PLUS_AI"},
    {"number": 3,  "name": "SKU Selection",       "owner": "Campaign Manager",     "owner_persona_id": "campaign-manager",  "label": "HUMAN_PLUS_AI"},
    {"number": 4,  "name": "Creative Production", "owner": "Senior Designer",      "owner_persona_id": "senior-designer",   "label": "HUMAN_PLUS_AI"},
    {"number": 5,  "name": "Layout Assembly",     "owner": "Senior Designer",      "owner_persona_id": "senior-designer",   "label": "HUMAN_PLUS_AI"},
    {"number": 6,  "name": "Approval",            "owner": "Campaign Manager + VP","owner_persona_id": "campaign-manager",  "label": "HUMAN_ONLY"},
    {"number": 7,  "name": "Localization",        "owner": "Production Artist",    "owner_persona_id": "production-artist", "label": "FULLY_AUTOMATED"},
    {"number": 8,  "name": "Activation",          "owner": "Media Coordinator",    "owner_persona_id": "media-coordinator", "label": "HUMAN_PLUS_AI"},
    {"number": 9,  "name": "Monitoring",          "owner": "Marketing Analyst",    "owner_persona_id": "marketing-analyst", "label": "FULLY_AUTOMATED"},
    {"number": 10, "name": "Reporting",           "owner": "Marketing Analyst",    "owner_persona_id": "marketing-analyst", "label": "HUMAN_PLUS_AI"},
]

# Demo state: campaign mid flight. Steps 1..3 done, 4 active, 5..10 pending.
STATUS_BY_STEP = {
    1: "complete",
    2: "complete",
    3: "complete",
    4: "active",
    5: "pending",
    6: "pending",
    7: "pending",
    8: "pending",
    9: "pending",
    10: "pending",
}

VALID_PERSONAS = {
    "campaign-manager",
    "senior-designer",
    "production-artist",
    "marketing-analyst",
}


@router.get("/{persona_id}")
def workflow_for_persona(persona_id: str) -> dict:
    if persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=404, detail=f"unknown persona: {persona_id}")
    out = []
    for step in STEPS:
        out.append(
            {
                **step,
                "status": STATUS_BY_STEP.get(step["number"], "pending"),
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


@campaigns_router.get("/campaigns")
def list_campaigns() -> list[dict]:
    return CAMPAIGNS
