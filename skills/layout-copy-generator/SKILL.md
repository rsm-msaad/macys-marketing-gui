# Layout Copy Generator

**Workflow step:** 5, Layout Assembly
**Owner persona:** Abdullah (senior designer reviews, Merna approves)
**Input from previous steps:** campaign brief, selected segment (step 2), approved SKUs (step 3), DAM assets (step 4)
**Output to next step:** layout_copy object with 4 placements, each containing tagline, body, cta, visual_direction

## When to use this skill

Run this skill when the campaign reaches Step 5 and the designer needs marketing copy for each ad placement. The skill generates copy that matches the campaign brief, audience tone, and placement constraints. The designer reviews the copy alongside the selected DAM assets and layout specs, then approves or requests edits.

## Why this is a skill (not an automation)

Writing marketing copy that fits brand voice, character limits, and audience tone requires LLM judgment. The same brief could yield different (equally valid) taglines and body copy. There are no deterministic rules that produce good ad copy.

## Instructions

1. Read the campaign context: brief (name, category, objective, target_customer, promotional_offer), selected segment, approved SKUs, and DAM assets.
2. For each of 4 placements (web_banner, email, mobile, in_store_signage), generate:
   - **tagline**: 5 to 10 words, punchy, captures the campaign theme
   - **body**: 10 to 25 words, expands on the tagline with the key offer
   - **cta**: 2 to 5 words, action oriented (e.g., "Shop the edit", "Get yours now")
   - **visual_direction**: 1 sentence suggesting what the designer should emphasize visually

3. Tone guidelines:
   - Match the audience segment: luxury audience = elegant and aspirational, broad audience = warm and inviting
   - Mother's Day campaigns: warmth, gratitude, gift language
   - Spring/summer campaigns: freshness, color, renewal
   - Always sound like Macy's: approachable department store, not too clinical, not too casual

4. Character limits per placement:
   - web_banner: tagline max 50 chars, body max 100 chars, cta max 25 chars
   - email: tagline max 60 chars, body max 200 chars, cta max 25 chars
   - mobile: tagline max 40 chars, body max 80 chars, cta max 20 chars
   - in_store_signage: tagline max 40 chars, body max 60 chars, cta max 20 chars

5. Return ONLY a JSON object matching the output schema. No commentary.

## Output schema

```json
{
  "web_banner": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "email": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "mobile": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "in_store_signage": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  }
}
```
