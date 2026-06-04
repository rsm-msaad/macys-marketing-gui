# Test Report: AI Coworker Failure Mode Testing

## Overview

M4 requires testing AI performance against realistic failure modes before a real user encounters a bad answer. This report documents the test cases we built (mapped to `failure_cases.md`), the actual results from running them against our prototype, the patterns we found, and one before/after improvement we made based on the findings. The test code lives at `tests/test_workflow.py` and exercises all 5 LLM skills through their deterministic helpers and (where API access is available) through full end to end skill invocation scored with DeepEval.

## Test Set Design

The test file contains two layers:

- **Tier 1 (Deterministic):** 10 original test classes with 25 individual test functions exercising the Python helper functions underlying each skill. These test decision logic (banned word detection, pricing language parsing, urgency rules, cascade recommendation logic) without requiring LLM calls. They run in under 0.1 seconds and produce fully reproducible results.
- **Tier 2 (DeepEval LLM scored):** 10 cases (D1 through D10) that invoke the full skill chain via `invoke_skill()`, requiring the TritonAI API key and the FAISS/sentence transformers stack. Each case is scored with three DeepEval metrics: Faithfulness, MarketingComplianceQuality (GEval), and FaceValidity (GEval), using `api-llama-4-scout` as the TritonAI judge. Scores surface as pytest warnings, not hard failures. These are gated behind `@requires_llm` and `@pytest.mark.integration`, and are skipped when the API key is unavailable.

### DeepEval Suite Coverage (D1 through D10)

| Case | Skill | Input | Failure Case Tie |
|---|---|---|---|
| D1 | layout-copy-generator | Strong brief: Mother's Day Beauty, 25% off, Gold and Platinum | None (baseline) |
| D2 | layout-copy-generator | Vague brief: "Beauty promo", no offer, no target | FC5 (vague brief) |
| D3 | compliance-pre-check | Mixed English and Spanish copy | None (edge case) |
| D4 | compliance-pre-check | Ambiguous copy with no explicit discount, 0% discount_pct | None (edge case) |
| D5 | approval-brief-generator | Clean compliance upstream, all pass | None (baseline) |
| D6 | approval-brief-generator | Mixed compliance: brand_alignment fail, disclaimers warn | FC6 (cascade failure) |
| D7 | revision-router | Clear MAP violation comment, $600K spend, 3 day deadline | None (baseline) |
| D8 | revision-router | Multi type comment spanning imagery and copy, low urgency | None (edge case) |
| D9 | compliance-pre-check | Near miss banned phrase: "prices you won't believe" | FC2 (LLM hallucination or miss) |
| D10 | report-generator | Full campaign with all steps completed, performance data | None (baseline) |

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

**Summary: 19 of 19 deterministic tests PASS. 0 failures.**

### DeepEval LLM Scoring Results

The 10 case DeepEval suite (D1 through D10) covers all 5 LLM skills and scores each output with Faithfulness, MarketingComplianceQuality, and FaceValidity using `api-llama-4-scout` as the TritonAI judge. The earlier partial run (4 recorded results from 2026-05-28) is preserved below; the full 10 case suite is written and awaiting a run with a live TRITONAI_API_KEY.

**Earlier recorded scores (from tests/results/deepeval_scores_20260528.json):**

| Case | Skill | AI Action | Faithfulness | QualityRule | FaceValidity | Notes |
|---|---|---|---|---|---|---|
| Clean Mother's Day copy | Compliance helpers | proceed | N/A (deterministic) | **1.0 PASS** | **1.0 PASS** | Clean copy correctly passes all 3 findings |
| Banned words (full skill) | Full LLM skill (compliance-pre-check) | revise | **1.0 PASS** | **0.8 PASS** | **1.0 PASS** | Correctly detects banned phrases; minor QualityRule deduction |
| VP Approval Brief | Full LLM skill (approval-brief-generator) | approve | **1.0 PASS** | **0.0 FAIL** | **0.8 PASS** | QualityRule failed on non standard field format |

**New D1 through D10 suite (10 cases, awaiting live run):**

| Case | Skill | Input Summary | Checks Applied |
|---|---|---|---|
| D1 | layout-copy-generator | Strong brief, Mother's Day Beauty, 25% off | Quality (character limits, 4 placements), FaceValidity |
| D2 | layout-copy-generator | Vague brief, no offer, no target (FC5) | Stuck to evidence (no hallucinated offers), Quality, FaceValidity |
| D3 | compliance-pre-check | Mixed English and Spanish copy | Faithfulness, Quality (brand voice), FaceValidity |
| D4 | compliance-pre-check | Ambiguous discount, 0% discount_pct | Faithfulness, Quality (no invented violations), FaceValidity |
| D5 | approval-brief-generator | Clean compliance, all pass upstream | Faithfulness, Quality (all 5 fields, approve), FaceValidity |
| D6 | approval-brief-generator | Mixed compliance: brand fail, disclaimer warn (FC6) | Faithfulness, Quality (risk_flags, revise), FaceValidity |
| D7 | revision-router | Clear MAP comment, $600K spend, 3 days | Faithfulness, Quality (pricing, Anna, high urgency), FaceValidity |
| D8 | revision-router | Multi type: imagery and copy, low urgency | Faithfulness, Quality (valid classification), FaceValidity |
| D9 | compliance-pre-check | "Prices you won't believe" near miss (FC2) | Faithfulness, Quality (flag or warn), FaceValidity |
| D10 | report-generator | Full campaign, all 10 steps, $450K revenue | Faithfulness, Quality (4 to 6 paragraph summary), FaceValidity |

**Key finding from earlier scoring:** The QualityRule failure on the approval brief case reveals that `api-llama-4-scout` returns the brief in a non standard format. The deterministic helpers parse this into the expected schema, but DeepEval's raw output comparison sees the format mismatch. This confirms Pattern 2 (model dependent behavior).

DeepEval scores are saved in `tests/results/`. The TritonAI judge wrapper (`evals/triton_judge.py`) inherits from `DeepEvalBaseLLM` so it can be used with any DeepEval metric.

## Top 4 Failure Patterns

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

### Pattern 4: Agentic Compliance Skill Over-Flags Clean Copy (Found Failure)

- **Finding:** The compliance-pre-check skill, running in agentic mode via Claude, flags clean compliant copy as `"revise"` instead of `"proceed"`. The happy-path test (Case 1, TestCase01HappyPath) fails the assertion `recommended_action == "proceed"` consistently across multiple runs. The campaign copy contains no banned words, uses an approved tagline ("find your magic"), has no unqualified pricing claims, and passes all deterministic helper checks. Despite this, the agentic LLM returns a revise recommendation.
- **Why it happens:** The agentic skill gives Claude tool-calling authority to verify claims mid-reasoning. Claude leans conservative — when it retrieves compliance policy documents via RAG, it interprets broad guidance (e.g., "ensure all promotional claims are substantiated") as grounds to flag copy that the deterministic helpers correctly pass. The non-deterministic reasoning path means Claude sometimes invents soft concerns that do not correspond to concrete rule violations in the cited documents.
- **Business consequence for Macy's:** Clean campaigns that should proceed without delay trigger unnecessary review cycles. If every compliant campaign gets flagged for revision, the time savings documented in `estimates.md` (Step 6 dropping from 3-7 days to 2-4 hours) erode because human reviewers must manually override false positives. At scale, this undermines trust in the AI coworker — reviewers learn to ignore compliance findings, which is exactly the rubber-stamping pattern (Failure Case 7) the system was designed to prevent.
- **How the user notices:** The happy-path Tier 2 test fails the `recommended_action == "proceed"` assertion. In the live app, the Campaign Manager sees a "revise" recommendation on the Step 6a compliance card for copy that has no actual violations. The Evidence panel shows cited passages that do not support the flagged findings, revealing the over-flagging.
- **Cases affected:** Test 1 (TestCase01HappyPath, Tier 2). The Tier 1 deterministic tests for the same input all pass (4/4), confirming the helpers correctly identify no violations. The discrepancy is between the deterministic logic and the agentic LLM reasoning.
- **Proposed fix:** (1) Tighten the compliance SKILL.md prompt to instruct Claude to flag only concrete, specific violations documented in the retrieved policy passages — not soft interpretive concerns. (2) Add a clean few-shot example to the prompt showing compliant copy that should return `"proceed"`, so the model has a calibration anchor. (3) As a fallback, add a post-processing step that cross-checks the LLM's finding statuses against the deterministic helpers: if all helpers pass but the LLM flags a finding, downgrade it to `"warn"` rather than `"fail"` and surface the discrepancy to the reviewer.

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

- **DeepEval scoring requires live API access.** The 10 case DeepEval suite (D1 through D10) is gated behind `@requires_llm` and `@pytest.mark.integration`. Without a TRITONAI_API_KEY, these cases are skipped. The deterministic Tier 1 tests run without any API access.
- **LLM behavior is probabilistic.** Rerunning Tier 2 tests may produce different results. The deterministic helpers that wrap LLM output (evaluate_recommended_action, decide_recommendation, assess_urgency) are designed to reduce this variability by making consequential decisions deterministically.
- **Test set covers breadth, not exhaustive depth.** 10 Tier 1 classes with 25 deterministic assertions plus 10 DeepEval cases across all 5 skills covers the 7 failure cases but is not exhaustive. A production rollout would need 50+ cases per skill, with adversarial fuzzing and boundary testing.
- **Report generator has no helpers.py.** D10 invokes report-generator through `invoke_skill()` with a seeded state. The skill has a SKILL.md and prefetch config but no deterministic helpers, so it cannot be tested at Tier 1.

## Connection to M4

This testing complements the human review gates documented in `human_review_plan.md` and the evidence visibility built into the Evidence screen. Automated tests catch deterministic logic errors (wrong banned word list, broken cascade, miscalibrated urgency) before they reach users. Human review at the consequential gates (Step 6a compliance, Step 6b brief) catches the failures that no automated test can anticipate: strategic misalignment, stale RAG context, and the judgment calls that require business expertise. The combination of both layers — automated testing of the decision backbone plus human review of the LLM reasoning layer — is what makes the AI coworker safe to deploy.
