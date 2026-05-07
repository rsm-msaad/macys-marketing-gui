---
name: dam-asset-finder
description: Find clean, on-brief DAM assets for a Macy's marketing campaign. Use when a designer asks "find me hero photos for X", "what assets do we have for this brief", or describes a campaign theme and needs visuals. The skill queries the DAM table at data/macys.db, filters out degraded, expired, and low resolution assets, ranks the remainder by tag/asset_type relevance to the brief plus quality boosts (recent, 4K, HD), and returns the top candidates.
---

# DAM Asset Finder

Use this skill when a designer (Priya in our story) describes a campaign and needs hero photos, lifestyle shots, or product shots from the Digital Asset Management system. The DAM contains 5,000 assets, of which roughly 30 percent are intentionally degraded (mislabeled, duplicate, low resolution, orphaned, expired). Without help, the designer scrolls through hundreds of noisy results to find a handful of usable ones. The script does the filtering and ranking, the designer makes the final pick.

This skill maps to workflow steps 4 and 5 (Creative Production and Layout Assembly).

## Analytical approach

1. Pull every row from `dam_assets`.
2. **Filter** in this order, attributing each removed asset to the first reason it fails:
   * `degradation_flag != 'clean'` (mislabeled, duplicate, lowres, orphaned, expired)
   * `usage_rights = 'expired'`
   * resolution below 1024 by 768 in total pixels
3. **Score** the remaining assets:
   * Raw relevance, the fraction of brief tokens that appear in the asset's tags or asset_type after lowercasing, splitting on hyphens, and dropping common stopwords.
   * Recency boost, +0.20 if the asset's `created_date` is within the last 365 days.
   * Resolution boost, +0.10 for 4K and above, +0.05 for HD (1920 by 1080 up to 4K).
   * Photo backed boost, +0.50 if the asset's `filename` exists on disk in `data/images/dam/`. The directory is scanned once per call. This is the GUI demo lever: it pushes the small set of Unsplash linked assets to the top of the ranking so the thumbnail grid renders real photos instead of empty placeholders.
   * Composite score is the sum, clamped to the 0 to 1 range. This is what the dict reports as `relevance_score`.
4. **Rank** by `(has_photo, relevance_score, asset_id)` descending. Photo backed assets are bucketed strictly above non photo backed assets, then sorted within each bucket by relevance and asset_id. If the photo backed bucket has fewer than `max_results` candidates the ranking falls through to the non photo bucket so the result list is always full.

## What the script needs

| Input | Type | What it is |
| :--- | :--- | :--- |
| `brief_description` | string | Free text label for the campaign (e.g. `"Mother's Day Beauty Event"`). Used both for the printed header and to score relevance. |
| `max_results` | int | How many assets to return after ranking. Default 12. |

## What the script returns

`find_assets(brief_description, max_results)` returns a list of asset dicts in rank order. Each dict has:

| Field | Type | What it is |
| :--- | :--- | :--- |
| `rank` | int | Position in the ranked output, starting at 1. |
| `asset_id` | int | Primary key from `dam_assets`. |
| `filename` | string | The asset's filename on disk. |
| `asset_type` | string | One of `hero`, `product`, `lifestyle`, `banner`, `social`. |
| `tags` | list[str] | Parsed from the JSON list stored in `dam_assets.tags`. |
| `resolution` | string | E.g. `"1920x1080"`. |
| `usage_rights` | string | `free` or `restricted` after filtering. |
| `relevance_score` | float | Composite score in 0 to 1 (raw relevance plus recency, resolution, and photo backed boosts, clamped). |
| `quality_flag` | string | Always `"clean"` in the returned set, since degraded assets are filtered out. |
| `has_photo` | bool | `True` when the asset's filename is present in `data/images/dam/` on the local filesystem. The GUI uses this implicitly via the bucketed sort. |

The companion function `search_with_stats(brief, max_results, db_path, images_dir)` returns the same list along with a stats dict (`total_searched`, `filtered_out` breakdown by reason, `kept`, `returned`, `avg_relevance`, `photo_backed_in_pool`, `photo_backed_in_top`). The terminal demo uses this to print the analytics summary.

`images_dir` defaults to `data/images/dam/` at the repo root. Passing a non existent path disables the photo backed boost (useful for tests that want pure relevance ranking).

## How to use this skill

1. **Extract** the campaign description from the user's message. If they did not give one, ask for one short phrase.
2. **Run** the script from the repo root:

   ```bash
   uv run python skills/dam-asset-finder/search.py "Mother's Day Beauty Event"
   ```

   Optionally pass a second arg to override `max_results`:

   ```bash
   uv run python skills/dam-asset-finder/search.py "Spring Style Refresh" 6
   ```

3. **Report** the printed summary plus the top results to the user. The designer makes the final pick.

## Database fields used

* `dam_assets.asset_id`, `filename`, `asset_type`, `tags`, `season`, `brand`, `created_date`, `resolution`, `usage_rights`, `degradation_flag`.

`tags` is stored as a JSON array string (e.g. `'["beauty", "spring", "mothers-day"]'`); the script parses it via `json.loads`.

## Reproducibility and limits

The pipeline is fully deterministic given the database. There is no random sampling; tied scores break on `asset_id` ascending. The relevance scoring is a simple bag-of-words match against tags and asset type, on purpose: this is light analytics, not embeddings, and the human reviewer is expected to make the final aesthetic call. Swapping in semantic search would be a worthwhile follow up.
