"""Generate the dam_assets table.

5,000 rows of Digital Asset Management records. About 30 percent carry a
non-clean degradation_flag (mislabeled, duplicate, lowres, orphaned, expired)
to mirror the DAM degradation findings from Milestone 1. About 5 percent of
assets have empty tag lists.

Reproducible via random seed 42.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta

import numpy as np
import pandas as pd
from faker import Faker

SEED = 42
N_ASSETS = 5_000

ASSET_TYPES = ["hero", "product", "lifestyle", "banner", "social"]
ASSET_TYPE_WEIGHTS = [0.10, 0.45, 0.20, 0.15, 0.10]

SEASONS = ["Spring", "Summer", "Fall", "Winter", "All"]

RESOLUTIONS = ["3840x2160", "2560x1440", "1920x1080", "1280x720", "800x600", "640x480"]
RESOLUTION_WEIGHTS = [0.20, 0.30, 0.30, 0.10, 0.07, 0.03]

USAGE_RIGHTS = ["free", "restricted", "expired"]
USAGE_RIGHTS_WEIGHTS = [0.65, 0.25, 0.10]

DEGRADATION_FLAGS = ["clean", "mislabeled", "duplicate", "lowres", "orphaned", "expired"]
DEGRADATION_WEIGHTS = [0.70, 0.06, 0.07, 0.06, 0.06, 0.05]

TAG_POOL = [
    "spring", "summer", "fall", "winter", "holiday",
    "valentines", "mothers-day", "back-to-school", "black-friday", "lunar-new-year",
    "womens", "mens", "kids", "home", "beauty", "shoes", "accessories",
    "denim", "dresses", "outerwear", "skincare", "fragrance",
    "lifestyle", "studio", "outdoor", "indoor", "model", "flatlay",
    "luxury", "everyday", "sale", "new-arrival",
]

BRANDS = [
    "Macy's House", "INC", "Style & Co", "Tommy Hilfiger", "Polo Ralph Lauren",
    "Estee Lauder", "Clinique", "Coach", "Michael Kors", "Steve Madden", "Nike", "UGG",
]


def _make_filename(asset_type: str, idx: int, fake: Faker) -> str:
    slug = fake.slug()
    return f"{asset_type}_{idx:05d}_{slug}.jpg"


def generate_dam_assets(
    skus: pd.DataFrame | None = None,
    seed: int = SEED,
    n: int = N_ASSETS,
) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)
    fake = Faker("en_US")
    Faker.seed(seed)

    today = date.today()

    sku_pool = skus["sku_id"].to_numpy() if skus is not None else np.arange(1, 2_001)

    rows = []
    for i in range(n):
        asset_type = np.random.choice(ASSET_TYPES, p=ASSET_TYPE_WEIGHTS)

        if np.random.rand() < 0.05:
            tags: list[str] = []
        else:
            n_tags = int(np.random.randint(2, 7))
            tags = list(np.random.choice(TAG_POOL, size=n_tags, replace=False))

        if asset_type in {"product", "lifestyle"} and np.random.rand() < 0.85:
            n_skus = int(np.random.randint(1, 4))
            associated = list(map(int, np.random.choice(sku_pool, size=n_skus, replace=False)))
        else:
            associated = []

        created_offset = int(np.random.randint(0, 365 * 4))
        created = today - timedelta(days=created_offset)

        used_offset = int(np.random.randint(0, max(created_offset, 1)))
        last_used = today - timedelta(days=used_offset)

        flag = np.random.choice(DEGRADATION_FLAGS, p=DEGRADATION_WEIGHTS)

        rights = np.random.choice(USAGE_RIGHTS, p=USAGE_RIGHTS_WEIGHTS)
        if flag == "expired":
            rights = "expired"

        if flag == "lowres":
            resolution = str(np.random.choice(["800x600", "640x480"], p=[0.6, 0.4]))
        else:
            resolution = str(np.random.choice(RESOLUTIONS, p=RESOLUTION_WEIGHTS))

        rows.append(
            {
                "asset_id": i + 1,
                "filename": _make_filename(asset_type, i + 1, fake),
                "asset_type": asset_type,
                "tags": json.dumps(tags),
                "associated_skus": json.dumps(associated),
                "season": np.random.choice(SEASONS),
                "brand": random.choice(BRANDS),
                "created_date": created.isoformat(),
                "last_used_date": last_used.isoformat(),
                "file_size_mb": round(float(np.random.uniform(0.5, 50.0)), 2),
                "resolution": resolution,
                "usage_rights": rights,
                "degradation_flag": flag,
            }
        )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate_dam_assets()
    print(df.head())
    print(f"Rows: {len(df):,}")
    print(df["degradation_flag"].value_counts(normalize=True).round(3))
