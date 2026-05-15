# Approval Brief Generator

**Workflow step:** 6b, generate the VP approval brief
**Owner persona:** VP (the skill runs automatically when the VP opens the approval modal)
**Input from previous step:** campaign block plus compliance_check from workflow_state.json
**Output to next step:** approval_brief object written to workflow_state.json
**RAG retrieval:** light. Past campaign retros for ROI benchmarks. Typical hits: RETRO-SP-2025-BTY, RETRO-Q4-2025
**MCP tools called:** none

## When to use this skill

Run this skill the moment the VP opens the approval modal for a campaign that has passed compliance pre check. The goal is to give the VP a short brief (five fields) so the decision can happen in a minute rather than ten. The brief does not replace the underlying campaign document. It surfaces what the VP needs to decide.

## Instructions

1. Load the campaign block and compliance_check from data/workflow_state.json.
2. Retrieve past campaign retros for the campaign category and audience segment. Call `retrieve("[campaign category] campaign retro performance benchmarks for [audience segment]")`. Expect RETRO-SP-2025-BTY for Beauty campaigns or RETRO-Q4-2025 for Holiday campaigns.
3. Call `helpers.extract_roi_benchmark(retrieved_retros, audience_segment)` to pull representative ROAS and lift numbers from the retrieved retros. The helper does the numeric extraction. The LLM does not estimate.
4. The LLM writes the five fields of the brief.
   * `campaign_goal`: one sentence summary of the campaign purpose
   * `target_audience`: one sentence describing the segment
   * `expected_roi`: one sentence with the benchmark numbers returned by the helper
   * `risk_flags`: list of compliance warnings carried over from compliance_check plus any business risks the model can identify
   * `ai_recommendation`: approve, revise, or reject with a one sentence rationale
5. Call `helpers.decide_recommendation(compliance_check, risk_flags)` to compute the `ai_recommendation` value (approve or revise). The helper applies the rule: any fail in compliance_check triggers revise, any warn keeps approve but the warning belongs in risk_flags, all pass produces approve. The LLM adds the one sentence rationale after the value is decided.
6. Call `helpers.assemble_brief(...)` to package the five fields plus the retrieved doc IDs.
7. Write the brief to workflow_state.json under `approval_brief`.
8. Update `status` to `in_vp_review`.

The numeric benchmarks are pulled from retrieved retros by the helper. The LLM does not invent or estimate numbers.

## RAG retrieval queries

| Query | Expected doc IDs |
|-------|------------------|
| Beauty campaign retro performance benchmarks for Beauty Loyalists | RETRO-SP-2025-BTY |
| Holiday campaign retro performance benchmarks for cross channel | RETRO-Q4-2025 |

## Output schema

```json
{
  "campaign_goal": "string, one sentence",
  "target_audience": "string, one sentence",
  "expected_roi": "string, one sentence with benchmarked range",
  "risk_flags": ["string"],
  "ai_recommendation": "approve | revise | reject, with a one sentence rationale",
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}
```

## Worked example

Input compliance_check: recommended_action is `proceed`. One warn on pricing_cross_check (MAP brand needs Merchandising approval).

Retrieval pulls RETRO-SP-2025-BTY. `helpers.extract_roi_benchmark(...)` returns `{"paid_social_roas": 4.2, "email_open_rate": 0.32, "in_store_uplift": 0.18}`.

`helpers.decide_recommendation(...)` returns `approve`.

Output approval_brief:

```json
{
  "campaign_goal": "Drive Beauty Loyalists to refresh their spring skincare routine with a 40 percent off offer across qualifying brands.",
  "target_audience": "Beauty Loyalists, customers who purchased prestige Beauty in the prior 12 months with an active Star Rewards account.",
  "expected_roi": "Based on Spring 2025 Beauty benchmarks, expect paid social ROAS around 4.2 and email open rate around 32 percent for the Loyalist segment.",
  "risk_flags": ["BTY-001 is Lancome, MAP enforced. Confirm Merchandising approval before launch."],
  "ai_recommendation": "approve, the only flag is a procedural MAP confirmation that can be cleared before production.",
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}
```

## Handoff

The VP reads the brief and picks one of three actions.

* `approve`, set `approval_decision` to `approve` and `status` to `approved`. Next skill: `localization-generator`.
* `revise`, set `approval_decision` to `revise`, capture the VP's `revision_comment`, set `status` to `revision_requested`. Next skill: `revision-router`.
* `reject`, set `approval_decision` to `reject` and `status` to `rejected`. The chain stops.
