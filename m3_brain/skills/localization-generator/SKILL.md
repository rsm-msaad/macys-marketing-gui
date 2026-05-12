# Localization Generator

**Workflow step:** 7, generate regional variants of an approved campaign
**Owner persona:** Diego (the skill runs automatically once the VP approves)
**Input from previous step:** approved campaign block plus target regions list from workflow_state.json
**Output to next step:** localized_variants list written to workflow_state.json
**RAG retrieval:** heavy. Localization style guide and DAM tagging policy. Typical hits: LOC-STYLE-2025-002, DAM-TAG-2025-005
**MCP tools called:** find_dam_assets, generate_locale_variants

## When to use this skill

Run this skill the moment a campaign clears VP approval and has a regions list that includes any non English market or any region with a holiday overlay relevant to the launch window. The skill produces one variant per region with the right language, the right pricing, and the right regional context (holidays, tier names, currency). The variants land in workflow_state.json ready for the activation scheduler.

## Instructions

1. Load the campaign block and the regions list from data/workflow_state.json.
2. Retrieve the localization style guide. Call `retrieve("localization rules for [region] including holidays pricing variations and Star Rewards tier names")`. Expect LOC-STYLE-2025-002.
3. Retrieve the DAM tagging policy. Call `retrieve("DAM asset usage rights and tagging for regional campaigns and model release expiration")`. Expect DAM-TAG-2025-005.
4. For each region in `campaign.regions`:
   a. Call `helpers.region_to_language(region)` to get the language code (`en`, `es`, `fr_ca`, etc).
   b. Call the MCP tool `find_dam_assets` with `category`, `region`, and `rights_required="active"`. The tool returns asset IDs that have current model releases and the right regional usage rights.
   c. Call the MCP tool `generate_locale_variants` with the source copy, the target language, and any context hints pulled from the style guide (the fixed Star Rewards tier name for the region, the pricing translation phrases, holiday references).
   d. Call `helpers.apply_regional_pricing(discount_pct, region, category)` to surface any regional pricing override (notably Beauty and Fragrance in Puerto Rico).
   e. Call `helpers.holiday_overlay(region, campaign_window_month)` to flag any regional holiday that falls in the launch window (Three Kings Day, Lunar New Year, Dia de los Muertos, Quebec National Holiday).
5. Call `helpers.assemble_variants(...)` to package each region's language, localized copy, localized tagline, asset IDs, pricing note, holiday overlay, and the retrieved doc IDs.
6. Write the variants list to workflow_state.json under `localized_variants`.
7. Update `status` to `in_localization`.

The LLM does not translate copy from memory. The MCP tool `generate_locale_variants` returns the translation, the helper supplies regional context, and the LLM stitches the variant object together.

## RAG retrieval queries

| Query | Expected doc IDs |
|-------|------------------|
| localization rules for FL including holidays pricing variations | LOC-STYLE-2025-002 |
| localization rules for PR including Three Kings Day and Platino tier | LOC-STYLE-2025-002 |
| DAM asset usage rights and tagging for regional campaigns | DAM-TAG-2025-005 |

## Output schema

```json
[
  {
    "region": "string",
    "language": "string",
    "localized_copy": "string",
    "localized_tagline": "string",
    "asset_ids": ["string"],
    "pricing_note": "string",
    "holiday_overlay": "string or null",
    "retrieved_docs": ["LOC-STYLE-2025-002", "DAM-TAG-2025-005"]
  }
]
```

## Worked example

Input `campaign.regions`: `["NY", "CA", "FL", "TX"]`. Campaign category: Beauty. Launch month: May (5).

For FL and TX, `helpers.region_to_language` returns `es`. The MCP tool `generate_locale_variants` returns `"Hasta 40 por ciento de descuento, desde 10 por ciento de descuento, en tus marcas favoritas de belleza. Renueva tu rutina para la primavera."` for both. NY and CA stay in English.

`helpers.holiday_overlay(region, 5)` returns `null` for all four regions (no May holidays in the standing list).

Output `localized_variants` (truncated to two regions for brevity):

```json
[
  {
    "region": "FL",
    "language": "es",
    "localized_copy": "Hasta 40 por ciento de descuento, desde 10 por ciento de descuento, en tus marcas favoritas de belleza. Renueva tu rutina para la primavera.",
    "localized_tagline": "La Magia de Macys",
    "asset_ids": ["DAM-BTY-SP26-014", "DAM-BTY-SP26-021"],
    "pricing_note": "Standard continental pricing applies.",
    "holiday_overlay": null,
    "retrieved_docs": ["LOC-STYLE-2025-002", "DAM-TAG-2025-005"]
  },
  {
    "region": "TX",
    "language": "es",
    "localized_copy": "Hasta 40 por ciento de descuento, desde 10 por ciento de descuento, en tus marcas favoritas de belleza. Renueva tu rutina para la primavera.",
    "localized_tagline": "La Magia de Macys",
    "asset_ids": ["DAM-BTY-SP26-014", "DAM-BTY-SP26-022"],
    "pricing_note": "Standard continental pricing applies.",
    "holiday_overlay": null,
    "retrieved_docs": ["LOC-STYLE-2025-002", "DAM-TAG-2025-005"]
  }
]
```

## Handoff

When every region in `campaign.regions` has a variant entry, set `status` to `ready_for_scheduling`. Next skill: `activation-scheduler`.
