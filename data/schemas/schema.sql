-- Macy's Milestone 2 simulated marketing database schema.
-- Applied by data/generators/build_database.py before any rows are inserted.

DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
    customer_id          INTEGER PRIMARY KEY,
    first_name           TEXT,
    last_name            TEXT,
    email                TEXT,
    age                  INTEGER,
    gender               TEXT,
    city                 TEXT,
    state                TEXT,
    zip                  TEXT,
    signup_date          TEXT,
    loyalty_tier         TEXT,
    star_rewards_points  INTEGER,
    preferred_channel    TEXT,
    opt_in_email         INTEGER,
    opt_in_sms           INTEGER,
    category_preference  TEXT
);

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    transaction_id       INTEGER PRIMARY KEY,
    customer_id          INTEGER,
    sku_id               INTEGER,
    transaction_date     TEXT,
    unit_price           REAL,
    quantity             INTEGER,
    channel              TEXT,
    discount_pct         REAL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (sku_id)      REFERENCES sku_catalog(sku_id)
);
CREATE INDEX idx_tx_customer ON transactions(customer_id);
CREATE INDEX idx_tx_sku      ON transactions(sku_id);
CREATE INDEX idx_tx_date     ON transactions(transaction_date);

DROP TABLE IF EXISTS sku_catalog;
CREATE TABLE sku_catalog (
    sku_id               INTEGER PRIMARY KEY,
    product_name         TEXT,
    category             TEXT,
    subcategory          TEXT,
    brand                TEXT,
    base_price           REAL,
    season               TEXT,
    inventory_count      INTEGER,
    supplier             TEXT
);

DROP TABLE IF EXISTS regional_pricing;
CREATE TABLE regional_pricing (
    sku_id               INTEGER,
    region               TEXT,
    regional_price       REAL,
    in_stock_locally     INTEGER,
    PRIMARY KEY (sku_id, region),
    FOREIGN KEY (sku_id) REFERENCES sku_catalog(sku_id)
);

DROP TABLE IF EXISTS dam_assets;
CREATE TABLE dam_assets (
    asset_id             INTEGER PRIMARY KEY,
    filename             TEXT,
    asset_type           TEXT,
    tags                 TEXT,
    associated_skus      TEXT,
    season               TEXT,
    brand                TEXT,
    created_date         TEXT,
    last_used_date       TEXT,
    file_size_mb         REAL,
    resolution           TEXT,
    usage_rights         TEXT,
    degradation_flag     TEXT
);
CREATE INDEX idx_dam_type ON dam_assets(asset_type);
CREATE INDEX idx_dam_flag ON dam_assets(degradation_flag);

DROP TABLE IF EXISTS campaigns;
CREATE TABLE campaigns (
    campaign_id          INTEGER PRIMARY KEY,
    campaign_name        TEXT,
    brief                TEXT,
    target_segment       TEXT,
    start_date           TEXT,
    end_date             TEXT,
    total_budget         REAL,
    status               TEXT
);

DROP TABLE IF EXISTS campaign_performance;
CREATE TABLE campaign_performance (
    campaign_id          INTEGER,
    channel              TEXT,
    date                 TEXT,
    impressions          INTEGER,
    clicks               INTEGER,
    conversions          INTEGER,
    revenue              REAL,
    cost                 REAL,
    PRIMARY KEY (campaign_id, channel, date),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
CREATE INDEX idx_perf_campaign ON campaign_performance(campaign_id);
CREATE INDEX idx_perf_date     ON campaign_performance(date);
