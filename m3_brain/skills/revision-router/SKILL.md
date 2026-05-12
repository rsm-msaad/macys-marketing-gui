# Revision Router

**Workflow step:** 6c, parse and route VP revision requests
**Owner persona:** VP (the skill runs automatically when the VP clicks revise)
**Input from previous step:** revision_comment string plus campaign context from workflow_state.json
**Output to next step:** revision_routing object written to workflow_state.json
**RAG retrieval:** medium. Past similar revision tickets. Typical hits: TICKET-INC-2025-4471, TICKET-INC-2026-0212
**MCP tools called:** none

## When to use this skill

Run this skill when the VP clicks revise on the approval brief. The skill reads the free text revision comment, classifies what the VP is actually asking for, looks at how similar past revisions were handled, and produces a routing decision that lands on a named owner with an urgency level. The VP does not have to pick a routing target by hand.

## Instructions

1. Load `revision_comment` and the campaign block from data/workflow_state.json.
2. Classify the change type. The LLM reads the revision comment and picks one of: `copy`, `imagery`, `targeting`, `pricing`, `legal`, `localization`. This is a text understanding step, the LLM does it directly.
3. Retrieve similar past revision tickets. Call `retrieve("past revision tickets for [change_type] changes in [campaign category]")`. Expect TICKET-INC-2025-4471 for copy or pricing revisions, TICKET-INC-2026-0212 as the clean reference for comparison.
4. Call `helpers.lookup_owner(change_type)` to get the named owner. The mapping is deterministic, see the table below.
5. Call `helpers.assess_urgency(campaign)` to compute urgency. The helper applies the rule: spend over $500K plus launch within 5 business days returns `high`, either of those conditions alone returns `medium`, otherwise `low`.
6. The LLM writes a `one_line_summary` of the revision request, in clear plain language so the owner can act without re reading the original comment.
7. Call `helpers.assemble_routing(...)` to package change_type, owner, urgency, one_line_summary, similar_past_tickets, and retrieved_docs.
8. Write the routing object to workflow_state.json under `revision_routing`.
9. Update `status` to `revision_requested`.

## Owner mapping

| change_type | Owner |
|-------------|-------|
| copy | Sarah (campaign manager) |
| imagery | Priya (creative production) |
| targeting | Sarah (campaign manager) |
| pricing | Merchandising (Anna) |
| legal | Legal team |
| localization | Diego (localization lead) |

## RAG retrieval queries

| Query | Expected doc IDs |
|-------|------------------|
| past revision tickets for copy changes in Beauty | TICKET-INC-2025-4471 |
| past revision tickets for pricing changes | TICKET-INC-2025-4471 |
| examples of clean approval cycles for benchmark | TICKET-INC-2026-0212 |

## Output schema

```json
{
  "change_type": "copy | imagery | targeting | pricing | legal | localization",
  "owner": "string, named person or team",
  "urgency": "low | medium | high",
  "one_line_summary": "string",
  "similar_past_tickets": ["TICKET-INC-2025-4471"],
  "retrieved_docs": ["TICKET-INC-2025-4471"]
}
```

## Worked example

Input `revision_comment`: "The up to 40 percent off line in the hero needs the starting at minimum, and confirm Lancome is cleared with Merch."

Classification: the VP is asking about pricing language and a MAP brand clearance. `change_type` is `pricing`.

Retrieval pulls TICKET-INC-2025-4471 (near identical pattern: Memorial Day Home, missing starting at minimum, MAP brand confirmation).

`helpers.lookup_owner("pricing")` returns `"Merchandising (Anna)"`.

`helpers.assess_urgency(campaign)` reads `estimated_spend = 350000` and `business_days_to_launch = 6`. Neither condition fires high. Spend is under $500K and timeline is over 5 days. Result: `low`. (If launch had been within 5 business days, this would have returned `medium`.)

Output routing:

```json
{
  "change_type": "pricing",
  "owner": "Merchandising (Anna)",
  "urgency": "low",
  "one_line_summary": "Add starting at minimum to the up to 40 percent off claim and confirm Lancome MAP clearance with Merchandising.",
  "similar_past_tickets": ["TICKET-INC-2025-4471"],
  "retrieved_docs": ["TICKET-INC-2025-4471"]
}
```

## Handoff

Anna receives the routed task with the `one_line_summary` plus the link to TICKET-INC-2025-4471 for reference. After Sarah and Anna jointly revise the campaign (update copy, confirm Merch clearance), the chain restarts at `compliance-pre-check` with the updated state.
