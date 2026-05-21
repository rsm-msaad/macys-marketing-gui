# product_catalog.json — DEPRECATED

**This file is no longer used by the SKU Recommender.**

As of the M4 refactor, the SKU Recommender reads directly from `data/macys.db`
`sku_catalog` table (2,000 SKUs across 5 categories: Beauty, Apparel,
Accessories, Home, Shoes) instead of this static JSON file (61 Beauty-only SKUs).

This file is kept for historical reference and test backward compatibility.
Do not add new SKUs here — add them to `macys.db` instead.
