---
agentic: true
---

# Approval Brief Generator

**Workflow step:** 6b, generate the VP approval brief
**Owner persona:** VP (the skill runs automatically when the VP opens the approval modal)
**Input from previous step:** campaign block plus compliance_check from workflow state
**Output to next step:** approval_brief object written to workflow state
**RAG retrieval:** past campaign retros for ROI benchmarks (RETRO-SP-2025-BTY, RETRO-Q4-2025)
**MCP tools available:** check_pricing_conflicts (for any pricing verification the compliance check may have missed)

## Agentic mode

This skill runs in agentic mode. You have access to MCP tools that you can call mid-reasoning if you need to verify data. The RAG documents (campaign retros with ROI benchmarks) have already been retrieved and are in `retrieved_context`. You decide when and whether to call MCP tools.

**Available tools:**
- `check_pricing_conflicts(sku_ids, proposed_discount_pct)` — Validates SKUs against MAP enforced brand list. Call this if the compliance_check flagged pricing issues and you want to double-check the SKU list before writing risk_flags.
- `find_dam_assets(category, region)` — Look up DAM assets with active rights. Rarely needed for brief generation, but available if you need to verify asset readiness for a risk flag.

**When to call tools vs. when not to:**
- If compliance_check already has a pricing_cross_check finding with status "warn" or "fail", you MAY call check_pricing_conflicts to get the latest data for the risk_flags section.
- For most briefs, the retrieved retros and compliance_check are sufficient. Do not call tools unless verification adds value.

## When to use this skill

Run this skill the moment the VP opens the approval modal for a campaign that has passed compliance pre check. The goal is to give the VP a short brief (five fields) so the decision can happen in a minute rather than ten. The brief does not replace the underlying campaign document. It surfaces what the VP needs to decide.

## Instructions

1. Read the campaign block and compliance_check from the current_state.
2. Use the retrieved_context (campaign retros) to extract ROI benchmarks for the campaign's category and audience segment.
3. If the compliance_check has pricing warnings and you need to verify the current state of SKU conflicts, call check_pricing_conflicts.
4. Write the five fields of the brief:
   * `campaign_goal`: one sentence summary of the campaign purpose
   * `target_audience`: one sentence describing the segment
   * `expected_roi`: one sentence with benchmark numbers from the retrieved retros
   * `risk_flags`: list of compliance warnings from compliance_check plus any business risks you identify
   * `ai_recommendation`: approve, revise, or reject with a one sentence rationale. Rule: any "fail" in compliance_check triggers "revise"; all pass produces "approve"; warn keeps "approve" but the warning belongs in risk_flags.
5. Return the JSON output schema.

The numeric benchmarks come from the retrieved retros. Do not invent or estimate numbers.

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

## Handoff

The VP reads the brief and picks one of three actions:
* `approve`: next skill is `localization-generator`.
* `revise`: capture revision_comment, next skill is `revision-router`.
* `reject`: the chain stops.
