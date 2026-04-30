"""Generate the customers table for the Macy's simulated marketing database.

50,000 rows. Loyalty tier mix: 60 percent Bronze, 25 percent Silver, 12 percent Gold,
3 percent Platinum. About 2 percent of emails are null to mimic incomplete CRM records.

Reproducible via random seed 42.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

import numpy as np
import pandas as pd
from faker import Faker

SEED = 42
N_CUSTOMERS = 50_000

TIER_DISTRIBUTION = [
    ("Bronze", 0.60),
    ("Silver", 0.25),
    ("Gold", 0.12),
    ("Platinum", 0.03),
]

TIER_POINT_RANGE = {
    "Bronze": (0, 500),
    "Silver": (500, 2_500),
    "Gold": (2_500, 10_000),
    "Platinum": (10_000, 50_000),
}

PREFERRED_CHANNELS = ["email", "app", "sms"]
GENDERS = ["F", "M", "Nonbinary", "Unspecified"]
GENDER_WEIGHTS = [0.55, 0.40, 0.03, 0.02]


def generate_customers(seed: int = SEED, n: int = N_CUSTOMERS) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)
    fake = Faker("en_US")
    Faker.seed(seed)

    today = date.today()

    tiers = np.random.choice(
        [t for t, _ in TIER_DISTRIBUTION],
        size=n,
        p=[p for _, p in TIER_DISTRIBUTION],
    )

    rows = []
    for i in range(n):
        first = fake.first_name()
        last = fake.last_name()
        tier = tiers[i]
        low, high = TIER_POINT_RANGE[tier]
        points = int(np.random.randint(low, high + 1))

        signup_offset_days = int(np.random.randint(0, 365 * 8))
        signup_date = today - timedelta(days=signup_offset_days)

        email_clean = f"{first.lower()}.{last.lower()}{np.random.randint(1, 9999)}@example.com"
        email = None if np.random.rand() < 0.02 else email_clean

        rows.append(
            {
                "customer_id": i + 1,
                "first_name": first,
                "last_name": last,
                "email": email,
                "age": int(np.random.randint(18, 80)),
                "gender": np.random.choice(GENDERS, p=GENDER_WEIGHTS),
                "city": fake.city(),
                "state": fake.state_abbr(),
                "zip": fake.zipcode(),
                "signup_date": signup_date.isoformat(),
                "loyalty_tier": tier,
                "star_rewards_points": points,
                "preferred_channel": np.random.choice(PREFERRED_CHANNELS, p=[0.6, 0.25, 0.15]),
                "opt_in_email": int(np.random.rand() < 0.85),
                "opt_in_sms": int(np.random.rand() < 0.45),
            }
        )

    return pd.DataFrame(rows)


def generate_transactions(
    customers: pd.DataFrame,
    skus: pd.DataFrame,
    regional_pricing: pd.DataFrame,
    seed: int = SEED,
) -> pd.DataFrame:
    """Generate roughly 500,000 transaction rows over the last 24 months.

    Per customer transaction frequency scales with loyalty tier:
    Bronze x1, Silver x2, Gold x3.5, Platinum x5.
    """
    random.seed(seed)
    np.random.seed(seed)

    tier_multiplier = {"Bronze": 1.0, "Silver": 2.0, "Gold": 3.5, "Platinum": 5.0}

    base_per_customer = 5.0
    multipliers = customers["loyalty_tier"].map(tier_multiplier).to_numpy()
    counts = np.random.poisson(lam=base_per_customer * multipliers).astype(int)

    total = int(counts.sum())
    customer_ids = np.repeat(customers["customer_id"].to_numpy(), counts)

    sku_ids = skus["sku_id"].to_numpy()
    base_prices = skus.set_index("sku_id")["base_price"].to_dict()

    chosen_skus = np.random.choice(sku_ids, size=total)

    today = date.today()
    day_offsets = np.random.randint(0, 24 * 30, size=total)
    dates = [(today - timedelta(days=int(d))).isoformat() for d in day_offsets]

    channels = np.random.choice(["online", "instore", "app"], size=total, p=[0.45, 0.35, 0.20])
    discount = np.round(np.random.beta(1.5, 6, size=total) * 0.5, 2)

    quantity = np.random.choice([0, 1, 2, 3], size=total, p=[0.02, 0.80, 0.13, 0.05])

    unit_prices = np.array(
        [
            round(base_prices[s] * float(np.random.uniform(0.9, 1.1)) * (1 - d), 2)
            for s, d in zip(chosen_skus, discount)
        ]
    )

    df = pd.DataFrame(
        {
            "transaction_id": np.arange(1, total + 1),
            "customer_id": customer_ids,
            "sku_id": chosen_skus,
            "transaction_date": dates,
            "unit_price": unit_prices,
            "quantity": quantity,
            "channel": channels,
            "discount_pct": discount,
        }
    )
    return df


if __name__ == "__main__":
    df = generate_customers()
    print(df.head())
    print(f"Rows: {len(df):,}")
    print(df["loyalty_tier"].value_counts(normalize=True).round(3))
