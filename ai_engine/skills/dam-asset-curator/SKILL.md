---
agentic: true
---

# DAM Asset Curator

**Workflow step:** 4, Creative Production
**Owner persona:** Abdullah (Senior Designer reviews the curated shortlist)
**Input from previous step:** campaign brief, selected segment from Step 2, locked-in SKUs from Step 3
**Output to next step:** curated asset shortlist with rationale, written to workflow state
**RAG retrieval:** DAM tagging policy (DAM-POLICY-2026-001) for rights and tag conventions
**MCP tools available:** find_dam_assets (search DAM by category and region with rights filtering)

## Agentic mode

This skill runs in agentic mode. You curate a shortlist of DAM assets for a campaign by reasoning about what visual assets would best match the campaign's mood, audience, brand voice, and seasonal context — then calling the find_dam_assets MCP tool to search the DAM.

**Available tools:**
- `find_dam_assets(category, region, max_results)` — Searches the DAM database for assets matching a category and region with active model release rights. Returns asset IDs, filenames, tags, and region rights. Call this to find assets that match the campaign.

**When to call tools:**
- You SHOULD call find_dam_assets at least once with the campaign's primary category and a key region.
- If the first search returns few results, broaden the category or try a different region.
- If you want region-specific assets (e.g., for a multi-region campaign), call the tool multiple times with different regions.
- Think about what tags and categories would produce the best visual match before calling.

## Instructions

1. Read the campaign context: brief name, objective, target customer, category, selected segment, SKU count.
2. Reason about what visual direction would best serve this campaign:
   - What mood fits? (luxury, everyday, seasonal, festive)
   - What asset types are most useful? (product shots, lifestyle, banners)
   - What regions need coverage?
3. Call `find_dam_assets` with the campaign category and primary region.
4. Evaluate the results. If the returned assets have weak relevance or too few results, refine your search:
   - Try a broader category
   - Try additional regions
   - Call the tool again with adjusted parameters
5. Select the top assets and provide a brief rationale for each selection.
6. Produce the output JSON.

## Output format

CRITICAL: When you are done curating and have called all tools you need, your FINAL response must be ONLY a JSON object. No explanatory text before or after. No markdown code fences. Just the raw JSON object matching this schema:

```json
{
  "curated_assets": [
    {
      "asset_id": "string",
      "filename": "string",
      "tags": ["string"],
      "region_rights": "string",
      "rationale": "string — why this asset fits the campaign"
    }
  ],
  "visual_direction": "string — overall mood and direction note for the designer",
  "search_summary": "string — what you searched for and why",
  "total_searched": 0,
  "total_curated": 0,
  "retrieved_docs": ["DAM-POLICY-2026-001"]
}
```

## Handoff

Abdullah reviews the curated shortlist and locks in the final asset selection before Layout Assembly at Step 5.
