"""Generate the sku_catalog and regional_pricing tables.

2,000 SKUs distributed across the realistic Macy's category mix
(Apparel, Beauty, Home, Accessories, Shoes), and 20,000 regional price rows
(10 US regions x 2,000 SKUs).

Reproducible via random seed 42.
"""

from __future__ import annotations

import random

import numpy as np
import pandas as pd
from faker import Faker

SEED = 42
N_SKUS = 2_000

CATEGORY_MIX = {
    "Apparel": 0.40,
    "Beauty": 0.20,
    "Home": 0.15,
    "Accessories": 0.15,
    "Shoes": 0.10,
}

SUBCATEGORIES = {
    "Apparel": ["Dresses", "Tops", "Pants", "Outerwear", "Activewear", "Sleepwear", "Suits"],
    "Beauty": ["Skincare", "Fragrance", "Makeup", "Haircare", "Wellness"],
    "Home": ["Bedding", "Bath", "Kitchen", "Decor", "Furniture", "Luggage"],
    "Accessories": ["Handbags", "Jewelry", "Watches", "Sunglasses", "Belts", "Scarves"],
    "Shoes": ["Sneakers", "Heels", "Boots", "Flats", "Sandals", "Athletic"],
}

BRANDS_BY_CATEGORY = {
    "Apparel": ["INC", "Style & Co", "Tommy Hilfiger", "Polo Ralph Lauren", "Calvin Klein", "Levi's", "Alfani"],
    "Beauty": ["Estee Lauder", "Clinique", "Lancome", "MAC", "Chanel", "Dior", "Bobbi Brown"],
    "Home": ["Charter Club", "Hotel Collection", "Martha Stewart", "Calphalon", "KitchenAid", "Cuisinart"],
    "Accessories": ["Coach", "Michael Kors", "Kate Spade", "Fossil", "Tory Burch", "Tag Heuer"],
    "Shoes": ["Steve Madden", "Nine West", "Nike", "Adidas", "UGG", "Cole Haan", "Sam Edelman"],
}

PRICE_RANGES = {
    "Apparel": (25, 250),
    "Beauty": (15, 180),
    "Home": (20, 600),
    "Accessories": (35, 800),
    "Shoes": (40, 350),
}

SEASONS = ["Spring", "Summer", "Fall", "Winter", "All"]
SEASON_WEIGHTS = [0.20, 0.20, 0.20, 0.20, 0.20]

REGIONS = [
    "Northeast",
    "Mid-Atlantic",
    "Southeast",
    "Midwest-North",
    "Midwest-South",
    "South",
    "Southwest",
    "Mountain",
    "Pacific-Northwest",
    "Pacific-Southwest",
]

SUPPLIERS = [
    "Macy's Direct",
    "Premier Apparel Co",
    "Global Beauty Group",
    "HomeStyle Imports",
    "Accent Accessories Inc",
    "Footwear Partners LLC",
    "Vendor Marketplace",
]


def generate_skus(seed: int = SEED, n: int = N_SKUS) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)
    fake = Faker("en_US")
    Faker.seed(seed)

    categories = np.random.choice(
        list(CATEGORY_MIX.keys()),
        size=n,
        p=list(CATEGORY_MIX.values()),
    )

    rows = []
    for i, category in enumerate(categories):
        subcategory = random.choice(SUBCATEGORIES[category])
        brand = random.choice(BRANDS_BY_CATEGORY[category])
        low, high = PRICE_RANGES[category]
        base_price = round(float(np.random.uniform(low, high)), 2)
        season = np.random.choice(SEASONS, p=SEASON_WEIGHTS)
        inventory_count = int(np.random.randint(0, 1500))
        supplier = random.choice(SUPPLIERS)

        product_name = f"{brand} {subcategory[:-1] if subcategory.endswith('s') else subcategory} {fake.word().title()}"

        rows.append(
            {
                "sku_id": i + 1,
                "product_name": product_name,
                "category": category,
                "subcategory": subcategory,
                "brand": brand,
                "base_price": base_price,
                "season": season,
                "inventory_count": inventory_count,
                "supplier": supplier,
            }
        )

    return pd.DataFrame(rows)


def generate_regional_pricing(skus: pd.DataFrame, seed: int = SEED) -> pd.DataFrame:
    np.random.seed(seed)

    sku_ids = skus["sku_id"].to_numpy()
    base_prices = skus["base_price"].to_numpy()

    rows = []
    for sku_id, base in zip(sku_ids, base_prices):
        for region in REGIONS:
            multiplier = float(np.random.uniform(0.9, 1.1))
            regional_price = round(base * multiplier, 2)
            in_stock = int(np.random.rand() < 0.85)
            rows.append(
                {
                    "sku_id": int(sku_id),
                    "region": region,
                    "regional_price": regional_price,
                    "in_stock_locally": in_stock,
                }
            )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    skus = generate_skus()
    pricing = generate_regional_pricing(skus)
    print(skus.head())
    print(f"SKUs: {len(skus):,}")
    print(f"Regional pricing rows: {len(pricing):,}")
    print(skus["category"].value_counts(normalize=True).round(3))
