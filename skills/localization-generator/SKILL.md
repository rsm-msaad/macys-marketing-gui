---
name: localization-generator
description: Generate all 40 regional/placement variants (10 US regions x 4 placements) for a campaign master ad in one shot. Use after a campaign master ad has been approved and Diego (production artist) needs to produce regional variants with regional pricing, regional inventory awareness, and regionally voiced copy. Reads `data/macys.db` and returns a list of variant dicts ready to hand off to traffic. Fully deterministic, no human in the loop.
---

# Localization Generator

This skill is workflow step 7 (Localization), the **fully automated** step. After the campaign master ad has been approved by Brand and Legal, Diego the production artist must spin up regional variants for every placement. Currently this is 3 days of manual InDesign work. This skill produces all 40 variants in one call, with no human review needed mid flight, because every transformation is a deterministic substitution: regional price, regional inventory state, regionally tuned copy, placement specific dimensions.

This is the deterministic substitution path Vincent flagged on Piazza. The "AI generates copy" framing is honest because future iterations could swap the rule based templates with LLM calls keyed off the same regional context dictionary. The pricing math, inventory bucketing, and variant assembly stay deterministic regardless.

## Analytical approach

For each `(sku_id, region, placement)` combination:

1. **Regional pricing.** Look up `regional_pricing.regional_price` for the (sku_id, region) pair. Fall back to `sku_catalog.base_price` and tag `price_flag = "no_regional_data"` when the row is missing. Compute `price_difference_pct = (regional - master) / master`. Tag `price_flag = "significantly_higher"` or `"significantly_lower"` when the absolute deviation exceeds 15 percent.
2. **Regional inventory.** When `regional_pricing.in_stock_locally = 0`, units are 0. Otherwise units are derived from a deterministic MD5 of `f"{region}|{sku_id}"` modulo 200. Bucket into `in_stock` (>50), `low_stock` (1 to 50), `out_of_stock` (0). The hash makes the demo show varied stock counts per region while keeping the output reproducible.
3. **Regionally voiced copy.** Pull from a `REGIONAL_CONTEXT` dictionary (10 entries, one per region) that defines a weather phrase, a lifestyle phrase, and a shopping pattern phrase. Combine with `CATEGORY_VOICE` (per-category hook/noun/verb) inside placement specific templates. Each placement enforces a length budget (web_banner ≤ 8 words, in_store_signage ≤ 5 words, mobile ≤ 10 words, email 12 to 15 words target).
4. **Placement assembly.** Stamp `placement_dimensions`, a synthesized `master_image_reference`, the variant_id (`V-{region_slug}-{placement}-{sku_id:05d}`), and a UTC timestamp.

## What the script needs

| Input | Type | What it is |
| :--- | :--- | :--- |
| `campaign_brief` | string | Free text label for the campaign. Threads through the copy templates as the campaign reference. |
| `master_sku_ids` | list[int] | The master SKUs that need to be localized. The skill produces `len(skus) x len(regions) x len(placements)` variants. |
| `regions` | list[str] or None | Defaults to the 10 US regions in `regional_pricing` (Northeast, Mid-Atlantic, Southeast, Midwest-North, Midwest-South, South, Southwest, Mountain, Pacific-Northwest, Pacific-Southwest). |
| `placements` | list[str] or None | Defaults to `["web_banner", "email", "in_store_signage", "mobile"]`. |

## What the script returns

`generate_variants(...)` returns a list of variant dicts, one per `(sku, region, placement)` combination. Each dict has:

| Field | Type | What it is |
| :--- | :--- | :--- |
| `variant_id` | string | Deterministic id: `V-{region_slug}-{placement}-{sku_id:05d}`. |
| `region`, `placement`, `sku_id`, `sku_name` | basics | |
| `regional_price`, `master_price`, `price_difference_pct` | float | Regional vs base, signed pct. |
| `price_flag` | string, optional | Present only when `\|pct\|` exceeds 15 percent or no regional row exists. |
| `inventory_status` | string | `in_stock`, `low_stock`, or `out_of_stock`. |
| `inventory_units` | int | Per region unit count (0 when out of stock). |
| `copy_headline`, `copy_subhead`, `cta_text` | strings | Regionalized copy, placement aware. |
| `placement_dimensions` | string | E.g. `"1200x628"` for `web_banner`. |
| `master_image_reference` | string | Synthesized filename keyed off product_name and sku_id. |
| `generated_at` | string | UTC ISO timestamp. |

The companion function `generate_variants_with_stats(...)` returns the same list along with an analytics summary (`total_variants`, `regions`, `placements`, `skus`, `by_region`, `by_placement`, `inventory_alerts`, `price_alerts`, `avg_price_diff_pct`).

## How to use this skill

1. **Receive** an approved campaign master ad and the SKU list. The brief and SKU IDs are the inputs.
2. **Run** the script from the repo root. Without `--skus` it picks two Beauty SKUs from `sku_catalog` so the demo runs without args.

   ```bash
   uv run python skills/localization-generator/generate.py "Mother's Day Beauty Event"
   uv run python skills/localization-generator/generate.py "Mother's Day Beauty Event" --skus 1,2
   ```

3. **Hand off** the variant list to traffic. The summary surfaces inventory and pricing alerts that the activation coordinator should triage; the variants themselves are ready to ship.

## Regional context dictionary

Each region has three short phrases that drive the copy templates. Sample:

| Region | weather | lifestyle | shopping |
| :--- | :--- | :--- | :--- |
| Northeast | spring blooms | weekend treat | weekend treat moments |
| Pacific-Northwest | rainy day glow | rainy day self-care | indoor day picks |
| Southwest | warm desert evenings | desert chic | desert-ready style |
| Southeast | porch-side sunshine | porch-side moments | easy southern style |

Per category voice:

| Category | hook | noun | verb |
| :--- | :--- | :--- | :--- |
| Beauty | bold lips | favorite shade | discover |
| Apparel | fresh looks | wardrobe pick | refresh |
| Home | cozy spaces | home essentials | refresh |

These dictionaries are short on purpose. They give the deterministic templates enough variation to feel locally tuned, without spinning up an LLM. Swapping in `utils.connect.ask()` against the same brief and region is a one screen change if a future iteration wants generative copy.

## Database fields used

* `sku_catalog.sku_id`, `product_name`, `category`, `base_price`, `inventory_count`
* `regional_pricing.sku_id`, `region`, `regional_price`, `in_stock_locally`

## Reproducibility

Every transformation is deterministic given `(brief, sku_ids, regions, placements, db_path)`. The synthetic per-region inventory count uses MD5 so it is reproducible across runs and machines. The only non deterministic field is `generated_at`, which records the UTC clock at run time.
