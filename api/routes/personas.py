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
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face",
    },
    {
        "id": "senior-designer",
        "title": "Senior Designer",
        "name": "Priya",
        "initial": "P",
        "color": "#D4A537",
        "tagline": "Searches the DAM, picks hero photos, owns the layout.",
        "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face",
    },
    {
        "id": "production-artist",
        "title": "Production Artist",
        "name": "Diego",
        "initial": "D",
        "color": "#87A96B",
        "tagline": "Spins up regional variants for every placement.",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    },
    {
        "id": "marketing-analyst",
        "title": "Marketing Analyst",
        "name": "Anna",
        "initial": "A",
        "color": "#C84B4B",
        "tagline": "Pulls the data, runs attribution, drafts the readout.",
        "avatar": "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=200&h=200&fit=crop&crop=face",
    },
]


@router.get("")
def list_personas() -> list[dict]:
    return PERSONAS
