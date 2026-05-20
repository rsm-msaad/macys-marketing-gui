"""Scripted Claude chat endpoint.

No LLM calls. The endpoint matches keywords in the message against a small
script per persona. Some replies include an `action` that the frontend uses
to open a skill modal pre-filled with the brief or campaign id.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/chat", tags=["chat"])

DEFAULT_BRIEF = "Mother's Day Beauty Event"
DEFAULT_SKUS = [4, 18]


class ChatBody(BaseModel):
    persona_id: str = Field(...)
    message: str = Field(...)


VALID_PERSONAS = {
    "campaign-manager",
    "senior-designer",
    "production-artist",
    "marketing-analyst",
}


def _match(message: str, *patterns: str) -> bool:
    msg = message.lower()
    return any(p in msg for p in patterns)


def _extract_brief(message: str) -> str:
    """Grab a quoted phrase as the brief, otherwise default."""
    quoted = re.search(r'["\']([^"\']{4,})["\']', message)
    if quoted:
        return quoted.group(1).strip()
    return DEFAULT_BRIEF


GREETING_BY_PERSONA = {
    "campaign-manager": (
        "Hi Merna. I can build segment options, pull active campaigns, or "
        "help you triage today. What would you like to tackle first?"
    ),
    "senior-designer": (
        "Hi Abdullah. I can search the DAM and rank assets by relevance, or show "
        "your blocked design queue. What do you need?"
    ),
    "production-artist": (
        "Hi Shankar. I can spin up the 40 regional variants for your master ad, "
        "or report on what's ready to ship. What would you like?"
    ),
    "marketing-analyst": (
        "Hi Anna. I can pull campaign performance, run attribution and forecast, "
        "or summarize a channel deep dive. Where should I start?"
    ),
}


def _campaign_manager(message: str) -> dict:
    if _match(message, "hi", "hello", "hey"):
        return {"response": GREETING_BY_PERSONA["campaign-manager"]}

    if _match(message, "segment", "audience", "who should i target", "build me an audience"):
        brief = _extract_brief(message)
        return {
            "response": (
                f"I can build segment options for that. Running the Audience Segment Builder against {brief!r} now."
            ),
            "action": "run_segment",
            "data": {"brief": brief},
        }

    if _match(message, "campaign", "active", "live"):
        return {
            "response": (
                "Three campaigns are live or imminent: Memorial Day Home Sale "
                "(live), Easter Family Style (live), Mother's Day Beauty Event "
                "(starts 2026-05-14). Want me to pull performance for any of "
                "them?"
            )
        }

    if _match(message, "today", "focus", "priorit"):
        return {
            "response": (
                "Today's queue: 1) finalize Mother's Day Beauty audience, "
                "2) review Spring Style Refresh brief from leadership, "
                "3) sign off on Easter regional copy variants."
            )
        }

    return {
        "response": (
            "I can help with audience segmentation, active campaign status, or "
            "your daily focus list. What would you like me to do?"
        )
    }


def _senior_designer(message: str) -> dict:
    if _match(message, "hi", "hello", "hey"):
        return {"response": GREETING_BY_PERSONA["senior-designer"]}

    if _match(message, "asset", "dam", "photo", "hero", "image"):
        brief = _extract_brief(message)
        return {
            "response": (
                f"Let me search the DAM. Filtering out degraded assets and ranking by relevance to {brief!r}."
            ),
            "action": "run_dam",
            "data": {"brief": brief, "max_results": 12},
        }

    if _match(message, "queue", "blocked", "waiting", "backlog"):
        return {
            "response": (
                "Three items blocked on you: 1) Mother's Day hero photo (waiting "
                "on legal review), 2) Spring Refresh banner set (needs Brand "
                "approval), 3) Easter social cuts (pending copy)."
            )
        }

    return {
        "response": (
            "I can search the DAM, surface clean reusable assets, or list your "
            "current design queue. What would you like to look at?"
        )
    }


def _production_artist(message: str) -> dict:
    if _match(message, "hi", "hello", "hey"):
        return {"response": GREETING_BY_PERSONA["production-artist"]}

    if _match(message, "variant", "regional", "localize", "localization", "spin up"):
        brief = _extract_brief(message)
        return {
            "response": (
                f"Generating regional variants for {brief!r} now. 10 regions x "
                f"4 placements = 40 variants per master SKU."
            ),
            "action": "run_localize",
            "data": {"brief": brief, "sku_ids": DEFAULT_SKUS},
        }

    if _match(message, "ready", "shipped", "done", "completed"):
        return {
            "response": (
                "40 of 40 Easter variants are ready. Memorial Day Home Sale: "
                "32 of 40 ready, 8 are on hold pending price approval."
            )
        }

    return {
        "response": (
            "I can spin up regional variants for an approved master ad, or "
            "report which variant batches are ready to ship. What do you need?"
        )
    }


def _marketing_analyst(message: str) -> dict:
    if _match(message, "hi", "hello", "hey"):
        return {"response": GREETING_BY_PERSONA["marketing-analyst"]}

    if _match(message, "performance", "analyze", "analyse", "readout", "report"):
        return {
            "response": (
                "Pulling campaign data. Running last touch attribution by "
                "channel and segment, plus a 14 day forecast with 80 percent "
                "confidence intervals."
            ),
            "action": "run_analyze",
            "data": {"campaign_id": 7, "forecast_days": 14},
        }

    if _match(message, "channel", "roas"):
        return {
            "response": (
                "Across the most recent completed campaign (Fall Style Edit), "
                "email leads at 56x ROAS, search at 20x, in-store at 13x. Paid "
                "social and display lag at 1.9x and 1.1x respectively."
            )
        }

    if _match(message, "forecast", "next 14", "next two weeks"):
        return {
            "response": (
                "The 14 day forecast on the latest campaign trends UP across "
                "revenue, conversions, and ROAS. 80 percent CI on revenue is "
                "$116K to $227K daily."
            )
        }

    if _match(message, "segment"):
        return {
            "response": (
                "Top segment is Platinum at +44 percent vs the campaign "
                "average unique buyer rate. Bronze is the laggard at -17 "
                "percent."
            )
        }

    return {
        "response": (
            "I can run the campaign performance analyzer, summarize channel "
            "ROAS, surface the forecast, or break out segments. What would "
            "help most?"
        )
    }


DISPATCH = {
    "campaign-manager": _campaign_manager,
    "senior-designer": _senior_designer,
    "production-artist": _production_artist,
    "marketing-analyst": _marketing_analyst,
}


@router.post("")
def chat(body: ChatBody) -> dict:
    if body.persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=400, detail=f"unknown persona: {body.persona_id}")
    handler = DISPATCH[body.persona_id]
    reply = handler(body.message)
    reply.setdefault("action", None)
    reply.setdefault("data", None)
    return reply
