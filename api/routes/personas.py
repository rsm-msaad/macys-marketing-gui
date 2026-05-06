"""Persona metadata for the GUI's role selector and top bar."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/personas", tags=["personas"])

PERSONAS = [
    {
        "id": "campaign-manager",
        "title": "Campaign Manager",
        "name": "Sarah",
        "initial": "S",
        "color": "#0B7B8A",
        "tagline": "Owns the brief, builds the audience, picks the SKUs.",
    },
    {
        "id": "senior-designer",
        "title": "Senior Designer",
        "name": "Priya",
        "initial": "P",
        "color": "#D4A537",
        "tagline": "Searches the DAM, picks hero photos, owns the layout.",
    },
    {
        "id": "production-artist",
        "title": "Production Artist",
        "name": "Diego",
        "initial": "D",
        "color": "#87A96B",
        "tagline": "Spins up regional variants for every placement.",
    },
    {
        "id": "marketing-analyst",
        "title": "Marketing Analyst",
        "name": "Anna",
        "initial": "A",
        "color": "#C84B4B",
        "tagline": "Pulls the data, runs attribution, drafts the readout.",
    },
]


@router.get("")
def list_personas() -> list[dict]:
    return PERSONAS
