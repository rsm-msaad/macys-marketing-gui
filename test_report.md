# Test Report: AI Coworker Failure Mode Testing

## Overview

M4 requires testing AI performance against realistic failure modes before a real user encounters a bad answer. This report documents the 10 test cases we built (mapped to `failure_cases.md`), the actual results from running them against our prototype, the patterns we found, and one before/after improvement we made based on the findings. The test code lives at `evals/test_m4_failure_modes.py` and exercises the 4 LLM skills through their deterministic helpers and (where API access is available) through full end-to-end skill invocation.

## Test Set Design

The 10 test classes contain 27 individual test functions organized in two tiers:

- **Tier 1 (Deterministic):** 19 tests that exercise the Python helper functions underlying each skill. These test the actual decision logic — banned word detection, pricing language parsing, urgency rules, cascade recommendation logic — without requiring LLM calls. They run in under 0.1 seconds and produce fully reproducible results.
- **Tier 2 (LLM-dependent):** 8 tests that invoke the full skill chain via `invoke_skill()`, requiring the TritonAI API key and the FAISS/sentence-transformers stack. These are skipped when the API key is unavailable (local dev without `.env`) and run on the deployed Render backend.

### Mapping to Failure Cases

| Test Class | Failure Case | What It Tests |
|---|---|---|
| TestHappyPath | None (baseline) | Clean campaign copy passes all compliance checks; correct doc citation |
| TestBannedWord | Failure 2 (LLM hallucination/miss) | Banned words are detected; brand_alignment correctly set to fail |
| TestMAPViolation | Failure 3 (MCP stale data) | MAP-protected brand with 60% discount flagged by pricing language check |
| TestMissingDisclaimer | Failure 1 + 2 (RAG retrieval + LLM miss) | "Up to 50 percent off" without "starting at" qualifier is caught |
| TestVagueBrief | Failure 5 (vague brief) | Thin brief doesn't cause hallucinated specifics; layout fallback still works |
| TestBriefWithFailedCompliance | Failure 6 (cascade failure) | Brief inherits upstream compliance failures in risk_flags |
| TestVagueRevision | Failure 5 + 7 (vague input) | Vague "make it better" comment doesn't produce overconfident routing |
| TestClearRevision | None (baseline) | Clear pricing comment routes to correct owner with correct urgency |
| TestLayoutCopyAudience | Failure 5 (generic output) | Layout copy generation handles audience constraints |
| TestCascadeAfterEdit | Failure 6 (cascade after edit) | Edited compliance status correctly propagates to brief recommendation |

## How Tests Are Scored

Each test class evaluates the AI output on up to 4 dimensions:

1. **Stuck to evidence (deterministic check):** Does the output cite the expected document IDs? Does the helper function return the correct data given its inputs? Verified via Python assertions comparing output fields to expected values.
2. **Answered the question:** Does the skill produce a structured response with all required fields? Verified by checking for non-null status, reason, and cited_doc fields.
3. **Quality rule:** Does the logic produce the correct decision? For example: any "fail" status in compliance findings must yield "revise" as the recommended action. Verified via direct assertion on the decision logic.
4. **Face validity:** Would the output make sense to a Macy's compliance officer? For Tier 2 (LLM) tests, this is assessed by checking that the LLM's reasoning aligns with the helper's deterministic decision.

## Results Table

| # | Input Description | AI Answer (Summary) | Stuck to Evidence? | Answered the Question? | Quality Rule Met? | Face Validity? | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Clean Mother's Day Beauty copy, approved tagline | No banned words detected; tagline approved; no pricing violations; action = proceed | Yes — helpers return correct empty/pass results | Yes — all 4 checks return structured output | Yes — all pass yields "proceed" | Yes — clean copy should pass compliance | **PASS (4/4)** | Baseline happy path |
| 2a | Copy with "lowest prices anywhere" and "unbeatable" | Detects both banned phrases; action = revise | Yes — scan returns exact banned phrases found | Yes — returns list of matched words | Yes — any fail yields "revise" | Yes — these are clearly off-brand for Macy's | **PASS (3/3)** | Exercises Failure Case 2 |
| 2b | "Guaranteed lowest price" (variant phrasing) | Detects "lowest price" and "guaranteed lowest" | Yes — after fix, substring matching catches variants | Yes — returns matched phrases | Yes — triggers revise | Yes — variant of banned concept | **PASS (after fix)** | Was FAILING before banned list expansion |
| 3 | 60% discount on Lancome (MAP-protected brand) | Pricing language check flags missing "starting at" qualifier | Yes — detects "up to percent off" pattern | Yes — returns structured pricing analysis | Yes — minimum_required = True | Yes — 60% on prestige brand is a MAP red flag | **PASS (1/1)** | Exercises Failure Case 3 |
| 4 | "Up to 50 percent off" with no "starting at" | check_pricing_language flags unqualified claim | Yes — detects pattern and missing qualifier | Yes — returns has_up_to_claim and minimum_required | Yes — correctly identifies violation | Yes — FTC representative pricing rules require qualification | **PASS (1/1)** | Exercises Failure Cases 1 + 2 |
| 5 | Thin brief: "Beauty promo for Mother's Day" | Layout fallback produces valid output for all 4 placements without hallucinating specifics | Yes — fallback uses only brief fields provided | Yes — returns web_banner, email, mobile, in_store_signage | Yes — produces copy without inventing data | Yes — generic but safe output for thin input | **PASS (1/1)** | Exercises Failure Case 5 |
| 6 | Compliance result with action = "revise" (upstream fail) | decide_recommendation correctly returns "revise" given upstream compliance failure | Yes — reads compliance status fields directly | Yes — returns recommendation string | Yes — any fail in compliance yields revise in brief | Yes — brief should not approve when compliance failed | **PASS (1/1)** | Exercises Failure Case 6 |
| 7 | "make it better" (vague revision comment) | Urgency rule returns "low" for normal campaign parameters | Yes — uses spend and timeline thresholds | Yes — returns urgency level | Yes — normal spend + normal timeline = low | Yes — vague comment should not trigger high urgency | **PASS (1/1)** | Exercises Failure Cases 5 + 7 |
| 8 | Clear MAP violation comment, $600K spend, 3-day deadline | Urgency = "high"; routes to pricing/Merchandising (Anna) | Yes — spend > $500K and days <= 5 triggers high | Yes — returns urgency and owner | Yes — pricing maps to Anna/Merchandising | Yes — MAP violation on high-spend short-deadline campaign is clearly urgent | **PASS (2/2)** | Baseline routing |
| 9 | Mother's Day brief with Gold tier audience | Fallback produces themed copy; validation catches missing fields in bad output | Yes — uses brief fields as input | Yes — produces all 4 placements | Yes — validation correctly identifies incomplete output | Yes — copy is themed for the campaign | **PASS (2/2)** | Exercises Failure Case 5 |
| 10 | Compliance edited to fail vs warn vs pass | pass→approve, warn→approve, fail→revise | Yes — reads status field directly | Yes — returns recommendation for each scenario | Yes — cascade logic matches business rules | Yes — only hard failures should block approval | **PASS (3/3)** | Exercises Failure Case 6 |

**Summary: 19 of 19 deterministic tests PASS. 8 LLM-dependent tests SKIPPED (TritonAI API key not configured in local test environment). 0 failures.**

## Top 3 Failure Patterns

### Pattern 1: Banned Word Detection Has Gaps in Variant Coverage

- **Description:** The banned word list contained "lowest prices anywhere" but not the variant "lowest price" (singular) or "guaranteed lowest" (reordered). A campaign could use "guaranteed lowest price" and pass the deterministic compliance check.
- **Cases affected:** Test 2b (TestBannedWord variant)
- **Proposed fix:** Expand the banned list with common variants (applied in the before/after comparison below). For production, a fuzzy matching approach or embedding-based similarity check would be more robust than exact string matching.

### Pattern 2: LLM Tests Cannot Run Without Full Stack

- **Description:** 8 of 27 tests are skipped because they require the FAISS index, sentence-transformers model, and TritonAI API key — none of which are available in a clean local test environment without the full `.env` configuration.
- **Cases affected:** All Tier 2 tests (TestHappyPath, TestBannedWord, TestMAPViolation, TestMissingDisclaimer, TestVagueBrief, TestBriefWithFailedCompliance, TestVagueRevision, TestClearRevision)
- **Proposed fix:** For production testing, a CI pipeline with the API key configured as a secret would run Tier 2 tests on every push. For the class context, these tests run when the Render backend is hit directly (which the live frontend does).

### Pattern 3: Cascade Logic Depends on Field-Level Schema Stability

- **Description:** The `decide_recommendation` helper reads `compliance_check["brand_alignment"]["status"]` by exact key path. If a human edit on the Review screen changes the schema (e.g., removes the `status` field or renames it), the helper silently treats the finding as non-failing and returns "approve" when it should return "revise."
- **Cases affected:** Test 10 (TestCascadeAfterEdit) — validated the logic works when schema is intact, but the underlying `.get("status")` pattern means missing keys are treated as passing.
- **Proposed fix:** Add schema validation before running `decide_recommendation`: verify that all expected keys exist and have valid values. If schema is broken, return "revise" (fail-safe) rather than "approve" (fail-open).

## Before/After Improvement

### Pattern Addressed: Pattern 1 (Banned Word Variant Coverage)

### What We Changed

**File:** `ai_engine/skills/compliance-pre-check/helpers.py`

**Before:**
```python
BANNED_WORDS = [
    "cheap",
    "basic",
    "last chance",
    "clearance blowout",
    "dirt cheap",
    "unbeatable",
    "lowest prices anywhere",
    "nobody beats macys",
]
```

**After:**
```python
BANNED_WORDS = [
    "cheap",
    "basic",
    "last chance",
    "clearance blowout",
    "dirt cheap",
    "unbeatable",
    "lowest prices anywhere",
    "lowest price",
    "guaranteed lowest",
    "nobody beats macys",
]
```

Two phrases added: `"lowest price"` (catches singular variant and the substring in "guaranteed lowest price") and `"guaranteed lowest"` (catches reordered variant).

### Re-Run Results

| Test | Before Fix | After Fix |
|---|---|---|
| test_banned_word_variant_detected | FAIL (empty list returned) | **PASS** (detects "lowest price" and "guaranteed lowest") |
| test_no_banned_words_in_clean_copy | PASS | PASS (no regression — clean copy doesn't contain these phrases) |
| test_banned_word_detected | PASS | PASS (existing detections unchanged) |
| All other tests | PASS | PASS (no regression) |

### Honest Assessment

This fix partially addresses Pattern 1. It catches two specific variants but does not solve the general problem of natural language variation. A campaign copywriter could still write "we guarantee the lowest pricing" and evade detection. For production, embedding-based semantic similarity (comparing candidate copy against a vector of banned concepts rather than an exact string list) would be more robust. The deterministic string matching is appropriate for the M3/M4 scope but has a known ceiling.

## Limitations

- **DeepEval scoring not used for Tier 1 tests.** The deterministic tests use standard pytest assertions rather than DeepEval's GEval metric, because the helper functions produce exact, reproducible outputs. GEval (AI judging AI) is appropriate for the Tier 2 LLM tests, which were skipped in this run.
- **LLM behavior is probabilistic.** Re-running Tier 2 tests may produce different results. The deterministic helpers that wrap LLM output (evaluate_recommended_action, decide_recommendation, assess_urgency) are designed to reduce this variability by making consequential decisions deterministically.
- **Test set is small.** 10 test classes with 27 assertions covers the 7 failure cases but is not exhaustive. A production rollout would need 50+ cases per skill, with adversarial fuzzing and boundary testing.
- **No TritonAI API key in local test env.** The 8 LLM-dependent tests run on the deployed Render backend but could not be executed in this local test run. Results for those tests would come from running against the live API.

## Connection to M4

This testing complements the human review gates documented in `human_review_plan.md` and the evidence visibility built into the Evidence screen. Automated tests catch deterministic logic errors (wrong banned word list, broken cascade, miscalibrated urgency) before they reach users. Human review at the consequential gates (Step 6a compliance, Step 6b brief) catches the failures that no automated test can anticipate: strategic misalignment, stale RAG context, and the judgment calls that require business expertise. The combination of both layers — automated testing of the decision backbone plus human review of the LLM reasoning layer — is what makes the AI coworker safe to deploy.
