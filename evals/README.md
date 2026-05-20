# Evaluation Suite

LLM skill and RAG retrieval evaluation using DeepEval and pytest.

## What is tested

1. **Compliance Pre Check** (`test_compliance_skill.py`): tests deterministic helpers (banned word scan, tagline approval, pricing language, recommended action logic) against 6 campaign scenarios.

2. **Revision Router** (`test_routing_skill.py`): tests owner lookup and urgency calculation helpers against 6 revision comment scenarios.

3. **RAG Comparison** (`test_rag_comparison.py`): tests naive vs HyQ retrieval on 8 queries, checking document recall, score comparison, and expected document presence.

## How to run

```bash
# Run all evals
uv run pytest evals/ -v

# Run one file
uv run pytest evals/test_rag_comparison.py -v

# Run with output visible
uv run pytest evals/ -v -s
```

## Judge LLM

The `triton_judge.py` module provides a TritonClaude wrapper that routes through UCSD's TritonAI proxy. It is used when DeepEval GEval or contextual metrics require an LLM judge.

For the current test suite, most tests use deterministic assertions (no LLM judge needed). The judge is available for future GEval based scoring.

## Datasets

Test cases live in `datasets/`:
- `compliance_cases.json`: 6 campaigns with expected compliance outcomes
- `routing_cases.json`: 6 revision comments with expected change_type classifications
- `rag_queries.json`: 8 questions with expected document IDs and answer summaries

## Adding new test cases

Edit the JSON files in `datasets/`. Each case needs an `id` field for pytest parameterization plus the fields specific to that evaluation type.
