"""Persona metadata for the GUI's role selector and top bar."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/personas", tags=["personas"])

PERSONAS = [
    {
        "id": "campaign-manager",
        "title": "Campaign Manager",
        "name": "Merna",
        "initial": "M",
        "color": "#0B7B8A",
        "tagline": "Owns the brief, builds the audience, picks the SKUs.",
        "avatar": "/avatars/merna.png",
    },
    {
        "id": "senior-designer",
        "title": "Senior Designer",
        "name": "Abdullah",
        "initial": "A",
        "color": "#D4A537",
        "tagline": "Searches the DAM, picks hero photos, owns the layout.",
        "avatar": "/avatars/abdullah.png",
    },
    {
        "id": "production-artist",
        "title": "Production Artist",
        "name": "Shankar",
        "initial": "S",
        "color": "#87A96B",
        "tagline": "Spins up regional variants for every placement.",
        "avatar": "/avatars/shankar.png",
    },
    {
        "id": "marketing-analyst",
        "title": "Marketing Analyst",
        "name": "Anna",
        "initial": "A",
        "color": "#C84B4B",
        "tagline": "Pulls the data, runs attribution, drafts the readout.",
        "avatar": "/avatars/anna.png",
    },
    {
        "id": "ceo",
        "title": "Co-CEO",
        "name": "Prof. Vincent",
        "initial": "V",
        "color": "#6D28D9",
        "tagline": "Co-CEO with executive authority over campaign approvals and overrides.",
        "avatar": "/avatars/vincent.png",
    },
    {
        "id": "thales",
        "title": "Co-CEO",
        "name": "Prof. Thales",
        "initial": "T",
        "color": "#4338CA",
        "tagline": "Co-CEO with executive authority over campaign approvals and overrides.",
        "avatar": "/avatars/thales.png",
    },
]


@router.get("")
def list_personas() -> list[dict]:
    return PERSONAS
