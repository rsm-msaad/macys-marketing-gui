---
name: audience-segment-builder
description: Discover three candidate audience segments for a Macy's marketing campaign brief by running k-means clustering on RFM features (Recency, Frequency, Monetary value). Use when a campaign manager asks "who should I target", "build me an audience", or describes a campaign theme. The skill queries the SQLite CRM at data/macys.db, computes RFM per customer, standardizes the features, fits KMeans with k=3, and returns segment names, counts, RFM averages, top product category, and loyalty tier mix.
---

# Audience Segment Builder

Use this skill when a marketing manager describes a campaign brief and needs to choose an audience to target. The script reads `data/macys.db` directly, computes RFM (Recency, Frequency, Monetary value) per customer, fits a k-means model, and returns three discovered segments along with profiling metrics. Your job is to extract the brief from the user's message and run the script.

## Analytical approach

1. Query `transactions` joined to `customers` and `sku_catalog` to get one row per customer:
   * Recency: days since last transaction (anchored on `MAX(transaction_date)` in the database)
   * Frequency: total transaction count
   * Monetary: total net spend, computed as `SUM(unit_price * quantity * (1 - discount_pct))`
2. Drop customers with zero transactions (RFM is undefined for them).
3. Standardize the three features with `sklearn.preprocessing.StandardScaler`. RFM features live on very different scales (days vs. counts vs. dollars), so standardization is required before distance based clustering.
4. Fit `sklearn.cluster.KMeans(n_clusters=3, random_state=42, n_init=10)`. The fixed seed makes the segments reproducible.
5. Inverse transform the centroids back to the original scale, then auto name the clusters from their RFM signature (see below).
6. Profile each cluster (counts, RFM averages, top product category, loyalty tier mix).

## What the script needs

| Input | Type | What it is |
| :--- | :--- | :--- |
| `brief_description` | string | Free text label for the campaign (e.g. `"Mother's Day Beauty Event"`). Used in the printed header and to bias the recommendation. |

The campaign brief is the only caller facing input. Everything else is read from the database.

## What the script returns

`build_segments(brief_description)` returns a list of three dicts in priority order (high value, mid, low value). Each dict has:

| Field | Type | What it is |
| :--- | :--- | :--- |
| `name` | string | Auto generated segment name (see naming rules below). |
| `definition` | string | One line description of the centroid (recency, frequency, monetary). |
| `customer_count` | int | How many customers fall in this segment. |
| `avg_recency_days` | float | Mean days since last purchase (lower is more recent). |
| `avg_frequency` | float | Mean number of transactions per customer. |
| `avg_monetary` | float | Mean net spend per customer (USD). |
| `top_category` | string | The single most common product category in the segment's transaction history. |
| `loyalty_mix` | dict | `{tier: pct}`, e.g. `{"Platinum": 45.0, "Gold": 38.0, "Silver": 17.0}`. Percentages sum to 100. |

## Segment naming

Names are derived from each cluster's centroid in the original feature scale.

* If one cluster has the highest monetary value AND the lowest recency AND the highest frequency, AND a different cluster has the lowest monetary value AND the highest recency, the friendly names are used:
  * **VIP Loyalists** (top spend, very recent, very frequent)
  * **Mid Tier Engaged** (the middle cluster)
  * **Lapsed or New** (lowest spend, highest recency)
* Otherwise the script falls back to a monetary rank label so the names are still meaningful:
  * **Segment A High Value**, **Segment B Mid Value**, **Segment C Low Value**

This guards against odd centroid configurations on smaller or unusual datasets.

## How to use this skill

1. **Extract** the campaign description from the user's message. If they did not give one, ask for one short phrase.
2. **Run** the script from the repo root:

   ```bash
   uv run python skills/audience-segment-builder/segment.py "Mother's Day Beauty Event"
   ```

3. **Report** the printed segments to the user. The script prints a recommendation line based on keywords in the brief:
   * Beauty, VIP, loyal, Mother, premium, luxury bias toward the highest value segment.
   * Welcome, new, first, winback, reactivate, lapsed bias toward the lowest value segment.
   * Otherwise the largest reachable segment is recommended.

## Inputs and outputs (caller perspective)

The function signature is unchanged from the previous hardcoded version:

```python
build_segments(brief_description: str, db_path: Path | str = ...) -> list[dict]
```

The dict shape was extended with the new RFM and clustering fields (`avg_recency_days`, `avg_frequency`, `avg_monetary`, `top_category`, `loyalty_mix`). Old fields specific to the hardcoded segments (`key`, `gender_split`) were removed.

## Database fields used

* `customers.customer_id`, `loyalty_tier`
* `transactions.customer_id`, `sku_id`, `transaction_date`, `unit_price`, `quantity`, `discount_pct`
* `sku_catalog.sku_id`, `category`

## Reproducibility

`random_state=42` is pinned, so two runs of the script on the same `data/macys.db` produce the same labels and therefore the same segment counts and metrics.
