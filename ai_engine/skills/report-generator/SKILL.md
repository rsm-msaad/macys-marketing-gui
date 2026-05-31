# Report Generator

**Workflow step:** 10, Reporting
**Owner persona:** Marketing Analyst (Anna reviews and finalizes the report)
**Input from previous step:** all step outputs from Steps 1-9 plus the campaign brief and audit log
**Output to next step:** executive_report object with summary, metrics, recommendations
**RAG retrieval:** campaign retro benchmarks for context

## When to use this skill

Run this skill when the campaign has completed Steps 1-9 and the team needs an executive summary for leadership. The report draws from the full audit trail — every decision, approval, edit, rejection, and escalation across the 10-step workflow.

## Instructions

1. Read the current_state which contains all step_outputs from Steps 1-9.
2. Use the retrieved_context (campaign retros) for benchmarking context.
3. Write a 4-6 paragraph executive summary covering:
   - Campaign overview (name, category, target segment, budget)
   - Key decisions made (segment selected, SKUs locked, compliance findings, approval outcome)
   - Performance metrics if available from Step 9
   - Recommendations for next campaign cycle
   - Risks or concerns identified during the workflow
4. Extract key metrics into a structured object.
5. List actionable recommendations and any risks.

Write in a professional, concise C-suite style. Reference specific data from the step outputs, not generic statements. Every claim should trace back to an actual step output.

## Output format

CRITICAL: Return ONLY a JSON object. No explanatory text before or after. No markdown code fences.

```json
{
  "executive_summary": "string — 4-6 paragraphs of markdown prose",
  "key_metrics": {
    "segment_targeted": "string",
    "skus_selected": 0,
    "compliance_status": "string",
    "approval_recommendation": "string",
    "locale_variants": 0
  },
  "recommendations": ["string"],
  "risks_and_concerns": ["string"],
  "retrieved_docs": ["string"]
}
```

## Handoff

Anna (Marketing Analyst) reviews the generated report, edits in business context and qualitative learnings, then sends to leadership.
