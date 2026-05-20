"""Generate the campaigns and campaign_performance tables.

12 campaigns over a roughly 14 month window. Daily channel level performance
rolls up to about 3,000 rows. CTR is realistic per channel (email 3 percent,
paid_social 1 percent, display 0.5 percent). Some campaigns intentionally have
zero conversion days for realism.

Reproducible via random seed 42.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

import numpy as np
import pandas as pd

SEED = 42

CAMPAIGNS = [
    {
        "campaign_name": "Spring Style Refresh 2026",
        "brief": "Drive Spring apparel sell through with a focus on dresses and lightweight outerwear for women 25 to 45 in warm weather regions.",
        "target_segment": "Women 25-45, warm regions, fashion forward",
        "budget": 850_000,
    },
    {
        "campaign_name": "Mother's Day Beauty Event 2026",
        "brief": "Promote prestige beauty gift sets for Mother's Day. Emphasize Estee Lauder, Clinique, and Lancome bundles.",
        "target_segment": "Gift givers, Silver and Gold tier loyalty",
        "budget": 600_000,
    },
    {
        "campaign_name": "Memorial Day Home Sale 2026",
        "brief": "Site wide home sale featuring bedding, bath, and small appliances. Anchor on 30 percent off mattresses.",
        "target_segment": "Homeowners 30-65 across all regions",
        "budget": 1_200_000,
    },
    {
        "campaign_name": "Summer Friends and Family 2026",
        "brief": "Annual loyalty event. Extra 25 percent off plus free shipping. Cross category, deepest pricing of the season.",
        "target_segment": "All Star Rewards members, lapsed buyers",
        "budget": 1_800_000,
    },
    {
        "campaign_name": "Back To School 2025",
        "brief": "Apparel, shoes, and dorm essentials for the K-12 and college audience. Lean on backpacks and sneakers.",
        "target_segment": "Parents 30-50, college students 18-24",
        "budget": 950_000,
    },
    {
        "campaign_name": "Labor Day Mattress Event 2025",
        "brief": "Three day mattress and bedding event. Hero is sealy and serta with 0 percent APR financing.",
        "target_segment": "Home shoppers, recent furniture browsers",
        "budget": 700_000,
    },
    {
        "campaign_name": "Fall Style Edit 2025",
        "brief": "Curated fall fashion drop. Focus on outerwear, denim, boots, and transitional layering.",
        "target_segment": "Fashion engaged 25-55, cooler regions",
        "budget": 1_100_000,
    },
    {
        "campaign_name": "Black Friday 2025",
        "brief": "Site wide doorbusters across all categories. Heavy paid media push, hourly deal rotations.",
        "target_segment": "All shoppers, deep deal seekers",
        "budget": 3_500_000,
    },
    {
        "campaign_name": "Holiday Gift Guide 2025",
        "brief": "Editorial gift guide across price points. Lean into beauty gift sets, watches, and home decor.",
        "target_segment": "Gift givers, Gold and Platinum tiers",
        "budget": 2_200_000,
    },
    {
        "campaign_name": "Lunar New Year 2026",
        "brief": "Cultural moment activation in major metro markets. Red packets, gold accents, premium beauty.",
        "target_segment": "AAPI customers, urban metros",
        "budget": 350_000,
    },
    {
        "campaign_name": "Valentines Day Jewelry 2026",
        "brief": "Fine jewelry and watches event. Emphasize quick ship and free engraving.",
        "target_segment": "Gift givers, urban regions",
        "budget": 480_000,
    },
    {
        "campaign_name": "Easter Family Style 2026",
        "brief": "Spring family dressing, including kids apparel and accessories. Pastel palette.",
        "target_segment": "Parents 25-45, all regions",
        "budget": 320_000,
    },
]

CHANNELS = ["email", "paid_social", "display", "search", "instore"]

CHANNEL_PROFILE = {
    "email":       {"ctr": 0.030, "cvr": 0.040, "cpm": 2.0,  "aov": 95.0},
    "paid_social": {"ctr": 0.010, "cvr": 0.020, "cpm": 8.5,  "aov": 85.0},
    "display":     {"ctr": 0.005, "cvr": 0.012, "cpm": 4.0,  "aov": 75.0},
    "search":      {"ctr": 0.040, "cvr": 0.055, "cpm": 12.0, "aov": 110.0},
    "instore":     {"ctr": 0.000, "cvr": 0.080, "cpm": 0.0,  "aov": 130.0},
}


def _campaign_window(idx: int, today: date) -> tuple[date, date, str]:
    """Return start, end, status for the idx'th campaign.

    Windows are sized to give realistic campaign durations (a few weeks to a
    full season) so the daily campaign_performance rollup lands near 3,000 rows.
    """
    schedule = [
        (today + timedelta(days=20),  today + timedelta(days=80),  "planned"),    # Spring Refresh (60d planned)
        (today + timedelta(days=8),   today + timedelta(days=22),  "planned"),    # Mother's Day (14d planned)
        (today - timedelta(days=20),  today + timedelta(days=25),  "live"),       # Memorial Day (45d window)
        (today + timedelta(days=55),  today + timedelta(days=70),  "planned"),    # F&F (15d planned)
        (today - timedelta(days=330), today - timedelta(days=210), "completed"), # Back to School 2025 (120d)
        (today - timedelta(days=210), today - timedelta(days=160), "completed"), # Labor Day Mattress (50d)
        (today - timedelta(days=240), today - timedelta(days=120), "completed"), # Fall Edit (120d)
        (today - timedelta(days=170), today - timedelta(days=110), "completed"), # Black Friday (60d window)
        (today - timedelta(days=160), today - timedelta(days=55),  "completed"), # Holiday Guide (105d)
        (today - timedelta(days=95),  today - timedelta(days=55),  "completed"), # Lunar New Year (40d)
        (today - timedelta(days=75),  today - timedelta(days=45),  "completed"), # Valentines (30d)
        (today - timedelta(days=30),  today + timedelta(days=10),  "live"),      # Easter (40d window)
    ]
    start, end, status = schedule[idx]
    return start, end, status


def generate_campaigns(seed: int = SEED) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)
    today = date.today()

    rows = []
    for i, c in enumerate(CAMPAIGNS):
        start, end, status = _campaign_window(i, today)
        rows.append(
            {
                "campaign_id": i + 1,
                "campaign_name": c["campaign_name"],
                "brief": c["brief"],
                "target_segment": c["target_segment"],
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "total_budget": float(c["budget"]),
                "status": status,
            }
        )
    return pd.DataFrame(rows)


def generate_campaign_performance(campaigns: pd.DataFrame, seed: int = SEED) -> pd.DataFrame:
    np.random.seed(seed)
    today = date.today()

    rows = []
    for _, c in campaigns.iterrows():
        start = date.fromisoformat(c["start_date"])
        end = date.fromisoformat(c["end_date"])

        if c["status"] == "planned":
            continue
        last_day = min(end, today) if c["status"] == "live" else end
        if last_day < start:
            continue

        n_days = (last_day - start).days + 1
        daily_budget_per_channel = float(c["total_budget"]) / max(n_days, 1) / len(CHANNELS)

        for d in range(n_days):
            day = start + timedelta(days=d)
            for channel in CHANNELS:
                profile = CHANNEL_PROFILE[channel]

                if channel == "instore":
                    impressions = int(np.random.poisson(2_000))
                    clicks = 0
                    cost = float(np.random.uniform(800, 2_500))
                else:
                    cost = max(daily_budget_per_channel * float(np.random.uniform(0.6, 1.4)), 100.0)
                    cpm = profile["cpm"] * float(np.random.uniform(0.85, 1.15))
                    impressions = int(cost / cpm * 1000) if cpm > 0 else 0
                    clicks = int(impressions * profile["ctr"] * float(np.random.uniform(0.7, 1.3)))

                if np.random.rand() < 0.05:
                    conversions = 0
                else:
                    base = clicks if channel != "instore" else impressions
                    conversions = int(base * profile["cvr"] * float(np.random.uniform(0.6, 1.4)))

                revenue = round(conversions * profile["aov"] * float(np.random.uniform(0.9, 1.2)), 2)

                rows.append(
                    {
                        "campaign_id": int(c["campaign_id"]),
                        "channel": channel,
                        "date": day.isoformat(),
                        "impressions": impressions,
                        "clicks": clicks,
                        "conversions": conversions,
                        "revenue": revenue,
                        "cost": round(cost, 2),
                    }
                )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    campaigns = generate_campaigns()
    perf = generate_campaign_performance(campaigns)
    print(campaigns)
    print(f"Performance rows: {len(perf):,}")
