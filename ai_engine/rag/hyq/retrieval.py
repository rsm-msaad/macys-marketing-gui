"""
HyQ (Hypothetical Queries) retrieval module.

Searches the HyQ FAISS index which contains embeddings of both raw chunks
and LLM generated hypothetical questions. Returns the underlying chunks
with metadata indicating whether the match came from a question or the
raw chunk text.

Example:
    from rag.hyq.retrieval import retrieve_hyq
    hits = retrieve_hyq("what disclaimer do I need for percent off claims", k=4)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_INDEX_DIR = Path(__file__).resolve().parent / "index"


class HyQRetriever:
    """FAISS retriever over the HyQ index (chunks + hypothetical questions)."""

    def __init__(self, index_dir: Path = DEFAULT_INDEX_DIR) -> None:
        self.index_dir = index_dir
        self._index: Optional[faiss.Index] = None
        self._entries: Optional[list[dict]] = None
        self._model: Optional[SentenceTransformer] = None

    def _ensure_loaded(self) -> None:
        if self._index is not None:
            return
        index_path = self.index_dir / "index.faiss"
        entries_path = self.index_dir / "entries.json"
        if not index_path.exists():
            raise FileNotFoundError(
                f"HyQ index not found at {index_path}. "
                "Build it first with: uv run python ai_engine/rag/hyq/build_hyq_index.py"
            )
        if not entries_path.exists():
            raise FileNotFoundError(
                f"HyQ entries not found at {entries_path}. "
                "Build it first with: uv run python ai_engine/rag/hyq/build_hyq_index.py"
            )
        self._index = faiss.read_index(str(index_path))
        self._entries = json.loads(entries_path.read_text(encoding="utf-8"))
        self._model = SentenceTransformer(MODEL_NAME)

    def retrieve(
        self,
        query: str,
        k: int = 4,
        min_score: float = 0.3,
    ) -> list[dict]:
        """Return the top k chunks scoring above min_score.

        Deduplicates by (doc_id, chunk_index) so the same chunk is not
        returned twice even if both the chunk embedding and a question
        embedding matched. The highest scoring match wins.

        Each result dict includes:
            doc_id, filename, section, text, chunk_index, score,
            matched_via ("chunk" or "question"),
            matched_question (the question text if matched_via is "question")
        """
        self._ensure_loaded()
        assert self._index is not None
        assert self._entries is not None
        assert self._model is not None

        vector = self._model.encode(
            [query],
            normalize_embeddings=True,
            convert_to_numpy=True,
        ).astype("float32")

        # Search more than k because we deduplicate
        raw_k = min(k * 3, self._index.ntotal)
        scores, ids = self._index.search(vector, raw_k)

        seen: dict[tuple[str, int], dict] = {}
        for score, idx in zip(scores[0].tolist(), ids[0].tolist()):
            if idx < 0 or score < min_score:
                continue
            entry = self._entries[idx]
            key = (entry["doc_id"], entry["chunk_index"])
            if key in seen and seen[key]["score"] >= score:
                continue
            seen[key] = {
                "doc_id": entry["doc_id"],
                "filename": entry["filename"],
                "section": entry["section"],
                "text": entry["text"],
                "chunk_index": entry["chunk_index"],
                "score": float(score),
                "matched_via": entry["type"],
                "matched_question": entry.get("question"),
            }

        results = sorted(seen.values(), key=lambda r: r["score"], reverse=True)
        return results[:k]


_SINGLETON: Optional[HyQRetriever] = None


def _get_singleton() -> HyQRetriever:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = HyQRetriever()
    return _SINGLETON


def retrieve_hyq(query: str, k: int = 4, min_score: float = 0.3) -> list[dict]:
    """Module level convenience function.

    Example:
        from rag.hyq.retrieval import retrieve_hyq
        hits = retrieve_hyq("Can I discount Coach bags?", k=3)
    """
    return _get_singleton().retrieve(query, k=k, min_score=min_score)
