# rag

Retrieval Augmented Generation layer for the Milestone 3 agent.

## Architecture

Three Python components plus the corpus.

### chunker.py
Reads a markdown document from `knowledge_base/`, parses the metadata block (Document ID, Owner, Last updated, Audience), and splits the body into chunks by Markdown level 2 heading. Sections longer than 500 words are further split by paragraph so no chunk overflows the embedding context.

Preview the chunks for a single doc:

```
python -m rag.chunker 01_brand_guidelines.md
```

### build_index.py
Walks every markdown doc in `knowledge_base/` (skips README.md), chunks each doc, embeds the chunks with the sentence_transformers model `all-MiniLM-L6-v2`, and writes three artifacts to `index/`:

* `index.faiss` the FAISS IndexFlatIP binary
* `chunks.json` the chunk metadata in vector order so FAISS ids map back to chunks
* `manifest.json` build info (timestamp, model, embedding dim, total chunks, total docs, doc IDs covered)

Build from scratch (or rebuild after editing the corpus):

```
python -m rag.build_index
```

First run downloads the embedding model from Hugging Face (around 90 MB) into the local sentence_transformers cache. Subsequent builds reuse the cached model and finish in under 10 seconds at the current corpus size.

### retrieval.py
Exposes a `Retriever` class and a module level `retrieve` function. The Retriever loads the FAISS index, the chunks, and the embedding model. The first `retrieve` call pays the model load cost. The skills in `../skills/` import the module level function directly:

```python
from rag.retrieval import retrieve

results = retrieve("banned words and approved taglines for campaign copy", k=4)
for r in results:
    print(r["doc_id"], r["section"], round(r["score"], 3))
```

Each result dict has: `doc_id`, `filename`, `section`, `text`, `chunk_index`, `score`.

There is also `retrieve_by_doc_id(doc_id)` for cases where a skill knows it needs every chunk of a specific document (for example, the full approval policy when adjudicating a high spend campaign).

If the index has not been built yet, the first call raises `FileNotFoundError` with the build command in the message.

## Sanity queries

The smoke test at [../tests/test_retrieval_smoke.py](../tests/test_retrieval_smoke.py) runs five queries and asserts the expected doc appears in the top four results.

| Query | Expected doc |
|-------|--------------|
| banned words and approved taglines | BRAND-GL-2026-001 |
| required legal disclaimers for percent off pricing | LEGAL-DIS-2026-002 |
| MAP minimum advertised price restrictions | PRICE-RULES-2026-001 |
| past compliance flag examples for pricing claims | COMP-EX-2026-001 or LEGAL-DIS-2026-002 |
| localization rules for Spanish markets | LOC-STYLE-2025-002 |

Run it:

```
python tests/test_retrieval_smoke.py
```

## Embedding model

We use `sentence-transformers/all-MiniLM-L6-v2`. Reasons:

* Free and open source, no API key required.
* Runs locally on CPU. No network call at retrieval time after first download.
* 384 dimensional embeddings, small enough that an exact FAISS index holds the entire corpus in memory.
* Embeddings are L2 normalized by the library, so inner product equals cosine similarity. Scores are directly interpretable.
* Anthropic does not publish a public embeddings API as of May 2026, so we did not have a same vendor option for embeddings.

## Index choice

We use `faiss.IndexFlatIP`, an exact inner product index. At the current scale (12 docs, around 50 to 100 chunks), an approximate index (HNSW, IVF) buys nothing and costs interpretability. We can revisit if the corpus grows past a few thousand chunks.

## Why the index is not committed

The three index artifacts in `index/` (`index.faiss`, `chunks.json`, `manifest.json`) are gitignored. The corpus in `knowledge_base/` is the source of truth. Anyone with the repo runs `python -m rag.build_index` and gets a deterministic index in under a minute.

## Folder layout

```
rag/
  __init__.py         package marker
  chunker.py          chunking pipeline
  build_index.py      build script
  retrieval.py        runtime retrieval API
  knowledge_base/     12 simulated Macys documents
  index/              build outputs (gitignored, rebuild with build_index)
  README.md           this file
```
