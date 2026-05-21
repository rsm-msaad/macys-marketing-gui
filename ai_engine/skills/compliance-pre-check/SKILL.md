---
agentic: true
---

# Compliance Pre Check

**Workflow step:** 6a, Compliance Pre Check before VP review
**Owner persona:** Merna (the skill runs automatically when she submits)
**Input from previous step:** campaign block from workflow state (campaign_id, title, copy, tagline, skus, discount_pct, regions, estimated_spend, audience_segment, campaign_manager)
**Output to next step:** compliance_check object written to workflow state
**RAG retrieval:** BRAND-GL-2026-001, LEGAL-DIS-2026-002, PRICE-RULES-2026-001, COMP-EX-2026-001
**MCP tools available:** check_pricing_conflicts (called agentically when you need to verify pricing claims)

## Agentic mode

This skill runs in agentic mode. You have access to MCP tools that you can call mid-reasoning when you need to verify data before issuing a finding. The RAG documents have already been retrieved and are provided in `retrieved_context`. You decide when and whether to call MCP tools.

**Available tools:**
- `check_pricing_conflicts(sku_ids, proposed_discount_pct)` — Validates SKUs against MAP enforced brand list and the 50% stacking ceiling per PRICE-RULES-2026-001. Call this when the campaign includes SKUs and a discount, and you need to verify whether any SKUs have pricing conflicts before writing the pricing_cross_check finding.
- `find_dam_assets(category, region)` — Look up DAM assets with active rights. Call this if you need to verify asset availability.

**When to call tools vs. when not to:**
- If the campaign has SKUs and a discount percentage, you SHOULD call check_pricing_conflicts to verify before writing the pricing_cross_check finding.
- If you can answer from the retrieved RAG documents alone (brand alignment, disclaimers), do not call a tool.
- If you are uncertain about a pricing claim, call the tool rather than guessing.

## When to use this skill

Run this skill the moment Merna submits a campaign for approval. It is the first stop in the chain. The purpose is to catch the avoidable rework that historically eats two to three days of approval time (see TICKET-INC-2025-4471 for a textbook example). If the campaign passes, the chain moves on to the VP approval brief. If it fails, Merna gets the campaign back with specific fixes before any VP is paged.

## Instructions

1. Read the campaign block from the current_state.
2. Use the retrieved_context to check brand alignment:
   - Check that no banned words appear in the campaign copy (reference BRAND-GL-2026-001).
   - Check that the tagline is on the approved tagline list.
3. Use the retrieved_context to check disclaimers:
   - Verify that any "up to X percent off" claim includes the required "starting at" minimum disclosure (reference LEGAL-DIS-2026-002).
4. For pricing cross-check:
   - If the campaign has SKUs and a discount, call the `check_pricing_conflicts` tool to verify MAP compliance.
   - Use the tool result to determine if any SKUs violate MAP rules.
   - Reference PRICE-RULES-2026-001 in your finding.
5. For each of the three findings (brand_alignment, disclaimers, pricing_cross_check), set status to pass, warn, or fail based on what you found.
6. Set `recommended_action` to "revise" if any finding has status "fail", otherwise "proceed".
7. Return the JSON output schema.

## RAG retrieval queries

| Query | Expected doc IDs |
|-------|------------------|
| banned words and approved taglines for campaign copy | BRAND-GL-2026-001 |
| required legal disclaimers for percent off pricing claims and Star Rewards multipliers | LEGAL-DIS-2026-002 |
| MAP minimum advertised price and brand discount exclusions | PRICE-RULES-2026-001 |
| compliance flag examples for [campaign category] | COMP-EX-2026-001 |

## Output schema

```json
{
  "brand_alignment": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "BRAND-GL-2026-001"
  },
  "disclaimers": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "LEGAL-DIS-2026-002"
  },
  "pricing_cross_check": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "PRICE-RULES-2026-001"
  },
  "recommended_action": "proceed | revise",
  "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001", "COMP-EX-2026-001"]
}
```

## Handoff

* If `recommended_action == "proceed"`, next skill: `approval-brief-generator`.
* If `recommended_action == "revise"`, return the compliance_check to Merna with specific fixes.
