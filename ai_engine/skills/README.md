# M3 Chained Skills, Workflow Steps 6 to 8

## Overview

The Milestone 3 chained skills extend the Macys Marketing AI Coworker beyond the single shot Milestone 2 baseline. Each skill covers one slice of the marketing workflow between Compliance Pre Check (step 6a) and Activation (step 8). Together they let a campaign move from Sarah hitting submit, through VP review, through localization, and onto the channel calendar with the human stepping in only at decision points.

## Skills in the chain

| Step | Skill folder | Owner persona | RAG load |
|------|--------------|---------------|----------|
| 6a | [compliance-pre-check](compliance-pre-check/) | Sarah (auto) | Heavy |
| 6b | [approval-brief-generator](approval-brief-generator/) | VP (auto) | Light |
| 6c | [revision-router](revision-router/) | VP (auto on revise) | Medium |
| 7  | [localization-generator](localization-generator/) | Diego (auto on approve) | Heavy |
| 8  | [activation-scheduler](activation-scheduler/) | Media Coordinator (auto, human confirms) | Light |

## Flow

```
Sarah submits
    |
    v
(1) compliance pre check        step 6a
    |
    v
(2) approval brief generator    step 6b
    |
    v
VP decides
    |
    |  if approve:
    |    v
    |  (4) localization generator    step 7
    |    |
    |    v
    |  (5) activation scheduler      step 8
    |    |
    |    v
    |  Media coordinator confirms
    |    |
    |    v
    |  In Production
    |
    |  if revise:
    |    v
    |  (3) revision router           step 6c
    |    |
    |    v
    |  Owner revises, loop back to (1)
    |
    |  if reject:
    |    stop
```

Numbered text version of the same flow:

1. Sarah submits a campaign.
2. compliance pre check runs (step 6a). On revise, loop to step 1. On proceed, go to step 3.
3. approval brief generator runs (step 6b).
4. VP decides.
   * approve, go to step 6.
   * revise, go to step 5.
   * reject, stop the chain.
5. revision router runs (step 6c). Owner revises, loop to step 2.
6. localization generator runs (step 7).
7. activation scheduler runs (step 8).
8. Media coordinator confirms, status moves to In Production.

## M1 workflow steps and M2 skills extended

| M3 skill | M1 step | M2 skill it extends |
|----------|---------|----------------------|
| compliance-pre-check | 6, compliance and brand pre check | brand_check, legal_check |
| approval-brief-generator | 7, approval routing | new in M3 |
| revision-router | 7, approval routing | new in M3 |
| localization-generator | 8, localization and scheduling | localize_copy |
| activation-scheduler | 8, localization and scheduling | calendar_draft |

## Shared state

All five skills read and write a single state file at [../data/workflow_state.json](../data/workflow_state.json). The structure is:

```json
{
  "campaign_id": "string",
  "status": "submitted_by_sarah | in_compliance_check | in_vp_review | revision_requested | approved | in_localization | ready_for_scheduling | scheduled | in_production | rejected",
  "submitted_at": "ISO 8601 timestamp",
  "campaign": {
    "title": "string",
    "audience_segment": "string",
    "copy": "string",
    "tagline": "string",
    "skus": ["list of SKU ids"],
    "discount_pct": "integer",
    "regions": ["list of region codes"],
    "estimated_spend": "integer USD",
    "campaign_manager": "string"
  },
  "compliance_check": "object written by compliance-pre-check, or null",
  "approval_brief": "object written by approval-brief-generator, or null",
  "approval_decision": "approve | revise | reject, or null",
  "revision_routing": "object written by revision-router, or null",
  "localized_variants": "list written by localization-generator, or null",
  "activation_schedule": "object written by activation-scheduler, or null"
}
```

Each skill loads the file, does its work, and writes its output object into the matching top level field. The status string is updated to reflect the next state.

## Handoff logic

The orchestrator picks the next skill based on the current status plus the most recently populated field.

| Current status | Trigger | Next skill |
|----------------|---------|------------|
| submitted_by_sarah | new submission | compliance-pre-check |
| in_compliance_check | compliance_check.recommended_action == proceed | approval-brief-generator |
| in_compliance_check | compliance_check.recommended_action == revise | back to Sarah (out of chain) |
| in_vp_review | approval_decision == approve | localization-generator |
| in_vp_review | approval_decision == revise | revision-router |
| in_vp_review | approval_decision == reject | stop |
| revision_requested | owner finishes the revision | back to compliance-pre-check |
| approved | regions list has more than continental English | localization-generator |
| in_localization | every region has a variant | activation-scheduler |
| ready_for_scheduling | scheduler finishes | media coordinator (human) |
| scheduled | media coordinator confirms | in_production |

## RAG knowledge base

The skills retrieve from the 12 simulated documents in [../rag/knowledge_base/](../rag/knowledge_base/). Each SKILL.md lists the document IDs that skill typically pulls. Retrieval is done through [../rag/retrieval.py](../rag/retrieval.py).

## MCP tools

The deterministic operations exposed to the skills (DAM lookup, pricing conflict check, locale variant generation) are implemented as MCP tools in [../tools/](../tools/) and registered in [../mcp_server/](../mcp_server/). Each SKILL.md lists the tool names the skill calls.

## Why markdown first

Following the Milestone 2 rule from Vincent: skills are markdown first, Python helpers are reserved for deterministic operations (string scans, numeric extraction, timezone math, owner lookups, recommendation rules). The LLM does the natural language work. The helpers do anything that needs to be exact. The model never calculates.
