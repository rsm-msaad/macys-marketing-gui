"""
Build the FAISS index for the Macys M3 RAG knowledge base.

Walks every markdown doc in rag/knowledge_base/ (skipping README.md),
splits each doc into chunks via rag.chunker, embeds the chunks with the
sentence_transformers model "all-MiniLM-L6-v2", and writes three
artifacts to rag/index/:

    index.faiss     The FAISS IndexFlatIP binary
    chunks.json     The chunk metadata in the same order as index vectors
    manifest.json   Build info (timestamp, model, total counts, doc IDs)

The index lives off git (see .gitignore). It rebuilds in under a minute
from the corpus, so we keep the source of truth in markdown.

CLI usage:
    python -m rag.build_index
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from rag.chunker import chunk_document

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def find_repo_root() -> Path:
    """Return the repo root inferred from this file's location."""
    return Path(__file__).resolve().parent.parent


def collect_chunks(kb_dir: Path) -> list[dict]:
    """Walk the knowledge base directory and chunk every markdown doc.

    Skips README.md (any casing) and any dotfiles. Sorts by filename so
    chunk ordering is stable across runs.
    """
    docs = sorted(p for p in kb_dir.glob("*.md") if p.name.lower() != "readme.md")
    all_chunks: list[dict] = []
    for doc in docs:
        all_chunks.extend(chunk_document(doc))
    return all_chunks


def embed_texts(model: SentenceTransformer, texts: list[str]) -> np.ndarray:
    """Embed a list of texts. Returns a float32 array of shape (n, dim).

    Embeddings are L2 normalized so an inner product index yields cosine
    similarity scores directly.
    """
    vectors = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return vectors.astype("float32")


def build_index(vectors: np.ndarray) -> faiss.Index:
    """Build a FAISS IndexFlatIP from a (n, dim) float32 matrix."""
    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(vectors)
    return index


def write_artifacts(
    index_dir: Path,
    index: faiss.Index,
    chunks: list[dict],
    model_name: str,
) -> dict:
    """Write index.faiss, chunks.json, and manifest.json. Return the manifest."""
    index_dir.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(index_dir / "index.faiss"))
    (index_dir / "chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    doc_ids = sorted({chunk["doc_id"] for chunk in chunks})
    manifest = {
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": model_name,
        "embedding_dim": int(index.d),
        "total_chunks": int(index.ntotal),
        "total_docs": len(doc_ids),
        "doc_ids": doc_ids,
    }
    (index_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def main() -> int:
    repo_root = find_repo_root()
    kb_dir = repo_root / "rag" / "knowledge_base"
    index_dir = repo_root / "rag" / "index"
    if not kb_dir.exists():
        print(f"Knowledge base not found at {kb_dir}", file=sys.stderr)
        return 1
    chunks = collect_chunks(kb_dir)
    if not chunks:
        print(f"No chunks produced from {kb_dir}", file=sys.stderr)
        return 1
    print(f"Loading embedding model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    print(f"Embedding {len(chunks)} chunks")
    vectors = embed_texts(model, [c["text"] for c in chunks])
    print(f"Building FAISS IndexFlatIP, dim={vectors.shape[1]}")
    index = build_index(vectors)
    manifest = write_artifacts(index_dir, index, chunks, MODEL_NAME)
    total_docs = manifest["total_docs"]
    total_chunks = manifest["total_chunks"]
    print(f"Indexed {total_docs} docs into {total_chunks} chunks, saved to rag/index/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
