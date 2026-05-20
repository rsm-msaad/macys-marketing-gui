"""
Build the HyQ (Hypothetical Queries) FAISS index.

For each chunk in the existing naive RAG index, calls Claude via TritonAI
to generate 3 to 5 hypothetical questions that the chunk could answer.
Then embeds both the original chunk texts AND the generated questions,
storing them together in a single FAISS IndexFlatIP.

At retrieval time, user queries match against question embeddings (which
are phrased like the user would naturally ask) rather than only raw
document prose, improving recall on intent driven queries.

CLI usage:
    uv run python ai_engine/rag/hyq/build_hyq_index.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT.parent / ".env")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CLAUDE_MODEL = "api-llama-4-scout"
TRITONAI_BASE_URL = "https://tritonai-api.ucsd.edu/v1"
INDEX_DIR = Path(__file__).resolve().parent / "index"
NAIVE_INDEX_DIR = REPO_ROOT / "rag" / "index"

QUESTION_PROMPT = (
    "You are generating hypothetical questions that a user might ask "
    "which the following text chunk could answer. Generate 3 to 5 "
    "questions. Be specific and grounded in the text. "
    "Output a JSON array of question strings only, no preamble, no "
    'markdown fences. Example: ["What is...?", "How does...?"]'
)


def load_naive_chunks() -> list[dict]:
    """Load chunks from the naive RAG index."""
    chunks_path = NAIVE_INDEX_DIR / "chunks.json"
    if not chunks_path.exists():
        raise FileNotFoundError(
            f"Naive index chunks not found at {chunks_path}. Build it first with: python -m rag.build_index"
        )
    return json.loads(chunks_path.read_text(encoding="utf-8"))


def generate_questions(client: OpenAI, chunk_text: str) -> list[str]:
    """Call the LLM to generate hypothetical questions for a chunk."""
    try:
        response = client.chat.completions.create(
            model=CLAUDE_MODEL,
            max_tokens=400,
            temperature=0.7,
            messages=[
                {"role": "system", "content": QUESTION_PROMPT},
                {"role": "user", "content": chunk_text[:2000]},
            ],
        )
        raw = response.choices[0].message.content or "[]"
        raw = raw.strip()
        if raw.startswith("```"):
            first_nl = raw.find("\n")
            if first_nl != -1:
                raw = raw[first_nl + 1 :]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        questions = json.loads(raw)
        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str) and len(q) > 5]
    except (json.JSONDecodeError, Exception) as exc:
        print(f"  Warning: question generation failed: {exc}", file=sys.stderr)
    return []


def embed_texts(model: SentenceTransformer, texts: list[str]) -> np.ndarray:
    """Embed texts and L2 normalize for cosine similarity via inner product."""
    vectors = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return vectors.astype("float32")


def main() -> int:
    api_key = os.environ.get("TRITONAI_API_KEY", "")
    if not api_key or api_key.startswith("your_"):
        print("TRITONAI_API_KEY not set. Copy .env.example to .env and add your key.", file=sys.stderr)
        return 1

    chunks = load_naive_chunks()
    print(f"Loaded {len(chunks)} chunks from naive index")

    client = OpenAI(api_key=api_key, base_url=TRITONAI_BASE_URL)
    print(f"LLM model: {CLAUDE_MODEL}")

    print(f"Loading embedding model: {MODEL_NAME}")
    embed_model = SentenceTransformer(MODEL_NAME)

    # For each chunk, generate questions and build the combined entry list
    entries: list[dict] = []
    total_questions = 0
    start_time = time.monotonic()

    for i, chunk in enumerate(chunks):
        doc_id = chunk.get("doc_id", "unknown")
        chunk_text = chunk.get("text", "")

        # Add the original chunk as an entry
        entries.append(
            {
                "type": "chunk",
                "doc_id": doc_id,
                "filename": chunk.get("filename", ""),
                "section": chunk.get("section", ""),
                "text": chunk_text,
                "chunk_index": chunk.get("chunk_index", i),
                "question": None,
            }
        )

        # Generate hypothetical questions
        questions = generate_questions(client, chunk_text)
        total_questions += len(questions)

        for q in questions:
            entries.append(
                {
                    "type": "question",
                    "doc_id": doc_id,
                    "filename": chunk.get("filename", ""),
                    "section": chunk.get("section", ""),
                    "text": chunk_text,
                    "chunk_index": chunk.get("chunk_index", i),
                    "question": q,
                }
            )

        progress = f"[{i + 1}/{len(chunks)}]"
        print(f"  {progress} {doc_id}: {len(questions)} questions generated")

        # Small delay to avoid rate limits
        if (i + 1) % 10 == 0:
            time.sleep(0.5)

    elapsed = time.monotonic() - start_time
    print(f"\nGenerated {total_questions} questions across {len(chunks)} chunks in {elapsed:.1f}s")

    # Embed: for chunk entries embed the chunk text, for question entries embed the question
    texts_to_embed = []
    for e in entries:
        if e["type"] == "question":
            texts_to_embed.append(e["question"])
        else:
            texts_to_embed.append(e["text"])

    print(f"Embedding {len(texts_to_embed)} vectors (chunks + questions)")
    vectors = embed_texts(embed_model, texts_to_embed)

    print(f"Building FAISS IndexFlatIP, dim={vectors.shape[1]}")
    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(vectors)

    # Write artifacts
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(INDEX_DIR / "index.faiss"))

    (INDEX_DIR / "entries.json").write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    manifest = {
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": MODEL_NAME,
        "llm_model": CLAUDE_MODEL,
        "embedding_dim": int(dim),
        "total_entries": len(entries),
        "total_chunks": len(chunks),
        "total_questions": total_questions,
        "total_docs": len({e["doc_id"] for e in entries}),
        "build_time_seconds": round(elapsed, 1),
    }
    (INDEX_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Built HyQ index with {len(chunks)} chunks and {total_questions} questions, "
        f"saved to {INDEX_DIR.relative_to(REPO_ROOT.parent)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
