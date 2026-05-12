"""FastAPI app for Macy's marketing operations GUI.

Run from the repo root:
    uv run uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Load .env so TRITONAI_API_KEY is available at request time. Render injects
# env vars directly, so this is a no op in production, but it matters
# locally where uvicorn does not auto load .env on its own.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# M3 brain path setup. Must run before any 'from rag.', 'from tools.',
# or 'from orchestrator.' import below, since those packages now live
# under ../m3_brain/ rather than at the repo root.
_M3_BRAIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "m3_brain"))
if _M3_BRAIN_DIR not in sys.path:
    sys.path.insert(0, _M3_BRAIN_DIR)

from api._skill_loader import DB_PATH, IMAGES_DIR  # noqa: E402
from api.routes import chat, personas, skills, workflow  # noqa: E402

# Try to import the M3 skill invoker. If the M3 deps are missing on this
# host (sentence-transformers, faiss, openai, etc), the M2 endpoints still
# work and the AI endpoints return 503 with a clear error. The error is
# also logged to stderr at startup so it surfaces in the Render runtime
# log without needing to hit /health to see it.
try:
    from orchestrator.skill_invoker import invoke_skill as _invoke_skill  # noqa: E402

    _M3_AVAILABLE = True
    _M3_IMPORT_ERROR: str | None = None
except Exception as _exc:  # noqa: BLE001
    import traceback as _traceback

    _invoke_skill = None  # type: ignore[assignment]
    _M3_AVAILABLE = False
    _M3_IMPORT_ERROR = str(_exc)
    print(
        f"WARNING: M3 brain failed to import: {_exc}",
        file=sys.stderr,
        flush=True,
    )
    print(
        f"Traceback:\n{_traceback.format_exc()}",
        file=sys.stderr,
        flush=True,
    )


logger = logging.getLogger("macys.m3")
logging.basicConfig(level=logging.INFO)


app = FastAPI(
    title="Macy's Marketing Operations API",
    description=(
        "Local backend for the M2 GUI. Wraps the four skills in HTTP endpoints "
        "and serves persona, workflow, and scripted chat data. Also hosts the "
        "M3 AI endpoints (compliance, brief, revision routing, cascade) backed "
        "by the chained skills and RAG corpus in m3_brain/."
    ),
    version="0.2.0",
)

# CORS is intentionally wide open for the initial Render deploy so the
# frontend (Vercel URL not yet known) can reach the API. Lock this down to
# the actual Vercel origin once the deploy is live.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "db_exists": Path(DB_PATH).exists(),
        "images_dir_exists": Path(IMAGES_DIR).exists(),
        "m3_brain_available": _M3_AVAILABLE,
        "tritonai_key_set": bool(os.environ.get("TRITONAI_API_KEY", "")),
    }


@app.get("/api/health")
def health_api() -> dict:
    """Alias for /health under the /api/* prefix for frontend symmetry."""
    return health()


app.include_router(personas.router)
app.include_router(workflow.router)
app.include_router(workflow.campaigns_router)
app.include_router(skills.router)
app.include_router(chat.router)

# Static images (DAM thumbnails). Files live in data/images/dam/ but may not
# exist if download_images.py has not been run. Mount path is `/images`.
if Path(IMAGES_DIR).exists():
    app.mount(
        "/images/dam",
        StaticFiles(directory=str(IMAGES_DIR)),
        name="dam_images",
    )


# ===========================================================================
# M3 AI endpoints
#
# Each endpoint wraps a chained skill from m3_brain/. The skill invoker calls
# Claude via the TritonAI proxy, returns structured JSON, and the endpoint
# returns the relevant slice of that JSON to the client.
#
# All endpoints fail with 503 when:
#   * The m3_brain modules failed to import (missing deps).
#   * TRITONAI_API_KEY is unset or still a placeholder.
#   * The underlying skill raises.
# ===========================================================================


class CampaignContext(BaseModel):
    """Shared campaign payload used by every M3 endpoint."""

    campaign_id: str
    title: str
    audience_segment: str
    copy: str
    tagline: str | None = None
    skus: list[str]
    discount_pct: float
    regions: list[str]
    estimated_spend: float | None = None
    campaign_manager: str | None = None


class BriefRequest(CampaignContext):
    """Body for the approval brief generator endpoint.

    Inherits every field from CampaignContext so the frontend can post the
    same flat shape it uses for /api/ai/compliance, with one extra optional
    compliance_check field. Keeping the body flat matches the rest of the
    M3 endpoint family.
    """

    compliance_check: dict | None = None


class RevisionRequest(BaseModel):
    """Body for the revision router endpoint."""

    campaign_id: str
    revision_comment: str
    campaign_context: CampaignContext


class ApprovalCascadeRequest(BaseModel):
    """Body for the post approval cascade (localization plus scheduling)."""

    campaign_id: str
    approval_decision: str
    campaign_context: CampaignContext


class ChatMessage(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    """Body for the live AI chat endpoint."""

    message: str
    campaign_context: CampaignContext
    chat_history: list[ChatMessage] = []


def _check_ai_ready() -> None:
    """Raise 503 if the M3 brain or the TritonAI key are not available."""
    if not _M3_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI service temporarily unavailable",
                "detail": f"m3_brain failed to import: {_M3_IMPORT_ERROR}",
            },
        )
    api_key = os.environ.get("TRITONAI_API_KEY", "")
    if not api_key or api_key.startswith("your_") or api_key.startswith("placeholder"):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI service temporarily unavailable",
                "detail": "TRITONAI_API_KEY not configured on this deployment.",
            },
        )


def _build_state(campaign: CampaignContext, extra: dict | None = None) -> dict:
    """Build a fresh workflow state dict from a campaign context."""
    state = {
        "campaign_id": campaign.campaign_id,
        "status": "submitted_by_sarah",
        "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "campaign": campaign.model_dump(),
        "compliance_check": None,
        "approval_brief": None,
        "approval_decision": None,
        "revision_routing": None,
        "localized_variants": None,
        "activation_schedule": None,
    }
    if extra:
        state.update(extra)
    return state


async def _run_skill(skill_name: str, state: dict, campaign_id: str) -> dict:
    """Run a skill in a worker thread, log timing, return the updated state."""
    if _invoke_skill is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI service temporarily unavailable",
                "detail": f"m3_brain failed to import: {_M3_IMPORT_ERROR}",
            },
        )
    start = time.monotonic()
    try:
        updated = await asyncio.to_thread(_invoke_skill, skill_name, state)
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception(
            "M3 skill %s failed: campaign_id=%s duration_ms=%s",
            skill_name,
            campaign_id,
            duration_ms,
        )
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI service temporarily unavailable",
                "detail": f"Skill {skill_name} raised: {exc}",
            },
        ) from exc
    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info(
        "M3 skill %s ok: campaign_id=%s duration_ms=%s",
        skill_name,
        campaign_id,
        duration_ms,
    )
    return updated


@app.get("/api/ai/warmup")
async def ai_warmup() -> dict:
    """Pre warm the AI stack so user facing endpoints respond fast.

    Triggers lazy loading of the FAISS index and embedding model.
    Called by the frontend on page load. Safe to call multiple times.
    """
    if not _M3_AVAILABLE:
        return {"warmed": False, "reason": "m3 brain not available"}
    try:
        started = time.monotonic()
        from rag.retrieval import retrieve

        await asyncio.to_thread(retrieve, "warmup", k=1)
        elapsed = round(time.monotonic() - started, 2)
        return {"warmed": True, "elapsed_seconds": elapsed}
    except Exception as exc:  # noqa: BLE001
        return {"warmed": False, "error": str(exc)}


@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest) -> dict:
    """Live AI chat grounded in the campaign context and RAG corpus."""
    _check_ai_ready()

    from openai import OpenAI as _OpenAI
    from rag.retrieval import retrieve

    chunks = await asyncio.to_thread(retrieve, req.message, k=4)
    doc_ids = list({c.get("doc_id", "unknown") for c in chunks})
    docs_text = "\n\n".join(f"[{c.get('doc_id', 'unknown')}] {c.get('text', '')}" for c in chunks)
    campaign_json = req.campaign_context.model_dump_json(indent=2)

    system_prompt = (
        "You are an AI marketing coworker at Macys. You help campaign managers, "
        "VPs, and designers reason about campaigns. You have access to internal "
        "Macys policy documents and past campaign data through retrieval. "
        "Cite document IDs (like BRAND-GL-2026-001) when you reference internal "
        "policy. Keep responses concise, helpful, and grounded in the provided "
        "context and retrieved documents. Do not invent information."
    )

    user_content = (
        f"Question: {req.message}\n\n"
        f"Current campaign context:\n{campaign_json}\n\n"
        f"Relevant internal documents:\n{docs_text}"
    )

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for m in req.chat_history[-10:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": user_content})

    client = _OpenAI(
        api_key=os.environ["TRITONAI_API_KEY"],
        base_url="https://tritonai-api.ucsd.edu/v1",
    )
    response = await asyncio.to_thread(
        lambda: client.chat.completions.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            temperature=0.4,
            messages=messages,
        )
    )
    answer = response.choices[0].message.content or ""
    return {"response": answer, "retrieved_docs": doc_ids}


@app.post("/api/ai/compliance")
async def ai_compliance(campaign: CampaignContext) -> dict:
    """Run the compliance pre check skill on a submitted campaign."""
    _check_ai_ready()
    state = _build_state(campaign)
    updated = await _run_skill("compliance-pre-check", state, campaign.campaign_id)
    return updated.get("compliance_check") or {}


@app.post("/api/ai/brief")
async def ai_brief(req: BriefRequest) -> dict:
    """Generate the VP approval brief for a campaign that passed compliance."""
    _check_ai_ready()
    # Construct a plain CampaignContext from the request so the state's
    # 'campaign' field does not pick up the optional compliance_check.
    campaign = CampaignContext(**req.model_dump(exclude={"compliance_check"}))
    state = _build_state(
        campaign,
        extra={"compliance_check": req.compliance_check},
    )
    updated = await _run_skill(
        "approval-brief-generator",
        state,
        req.campaign_id,
    )
    return updated.get("approval_brief") or {}


@app.post("/api/ai/route-revision")
async def ai_route_revision(req: RevisionRequest) -> dict:
    """Classify and route a VP revision comment to the right owner."""
    _check_ai_ready()
    state = _build_state(
        req.campaign_context,
        extra={
            "approval_decision": "revise",
            "revision_comment": req.revision_comment,
        },
    )
    updated = await _run_skill("revision-router", state, req.campaign_id)
    return updated.get("revision_routing") or {}


@app.post("/api/ai/cascade")
async def ai_cascade(req: ApprovalCascadeRequest) -> dict:
    """Run localization plus activation scheduling after VP approval."""
    _check_ai_ready()
    if req.approval_decision != "approved":
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Bad request",
                "detail": (
                    f"ai_cascade only runs when approval_decision is 'approved'. Received {req.approval_decision!r}."
                ),
            },
        )
    state = _build_state(
        req.campaign_context,
        extra={"approval_decision": "approved", "status": "approved"},
    )
    state = await _run_skill("localization-generator", state, req.campaign_id)
    state = await _run_skill("activation-scheduler", state, req.campaign_id)
    variants = state.get("localized_variants")
    if isinstance(variants, dict) and "localized_variants" in variants:
        variants = variants["localized_variants"]
    return {
        "localized_variants": variants,
        "activation_schedule": state.get("activation_schedule"),
    }
