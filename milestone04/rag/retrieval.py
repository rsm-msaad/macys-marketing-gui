"""RAG retrieval wrapper for M3 grading reference.

This file satisfies the expected milestone03/rag/retrieval.py path.
The production retrieval logic lives at ai_engine/rag/retrieval.py
and is re-exported here so both paths work.

Usage:
    from milestone03.rag.retrieval import retrieve
    results = retrieve("banned words and approved taglines", k=4)
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add ai_engine to path so we can import the production retrieval module.
_AI_ENGINE = str(Path(__file__).resolve().parents[2] / "ai_engine")
if _AI_ENGINE not in sys.path:
    sys.path.insert(0, _AI_ENGINE)

from rag.retrieval import retrieve, retrieve_by_doc_id  # noqa: E402, F401

__all__ = ["retrieve", "retrieve_by_doc_id"]
