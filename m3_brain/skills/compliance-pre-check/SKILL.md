# Compliance Pre Check

**Workflow step:** 6a, Compliance Pre Check before VP review
**Owner persona:** Sarah (the skill runs automatically when she submits)
**Input from previous step:** campaign block from workflow_state.json (campaign_id, title, copy, tagline, skus, discount_pct, regions, estimated_spend, audience_segment, campaign_manager)
**Output to next step:** compliance_check object written to workflow_state.json
**RAG retrieval:** BRAND-GL-2026-001, LEGAL-DIS-2026-002, PRICE-RULES-2026-001, COMP-EX-2026-001
**MCP tools called:** check_pricing_conflicts

## When to use this skill

Run this skill the moment Sarah submits a campaign for approval. It is the first stop in the chain. The purpose is to catch the avoidable rework that historically eats two to three days of approval time (see TICKET-INC-2025-4471 for a textbook example). If the campaign passes, the chain moves on to the VP approval brief. If it fails, Sarah gets the campaign back with specific fixes before any VP is paged.

## Instructions

1. Load the campaign block from data/workflow_state.json.
2. Retrieve brand voice and tagline rules. Call `retrieve("banned words and approved taglines for campaign copy")`. Expect BRAND-GL-2026-001.
3. Retrieve disclaimer requirements. Call `retrieve("required legal disclaimers for percent off pricing claims and Star Rewards multipliers")`. Expect LEGAL-DIS-2026-002.
4. Retrieve pricing and promotion rules. Call `retrieve("MAP minimum advertised price and brand discount exclusions")`. Expect PRICE-RULES-2026-001.
5. Retrieve similar past flags. Call `retrieve("compliance flag examples for [campaign category, for example Beauty or Home]")`. Expect COMP-EX-2026-001.
6. Call the MCP tool `check_pricing_conflicts` with the SKU list and the discount_pct. The tool returns any SKUs that violate MAP or that fall into an excluded category.
7. Scan the campaign copy for banned words by calling `helpers.scan_for_banned_words(copy)`. Do not enumerate the banned list from memory, the helper holds the authoritative list.
8. Check the tagline against the approved list by calling `helpers.check_tagline(tagline)`.
9. Check that any "up to X percent off" claim includes the required "starting at" minimum by calling `helpers.check_pricing_language(copy)`.
10. For each of the three findings (brand_alignment, disclaimers, pricing_cross_check) the LLM writes the human readable reason string. Status (pass, warn, fail) is set based on what the helpers and the MCP tool returned.
11. Call `helpers.assemble_report(brand_alignment, disclaimers, pricing_cross_check, retrieved_docs)`. The helper computes the `recommended_action` value (proceed or revise) and packages the final object.
12. Write the assembled object to workflow_state.json under `compliance_check`.
13. Update `status` to `in_compliance_check`. The orchestrator handles the next handoff based on `recommended_action`.

The LLM does not compute `recommended_action` directly. It assembles the inputs and calls the helper.

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

## Worked example

Input campaign block:

```json
{
  "title": "Spring Beauty Refresh",
  "copy": "Up to 40 percent off on your favorite Beauty brands. Refresh your routine for spring.",
  "tagline": "The Magic of Macys",
  "skus": ["BTY-001", "BTY-045", "BTY-112"],
  "discount_pct": 40
}
```

Retrieval pulls BRAND-GL-2026-001, LEGAL-DIS-2026-002, PRICE-RULES-2026-001, COMP-EX-2026-001.

`helpers.scan_for_banned_words(copy)` returns `[]`. `helpers.check_tagline("The Magic of Macys")` returns `True`. `helpers.check_pricing_language(copy)` returns `{"has_up_to_claim": true, "has_minimum_clause": false, "minimum_required": true}`. The MCP tool `check_pricing_conflicts` flags BTY-001 as Lancome (MAP enforced) where the 40 percent discount requires written Merchandising approval.

`helpers.assemble_report(...)` returns:

```json
{
  "brand_alignment": {
    "status": "pass",
    "reason": "Tagline matches approved list. No banned words detected.",
    "cited_doc": "BRAND-GL-2026-001"
  },
  "disclaimers": {
    "status": "fail",
    "reason": "Up to 40 percent off claim missing required starting at minimum.",
    "cited_doc": "LEGAL-DIS-2026-002"
  },
  "pricing_cross_check": {
    "status": "warn",
    "reason": "BTY-001 is Lancome (MAP enforced). 40 percent discount above MAP requires written Merchandising approval.",
    "cited_doc": "PRICE-RULES-2026-001"
  },
  "recommended_action": "revise",
  "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001", "COMP-EX-2026-001"]
}
```

## Handoff

* If `recommended_action == "proceed"`, set status to `in_vp_review`. Next skill: `approval-brief-generator`.
* If `recommended_action == "revise"`, set status to `revision_requested` and return the compliance_check object to Sarah. Sarah fixes and resubmits, which loops back to `compliance-pre-check`.
