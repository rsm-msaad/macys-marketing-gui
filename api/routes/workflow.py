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
