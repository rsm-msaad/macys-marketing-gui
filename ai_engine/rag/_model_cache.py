"""Shared SentenceTransformer model singleton.

Both the naive Retriever and HyQRetriever import this instead of each
creating their own model instance. Saves ~234 MB by avoiding a duplicate
load of the all-MiniLM-L6-v2 weights.
"""

from __future__ import annotations

from typing import Any

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_MODEL: Any = None


def get_embedding_model() -> Any:
    """Return the shared SentenceTransformer, loading it on first call."""
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer

        _MODEL = SentenceTransformer(MODEL_NAME)
    return _MODEL
