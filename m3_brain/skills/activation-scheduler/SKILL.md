# Activation Scheduler

**Workflow step:** 8, draft the channel schedule for the media coordinator
**Owner persona:** Media Coordinator (the skill drafts, a human confirms)
**Input from previous step:** localized_variants list plus the campaign block from workflow_state.json
**Output to next step:** activation_schedule object written to workflow_state.json
**RAG retrieval:** light. Past activation timing patterns from retros. Typical hits: RETRO-SP-2025-BTY, RETRO-Q4-2025
**MCP tools called:** none

## When to use this skill

Run this skill once `localized_variants` is populated and every region in `campaign.regions` has a variant entry. The skill drafts the channel schedule (email send times, paid social windows, display caps, in store signage windows) per region with timezone aware times. The media coordinator confirms the draft before anything ships.

## Instructions

1. Load the campaign block and `localized_variants` from data/workflow_state.json.
2. Retrieve past activation timing patterns. Call `retrieve("activation timing for [campaign category] across email social and display channels")`. Expect RETRO-SP-2025-BTY for Beauty or RETRO-Q4-2025 for Holiday.
3. For each variant in `localized_variants`:
   a. Call `helpers.region_to_timezone(region)` to get the IANA timezone (for example `America/New_York`, `America/Los_Angeles`, `America/Chicago`, `America/Puerto_Rico`, `America/Toronto`).
   b. Call `helpers.compute_send_time(timezone, launch_date, hour_local=10)` to get the email send slot expressed in UTC. The helper does the timezone math.
   c. Call `helpers.peak_social_window(timezone)` to get the 6 PM to 9 PM local window for paid social.
   d. Call `helpers.display_cap(estimated_spend, region)` to determine the per user per day impression cap.
   e. Call `helpers.signage_window(timezone)` to get the in store signage window aligned with standard store hours.
4. Call `helpers.assemble_schedule(per_region, retrieved_docs)` to package the per region per channel schedule plus the `human_confirmation_required` flag set to True.
5. Write the schedule object to workflow_state.json under `activation_schedule`.
6. Update `status` to `scheduled`.

The LLM has no business doing timezone math. The helpers do every numeric and time conversion. The LLM packages the result.

## RAG retrieval queries

| Query | Expected doc IDs |
|-------|------------------|
| activation timing for Beauty campaign across email social display | RETRO-SP-2025-BTY |
| activation timing for Holiday campaign | RETRO-Q4-2025 |

## Output schema

```json
{
  "schedule_by_region": [
    {
      "region": "string",
      "timezone": "string, IANA timezone",
      "email_send_utc": "ISO 8601 timestamp",
      "paid_social_window_local": "string, for example 18:00 to 21:00",
      "display_frequency_cap": "integer, impressions per user per day",
      "signage_window_local": "string, for example 10:00 to 21:00"
    }
  ],
  "human_confirmation_required": true,
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}
```

## Worked example

Input: 4 variants for NY, CA, FL, TX. `campaign.estimated_spend = 350000`. Launch date `2026-05-13`.

Retrieval pulls RETRO-SP-2025-BTY. The retro shows Beauty performs best with morning email (10 AM local) and evening paid social (6 to 9 PM local).

The helpers run the timezone math. NY and FL are `America/New_York` (UTC minus 4 in May). CA is `America/Los_Angeles` (UTC minus 7 in May). TX is `America/Chicago` (UTC minus 5 in May). 10 AM local maps to:

* NY: `2026-05-13T14:00:00Z`
* CA: `2026-05-13T17:00:00Z`
* FL: `2026-05-13T14:00:00Z`
* TX: `2026-05-13T15:00:00Z`

`helpers.display_cap(350000, region)` returns 3 (spend is under $500K, so the standard cap applies).

Output `activation_schedule` (truncated to two regions):

```json
{
  "schedule_by_region": [
    {
      "region": "NY",
      "timezone": "America/New_York",
      "email_send_utc": "2026-05-13T14:00:00Z",
      "paid_social_window_local": "18:00 to 21:00",
      "display_frequency_cap": 3,
      "signage_window_local": "10:00 to 21:00"
    },
    {
      "region": "CA",
      "timezone": "America/Los_Angeles",
      "email_send_utc": "2026-05-13T17:00:00Z",
      "paid_social_window_local": "18:00 to 21:00",
      "display_frequency_cap": 3,
      "signage_window_local": "10:00 to 21:00"
    }
  ],
  "human_confirmation_required": true,
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}
```

## Handoff

The media coordinator opens workflow_state.json, reviews the schedule, and either confirms or edits. On confirm, set `status` to `in_production` and the chain ends. The campaign is live on the channel calendar.
