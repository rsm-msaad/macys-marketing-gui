# Evaluation Report

**Updated:** 2026-05-30
**Framework:** DeepEval 4.0.2 with pytest
**Judge LLM:** Claude via TritonAI (`api-llama-4-scout`)

## Two Test Suites

This project has two complementary test suites. Both run via pytest.

**Suite 1: Skill-level evals (`evals/`)** — 67 parametrized tests across 3 of 5 LLM skills (compliance, brief, routing — the 3 with deterministic helper functions) and naive vs HyQ RAG comparison. These exercise the deterministic helpers (banned word scan, tagline check, pricing language, recommendation logic, urgency rules) with multiple input cases per function.

**Suite 2: M4 failure-mode tests (`tests/test_workflow.py`)** — 10 test classes with 27 individual test functions mapped to the 7 failure cases in `failure_cases.md`. Split into Tier 1 (19 deterministic, no LLM) and Tier 2 (8 LLM-dependent via TritonAI). Tier 2 tests include DeepEval LLM-as-judge scoring.

## Suite 1: Skill-Level Evals (67 tests)

| Category | Tests | Status |
| --- | --- | --- |
| Compliance Pre Check | 20 | 20 passing |
| Approval Brief Generator | 14 | 14 passing |
| Revision Router | 9 | 9 passing |
| RAG Comparison (naive vs HyQ) | 24 | 24 passing |
| **Total** | **67** | **67 passing, 0 failing** |

### Compliance Pre Check (20 tests)

Evaluates the deterministic helpers that power the compliance skill:
- Banned word scanning against hardcoded vocabulary (6 parametrized cases)
- Tagline validation against approved list (6 parametrized cases)
- Pricing language detection (percent-off claims, "starting at" clauses) (6 parametrized cases)
- Recommended action logic (any fail = revise, else proceed) (2 direct tests)

### Approval Brief Generator (14 tests)

Evaluates the `decide_recommendation` helper and brief assembly:
- Recommendation logic: any compliance fail = revise, warn without fail = approve
- Brief structure contains all 5 required fields (goal, audience, ROI, risks, recommendation)
- Values pass through correctly from inputs to output

### Revision Router (9 tests)

Evaluates the owner lookup and urgency calculation helpers:
- Each change_type (copy, imagery, pricing, targeting, legal, localization) maps to a named owner
- Urgency computed from spend + timeline: high (>$500K and <=5 days), medium (either alone), low (neither)

### RAG Comparison: Naive vs HyQ (24 tests)

Compares retrieval quality across 8 queries (3 tests per query):
- **Document recall:** Does the expected document appear in top 4 results?
- **Score comparison:** HyQ top score >= 90% of naive top score
- **HyQ:** Retrieved expected document in 8 of 8 queries
- **Naive:** Retrieved expected document in 5 of 8 queries
- HyQ's hypothetical-question index improves recall on intent-phrased queries

## Suite 2: M4 Failure-Mode Tests (27 tests)

### Tier 1 Results (Deterministic): 19 of 19 PASS

| # | Input | Stuck to Evidence? | Answered? | Quality Rule? | Face Validity? | Result |
|---|---|---|---|---|---|---|
| 1 | Clean Mother's Day Beauty copy | Yes | Yes | Yes (proceed) | Yes | **PASS (4/4)** |
| 2a | Copy with "lowest prices anywhere", "unbeatable" | Yes | Yes | Yes (revise) | Yes | **PASS (3/3)** |
| 2b | "Guaranteed lowest price" (variant) | Yes (after fix) | Yes | Yes (revise) | Yes | **PASS (after fix)** |
| 3 | 60% discount on Lancome (MAP) | Yes | Yes | Yes | Yes | **PASS (1/1)** |
| 4 | "Up to 50 percent off" no qualifier | Yes | Yes | Yes | Yes | **PASS (1/1)** |
| 5 | Thin brief: "Beauty promo" | Yes | Yes | Yes | Yes | **PASS (1/1)** |
| 6 | Compliance action = "revise" upstream | Yes | Yes | Yes (revise) | Yes | **PASS (1/1)** |
| 7 | Vague comment: "make it better" | Yes | Yes | Yes (low urgency) | Yes | **PASS (1/1)** |
| 8 | Clear MAP comment, $600K, 3-day deadline | Yes | Yes | Yes (high urgency) | Yes | **PASS (2/2)** |
| 9 | Mother's Day brief + Gold tier audience | Yes | Yes | Yes | Yes | **PASS (2/2)** |
| 10 | Compliance edited: fail vs warn vs pass | Yes | Yes | Yes (cascade logic) | Yes | **PASS (3/3)** |

### Tier 2 Results (LLM via TritonAI): DeepEval Scoring

Tier 2 tests invoke the full skill chain via `invoke_skill()` and score the LLM output with DeepEval metrics (FaithfulnessMetric, GEval) using `api-llama-4-scout` as the judge LLM.

| Case | Skill | AI Action | Faithfulness | Quality | Face Validity | Notes |
|---|---|---|---|---|---|---|
| Clean copy (deterministic) | Compliance helpers | proceed | N/A | **1.0 PASS** | **1.0 PASS** | Deterministic checks, no LLM judge needed |
| Banned words (deterministic) | Compliance helpers | revise | N/A | **1.0 PASS** | **1.0 PASS** | Deterministic checks, no LLM judge needed |
| Banned words (Tier 2 full skill) | compliance-pre-check (agentic) | revise | **1.0 PASS** | **0.8 PASS** | **1.0 PASS** | FaithfulnessMetric confirms output aligns with RAG passages. Quality 0.8: minor deduction for additional findings beyond banned-phrase check |
| VP Approval Brief | approval-brief-generator (LLM) | approve | **1.0 PASS** | **0.0 FAIL** | **0.8 PASS** | QualityRule failed: LLM returned non-standard field format. Deterministic helpers parse it correctly but DeepEval's raw comparison sees format mismatch |
| Clean copy (Tier 2 full skill) | compliance-pre-check (agentic) | revise | N/A | N/A | N/A | **FOUND FAILURE** — assertion fails before DeepEval scoring (see Pattern 4 below) |

**FaithfulnessMetric fix (2026-05-30):** Cases 1-2 previously errored with `"list indices must be integers or slices, not str"` because `retrieval_context` received bare doc ID strings instead of passage text. Fixed by adding `_passages_for_doc_ids()` helper that loads actual chunk text from `chunks.json`. Case 2 now produces real scores.

DeepEval scores saved in `tests/results/deepeval_scores_20260528.json`.

## Top 4 Failure Patterns

### Pattern 1: Banned Word Detection Has Gaps in Variant Coverage

- **Description:** The banned word list contained "lowest prices anywhere" but not "lowest price" (singular) or "guaranteed lowest" (reordered).
- **Cases affected:** Test 2b
- **Fix applied:** Expanded banned list with two variants. Before/after re-run confirmed FAIL to PASS. Honest assessment: string matching has a known ceiling; production would need embedding-based similarity.

### Pattern 2: LLM Tests Cannot Run Without Full Stack

- **Description:** 8 of 27 tests require FAISS, sentence-transformers, and TritonAI API key. Skipped in local dev without `.env`.
- **Cases affected:** All Tier 2 tests
- **Mitigation:** Tests run on the deployed Render backend. Production fix: CI pipeline with API key as a secret.

### Pattern 3: Cascade Logic Depends on Field-Level Schema Stability

- **Description:** `decide_recommendation` reads `compliance_check["brand_alignment"]["status"]` via `.get()`. Missing keys are silently treated as passing (fail-open).
- **Cases affected:** Test 10 (validated logic works when schema intact)
- **Proposed fix:** Schema validation before `decide_recommendation`; fail-safe to "revise" on broken schema.

### Pattern 4: Agentic Compliance Skill Over-Flags Clean Copy (Found Failure)

- **Finding:** The compliance-pre-check skill, running in agentic mode via Claude, flags clean compliant copy as "revise" instead of "proceed." The happy-path Tier 2 test (Case 1) fails the `recommended_action == "proceed"` assertion consistently across multiple runs. All 4 deterministic checks pass for the same input.
- **Why:** Claude leans conservative in agentic mode. When it retrieves policy docs via RAG, it interprets broad guidance as grounds to flag copy that the deterministic helpers correctly pass.
- **Business consequence:** Clean campaigns trigger needless review cycles. Erodes the Step 6 time savings (3-7 days to 2-4 hours) and risks training reviewers to rubber-stamp (Failure Case 7).
- **Detection:** Happy-path Tier 2 test fails. In the live app, the Evidence panel shows cited passages that do not support the flagged findings.
- **Proposed fix:** (1) Tighten SKILL.md prompt to flag only concrete violations. (2) Add a clean few-shot example. (3) Post-processing cross-check: if all deterministic helpers pass but LLM flags, downgrade to "warn."

## Before/After Improvement

**Pattern addressed:** Pattern 1 (Banned Word Variant Coverage)

Added `"lowest price"` and `"guaranteed lowest"` to the banned word list in `ai_engine/skills/compliance-pre-check/helpers.py`. Re-run: `test_banned_word_variant_detected` went from FAIL to PASS. No regressions. Honest assessment: catches two specific variants but does not solve general natural language variation.

## How to Run

```bash
# Suite 1: Skill-level evals (67 tests, no API key needed)
uv run pytest evals/ -v

# Suite 2: M4 failure-mode tests, Tier 1 only (19 tests, no API key needed)
uv run pytest tests/test_workflow.py -v

# Suite 2: Include Tier 2 LLM tests (requires TRITONAI_API_KEY in .env)
uv run pytest tests/test_workflow.py -v -o "addopts=" -m "integration"
```
