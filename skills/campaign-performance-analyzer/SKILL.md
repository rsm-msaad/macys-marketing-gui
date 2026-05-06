---
name: campaign-performance-analyzer
description: Pull a Macy's campaign's daily performance from `data/macys.db`, run last touch attribution across channels, segments, and SKUs, and forecast the next N days of revenue, conversions, and ROAS using linear regression with 80 percent confidence intervals. Use when an analyst (Anna in our story) needs a same morning campaign readout. The script returns a structured analysis dict and a paste ready executive summary.
---

# Campaign Performance Analyzer

This skill is the analytical heavyweight of the project. It maps to **workflow step 9 (Monitoring)**, the fully automated step where data pulls and analytics run continuously. The natural handoff is **workflow step 10 (Reporting)**, where Anna takes the auto generated readout, layers in business context, and forwards to leadership. AI does the math; Anna owns the narrative that gets sent up the chain.

The skill ships two analytics components, fulfilling the "two analytics" requirement for Milestone 2:

1. **Attribution analysis** (last touch) across channel, customer segment, and SKU.
2. **Time series forecasting** via linear regression with 80 percent confidence intervals over the last 30 days of campaign performance.

Currently Anna spends a full day reconciling five reporting systems (Salesforce Marketing Cloud, Google Analytics, Macy's Media Network, the email platform, and in-store POS) into a single readout. By the time she is done, the campaign window has closed and the insights are too late to course correct mid flight. This skill runs in seconds against the unified `macys.db` and outputs a paste ready summary.

## Analytical approach

### Attribution

* **By channel.** Aggregate `revenue`, `cost`, `conversions`, `impressions`, `clicks` from `campaign_performance` grouped by `channel`. ROAS is `revenue / cost`, CAC is `cost / conversions`. Channels are ranked by ROAS descending. The "worst channel" is the lowest ROAS channel that holds at least 5 percent of total spend (so a tiny experimental channel does not steal the headline).
* **By segment.** The `campaign_performance` table does not store a segment column, so segment attribution joins `transactions` to `customers` on `customer_id` for purchases that fall inside the campaign window, then groups by `customers.loyalty_tier` (Bronze, Silver, Gold, Platinum). Conversion rate is the **unique buyer rate**: `COUNT(DISTINCT customer_id with >= 1 purchase) / customer_base_in_tier`. A customer who buys five times still counts as one conversion. The result is bounded in [0, 100 percent] so it reads as a probability rather than a count. Lift is `(tier_rate - overall_rate) / overall_rate`. This is the cleanest segment dimension actually present in the data.
* **By SKU.** Top 10 by revenue and top 10 by units sold over the campaign window, joining `transactions` to `sku_catalog`.

### Forecast

* Pull the last 30 days of campaign performance for the requested campaign (sum across channels per day) and run linear regression on `(day_index, metric)` for revenue, conversions, and daily ROAS.
* The forecast point estimate is `slope * (day_index_at_horizon) + intercept`.
* Confidence interval uses the OLS residual standard deviation under a normal approximation: 80 percent CI = predicted ± 1.2816 * residual_std.
* `trend_direction` is `up` if the predicted value is more than 5 percent above the trailing 7 day mean, `down` if more than 5 percent below, otherwise `flat`.
* If the campaign has fewer than 14 days of history, the forecast block returns `{"forecast_status": "insufficient_data"}` with a clear message and `revenue/conversions/roas` set to `None`.

### Summary

A 4 to 5 sentence plain English summary is generated from the attribution and forecast outputs using deterministic templates. Future iterations could swap the templates for an LLM call against `utils.connect.ask()`, keeping the calculations in Python. Anna pastes the summary into her readout and edits as needed.

## What the script needs

| Input | Type | What it is |
| :--- | :--- | :--- |
| `campaign_id` | int | The campaign to analyze. Must exist in `campaigns`. |
| `forecast_days` | int | How many days forward to project. Default 14. |
| `db_path` | path | Path to `macys.db`. Defaults to repo `data/macys.db`. |

## What the script returns

`analyze_campaign(campaign_id, forecast_days)` returns a dict with these top level keys:

| Key | What it is |
| :--- | :--- |
| `campaign_id`, `campaign_name`, `campaign_status` | basics |
| `campaign_window` | `{start, end, days}`, capped at today and at the end of the performance series |
| `totals` | `{revenue, spend, conversions, roas}` summed across channels |
| `attribution.by_channel` | list of dicts, one per channel, sorted by ROAS desc, with `rank` |
| `attribution.by_segment` | list of dicts by loyalty tier, sorted by `lift_vs_avg` desc |
| `attribution.by_sku_revenue` / `by_sku_units` | top 10 by each |
| `attribution.top_channel` / `worst_channel` / `top_segment` | quick references |
| `forecast` | `{horizon_days, history_days, forecast_status, revenue, conversions, roas}` |
| `summary` | paste ready 4 to 5 sentence narrative |
| `generated_at` | UTC ISO timestamp |

Each forecast metric block has `predicted`, `lower_bound`, `upper_bound`, `trend_direction`.

## How to use this skill

1. **Pick a campaign id.** The default for the demo is campaign 7 (Fall Style Edit 2025), which has the richest performance history (605 daily rows across 5 channels).

   ```bash
   uv run python skills/campaign-performance-analyzer/analyze.py 7
   uv run python skills/campaign-performance-analyzer/analyze.py 7 --forecast-days 21
   ```

2. **Read** the printed report. It includes the channel and segment attribution tables, the top SKUs, the 14 day forecast with 80 percent CIs, and the executive summary.

3. **Hand off** the summary to Anna. She layers in business context (e.g., "social over indexed because we ran an influencer push the last weekend") and sends to leadership.

## Edge cases

* **Campaign has no performance rows yet.** The script still returns a valid analysis dict: channel attribution will be empty, segment attribution still runs against the planned window, forecast returns `insufficient_data`. The summary explains why.
* **Campaign has fewer than 14 days of history.** Forecast returns `insufficient_data` with a clear message.
* **Single channel campaign.** Attribution still works; `top_channel` and `worst_channel` may be the same.
* **`campaign_id` does not exist.** Raises `ValueError`.

## Database fields used

* `campaigns.campaign_id`, `campaign_name`, `target_segment`, `start_date`, `end_date`, `total_budget`, `status`
* `campaign_performance.campaign_id`, `channel`, `date`, `impressions`, `clicks`, `conversions`, `revenue`, `cost`
* `transactions.customer_id`, `sku_id`, `transaction_date`, `unit_price`, `quantity`, `discount_pct`
* `customers.customer_id`, `loyalty_tier`
* `sku_catalog.sku_id`, `product_name`

## Reproducibility

The pipeline is deterministic given `(campaign_id, forecast_days, db_path)`. The only non deterministic field is `generated_at`, which records the UTC clock at run time.
