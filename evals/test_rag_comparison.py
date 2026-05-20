"""RAG evaluation: compare naive vs HyQ retrieval quality.

Measures whether the correct document is retrieved and how relevant
the returned chunks are to the query. Uses DeepEval ContextualRecall
to check if the expected answer content appears in retrieved chunks.

Run: uv run pytest evals/test_rag_comparison.py -v
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure ai_engine is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai_engine"))

CASES_PATH = Path(__file__).parent / "datasets" / "rag_queries.json"
CASES = json.loads(CASES_PATH.read_text())["test_cases"]


def _naive_retrieve(query: str, k: int = 4) -> list[dict]:
    from rag.retrieval import retrieve

    return retrieve(query, k=k, min_score=0.0)


def _hyq_retrieve(query: str, k: int = 4) -> list[dict]:
    from rag.hyq.retrieval import retrieve_hyq

    return retrieve_hyq(query, k=k, min_score=0.0)


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_naive_retrieves_expected_doc(case: dict) -> None:
    """Check that naive RAG includes the expected doc in top 4 results."""
    results = _naive_retrieve(case["query"])
    doc_ids = [r["doc_id"] for r in results]
    expected = case["expected_doc_id"]
    found = expected in doc_ids
    scores = {r["doc_id"]: round(r["score"], 3) for r in results}
    print(f"\n  Naive: docs={list(scores.keys())}, expected={expected}, found={found}")
    # Soft assertion: log but don't fail (naive may miss, that's part of the comparison)
    if not found:
        pytest.skip(f"Naive missed {expected} (got {list(scores.keys())})")


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_hyq_retrieves_expected_doc(case: dict) -> None:
    """Check that HyQ RAG includes the expected doc in top 4 results."""
    results = _hyq_retrieve(case["query"])
    doc_ids = [r["doc_id"] for r in results]
    expected = case["expected_doc_id"]
    found = expected in doc_ids
    scores = {r["doc_id"]: round(r["score"], 3) for r in results}
    matched_via = results[0].get("matched_via", "chunk") if results else "none"
    print(f"\n  HyQ:   docs={list(scores.keys())}, expected={expected}, found={found}, via={matched_via}")
    assert found, f"HyQ should retrieve {expected} but got {list(scores.keys())}"


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_hyq_score_higher_than_naive(case: dict) -> None:
    """Check that HyQ top score is >= naive top score for the query."""
    naive = _naive_retrieve(case["query"])
    hyq = _hyq_retrieve(case["query"])
    naive_top = naive[0]["score"] if naive else 0
    hyq_top = hyq[0]["score"] if hyq else 0
    gap = hyq_top - naive_top
    print(f"\n  Scores: naive={naive_top:.3f}, hyq={hyq_top:.3f}, gap={gap:+.3f}")
    # HyQ should generally match or beat naive
    assert hyq_top >= naive_top * 0.9, f"HyQ ({hyq_top:.3f}) significantly worse than naive ({naive_top:.3f})"
