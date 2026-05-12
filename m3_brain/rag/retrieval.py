"""
Retrieval for the Macys M3 RAG knowledge base.

Loads the FAISS index plus the chunks list produced by rag.build_index and
exposes two interfaces:

    Retriever         A class instance. Useful when you want explicit
                      control over loading and lifetime, for example in
                      tests that need to point at a different index dir.
    retrieve(...)     A module level function backed by a lazy singleton.
                      The skills import this.

Example:

    from rag.retrieval import retrieve

    results = retrieve("banned words and approved taglines", k=4)
    for r in results:
        print(r["doc_id"], r["section"], round(r["score"], 3))

If the index does not exist on disk yet, the first retrieve() call raises
FileNotFoundError with the build command in the message.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_INDEX_DIR = "rag/index"


def _resolve_index_dir(index_dir: str) -> Path:
    """Resolve index_dir relative to the repo root if it is a bare path."""
    candidate = Path(index_dir)
    if candidate.is_absolute():
        return candidate
    repo_root = Path(__file__).resolve().parent.parent
    return repo_root / index_dir


class Retriever:
    """FAISS backed retriever over the Macys knowledge base.

    Loads three artifacts produced by rag.build_index:
        index.faiss     The IndexFlatIP vector index
        chunks.json     The list of chunk dicts in vector order
        manifest.json   Build info (used to confirm dim matches the model)

    The embedding model is loaded lazily so import time stays cheap. The
    first retrieve() call pays the model load cost, subsequent calls reuse
    the cached model.
    """

    def __init__(self, index_dir: str = DEFAULT_INDEX_DIR) -> None:
        self.index_dir = _resolve_index_dir(index_dir)
        self._index: Optional[faiss.Index] = None
        self._chunks: Optional[list[dict]] = None
        self._model: Optional[SentenceTransformer] = None
        self._manifest: Optional[dict] = None

    def _ensure_loaded(self) -> None:
        """Load the index, chunks, and model if they are not already loaded."""
        if self._index is not None:
            return
        index_path = self.index_dir / "index.faiss"
        chunks_path = self.index_dir / "chunks.json"
        manifest_path = self.index_dir / "manifest.json"
        if not index_path.exists():
            raise FileNotFoundError(
                f"FAISS index not found at {index_path}. "
                "Build it first with: python -m rag.build_index"
            )
        if not chunks_path.exists():
            raise FileNotFoundError(
                f"chunks.json not found at {chunks_path}. "
                "Rebuild the index with: python -m rag.build_index"
            )
        self._index = faiss.read_index(str(index_path))
        self._chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
        if manifest_path.exists():
            self._manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self._model = SentenceTransformer(MODEL_NAME)

    def retrieve(
        self,
        query: str,
        k: int = 4,
        min_score: float = 0.3,
    ) -> list[dict]:
        """Return the top k chunks scoring above min_score for the query.

        Args:
            query: natural language query string.
            k: maximum number of results to pull from FAISS.
            min_score: minimum cosine similarity to keep. Results below
                this are dropped. Embeddings are normalized, so scores are
                cosine similarity values. Typical good matches score above
                0.4, weak matches under 0.3.

        Returns:
            A list of result dicts sorted by score descending. Each dict
            has the keys doc_id, filename, section, text, chunk_index,
            score. May be shorter than k if min_score filters results.
        """
        self._ensure_loaded()
        assert self._index is not None
        assert self._chunks is not None
        assert self._model is not None
        vector = self._model.encode(
            [query],
            normalize_embeddings=True,
            convert_to_numpy=True,
        ).astype("float32")
        scores, ids = self._index.search(vector, k)
        results: list[dict] = []
        for score, idx in zip(scores[0].tolist(), ids[0].tolist()):
            if idx < 0:
                continue
            if score < min_score:
                continue
            chunk = self._chunks[idx]
            results.append(
                {
                    "doc_id": chunk["doc_id"],
                    "filename": chunk["filename"],
                    "section": chunk["section"],
                    "text": chunk["text"],
                    "chunk_index": chunk["chunk_index"],
                    "score": float(score),
                }
            )
        return results

    def retrieve_by_doc_id(self, doc_id: str) -> list[dict]:
        """Return every chunk belonging to a specific Document ID.

        Useful when a skill knows it needs a full document end to end
        (for example, pulling the entire approval policy when the chain
        is adjudicating a high spend campaign). Results are returned in
        document order, no scoring applied.
        """
        self._ensure_loaded()
        assert self._chunks is not None
        return [
            {
                "doc_id": c["doc_id"],
                "filename": c["filename"],
                "section": c["section"],
                "text": c["text"],
                "chunk_index": c["chunk_index"],
            }
            for c in self._chunks
            if c["doc_id"] == doc_id
        ]


_SINGLETON: Optional[Retriever] = None


def _get_singleton() -> Retriever:
    """Return a process wide Retriever, creating it on first call."""
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = Retriever()
    return _SINGLETON


def retrieve(query: str, k: int = 4, min_score: float = 0.3) -> list[dict]:
    """Module level convenience function for skills to import.

    Equivalent to creating a Retriever and calling its retrieve method.
    The Retriever instance is cached at module level so repeated calls
    do not pay the load cost.

    Example:
        from rag.retrieval import retrieve
        hits = retrieve("MAP minimum advertised price restrictions", k=3)
    """
    return _get_singleton().retrieve(query, k=k, min_score=min_score)


def retrieve_by_doc_id(doc_id: str) -> list[dict]:
    """Module level convenience for fetching every chunk of a specific doc."""
    return _get_singleton().retrieve_by_doc_id(doc_id)
