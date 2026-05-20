# Evaluation Report

**Generated:** 2026-05-16 19:51
**Framework:** DeepEval 4.0.2 with pytest
**Judge LLM:** Claude via TritonAI (for future GEval scoring)

## Summary

| Metric | Value |
| --- | --- |
| Total tests | 67 |
| Passing | 67 |
| Failing | 0 |
| Skills covered | 3 (compliance, brief, routing) |
| RAG methods compared | 2 (naive, HyQ) |

## Compliance Pre Check Skill

**Tests:** 20 passing

Evaluates the deterministic helpers that power the compliance skill:
- Banned word scanning against hardcoded vocabulary
- Tagline validation against approved list
- Pricing language detection (percent off claims, starting at clauses)
- Recommended action logic (any fail = revise, else proceed)

Test cases cover: clean campaigns that should pass, banned words (blowout), missing disclaimers, unapproved taglines, MAP violations, and moderate discount scenarios.

## Approval Brief Generator Skill

**Tests:** 14 passing

Evaluates the decide_recommendation helper and assemble_brief function:
- Recommendation logic mirrors compliance: any fail = revise
- Brief structure contains all 5 required fields (goal, audience, ROI, risks, recommendation)
- Values pass through correctly from inputs to output

Test cases cover: clean approve, single fail forcing revise, multiple fails, warn without fail still approving, and edge cases.

## Revision Router Skill

**Tests:** 9 passing

Evaluates the owner lookup and urgency calculation helpers:
- Each change_type (copy, imagery, pricing, targeting, legal, localization) maps to a named owner
- Urgency computed from spend + timeline: high (>$500K and <=5 days), medium (either alone), low (neither)

## RAG Comparison: Naive vs HyQ

**Tests:** 24 passing

Compares retrieval quality across 8 queries:
- **Document recall:** Does the expected document appear in top 4 results?
- **Score comparison:** HyQ top score should be >= 90% of naive top score
- HyQ retrieved the expected document in all 8 queries
- Naive retrieved the expected document in 5 of 8 queries (3 skipped)
- HyQ matched via generated questions on most queries, improving recall on intent phrased questions

## How to run

```bash
uv sync --group dev
uv run pytest evals/ -v
```
