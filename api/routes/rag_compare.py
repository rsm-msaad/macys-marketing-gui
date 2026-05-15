"""RAG comparison endpoint: naive vs HyQ side by side."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("macys.rag_compare")

router = APIRouter(prefix="/api/rag", tags=["rag"])


class CompareRequest(BaseModel):
    query: str


@router.post("/compare")
async def rag_compare(req: CompareRequest) -> dict:
    """Run the same query against naive RAG and HyQ RAG, return both."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query must not be empty")

    naive_results: list[dict] = []
    hyq_results: list[dict] = []
    naive_error: str | None = None
    hyq_error: str | None = None

    # Naive RAG
    try:
        from rag.retrieval import retrieve

        naive_results = await asyncio.to_thread(retrieve, query, k=4)
    except Exception as exc:
        logger.warning("Naive RAG failed: %s", exc)
        naive_error = str(exc)

    # HyQ RAG
    try:
        from rag.hyq.retrieval import retrieve_hyq

        hyq_results = await asyncio.to_thread(retrieve_hyq, query, k=4)
    except FileNotFoundError:
        hyq_error = "HyQ index not built yet. Run: uv run python ai_engine/rag/hyq/build_hyq_index.py"
    except Exception as exc:
        logger.warning("HyQ RAG failed: %s", exc)
        hyq_error = str(exc)

    return {
        "query": query,
        "naive_results": [
            {
                "doc_id": r.get("doc_id", ""),
                "section": r.get("section", ""),
                "chunk_text": (r.get("text", ""))[:300],
                "score": round(r.get("score", 0), 4),
            }
            for r in naive_results
        ],
        "naive_error": naive_error,
        "hyq_results": [
            {
                "doc_id": r.get("doc_id", ""),
                "section": r.get("section", ""),
                "chunk_text": (r.get("text", ""))[:300],
                "score": round(r.get("score", 0), 4),
                "matched_via": r.get("matched_via", "chunk"),
                "matched_question": r.get("matched_question"),
            }
            for r in hyq_results
        ],
        "hyq_error": hyq_error,
    }
