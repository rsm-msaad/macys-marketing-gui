"""Tests for `skills/campaign-performance-analyzer/analyze.py`."""

from __future__ import annotations

import importlib.util
import sqlite3
from pathlib import Path

import pytest

_MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills"
    / "campaign-performance-analyzer"
    / "analyze.py"
)
_spec = importlib.util.spec_from_file_location("cpa_analyze", _MODULE_PATH)
assert _spec and _spec.loader
analyze_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(analyze_mod)


SCHEMA_SQL = """
CREATE TABLE campaigns (
    campaign_id    INTEGER PRIMARY KEY,
    campaign_name  TEXT,
    brief          TEXT,
    target_segment TEXT,
    start_date     TEXT,
    end_date       TEXT,
    total_budget   REAL,
    status         TEXT
);
CREATE TABLE campaign_performance (
    campaign_id INTEGER,
    channel     TEXT,
    date        TEXT,
    impressions INTEGER,
    clicks      INTEGER,
    conversions INTEGER,
    revenue     REAL,
    cost        REAL,
    PRIMARY KEY (campaign_id, channel, date)
);
CREATE TABLE customers (
    customer_id  INTEGER PRIMARY KEY,
    loyalty_tier TEXT
);
CREATE TABLE sku_catalog (
    sku_id       INTEGER PRIMARY KEY,
    product_name TEXT,
    category     TEXT
);
CREATE TABLE transactions (
    transaction_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id      INTEGER,
    sku_id           INTEGER,
    transaction_date TEXT,
    unit_price       REAL,
    quantity         INTEGER,
    discount_pct     REAL
);
"""


# Campaign 100 (rich): 30 days, 2 channels, linear daily revenue growth.
# Campaign 200 (sparse): 5 days, 1 channel, less than the 14 day forecast minimum.
# Campaign 300 (planned): no performance rows at all.
CAMPAIGNS = [
    (100, "Big Test Campaign", "brief", "All", "2026-04-01", "2026-04-30", 50_000.0, "completed"),
    (200, "Sparse Test Campaign", "brief", "All", "2026-04-01", "2026-04-05", 5_000.0, "completed"),
    (300, "Planned Test Campaign", "brief", "All", "2026-05-01", "2026-05-15", 10_000.0, "planned"),
]


def _build_performance() -> list[tuple]:
    """Campaign 100 has linear revenue growth on email and a flat, low ROAS
    display channel. Campaign 200 has 5 days of email only."""
    rows: list[tuple] = []
    for i in range(30):
        d = f"2026-04-{i + 1:02d}"
        # email: revenue grows linearly, cost flat → ROAS rises
        rows.append((100, "email", d, 100_000 + 1_000 * i, 5_000 + 50 * i, 10 + i, 1_000 + 50 * i, 200))
        # display: flat low ROAS (0.75x)
        rows.append((100, "display", d, 50_000, 500, 3, 300, 400))
    for i in range(5):
        d = f"2026-04-{i + 1:02d}"
        rows.append((200, "email", d, 5_000, 200, 5, 500, 100))
    return rows


PERFORMANCE = _build_performance()

# 16 customers across 4 tiers (4 each), so unique-buyer rates land at clean
# fractions: Bronze 1/4, Silver 2/4, Gold 3/4, Platinum 4/4.
CUSTOMERS = [
    (1, "Bronze"), (2, "Bronze"), (3, "Bronze"), (4, "Bronze"),
    (5, "Silver"), (6, "Silver"), (7, "Silver"), (8, "Silver"),
    (9, "Gold"), (10, "Gold"), (11, "Gold"), (12, "Gold"),
    (13, "Platinum"), (14, "Platinum"), (15, "Platinum"), (16, "Platinum"),
]

SKUS = [
    (1, "Mac Red Lipstick", "Beauty"),
    (2, "Mac Mascara Black", "Beauty"),
    (3, "INC Spring Dress", "Apparel"),
]


def _build_transactions() -> list[tuple]:
    """Transactions inside campaign 100's window (2026-04-15).

    Engineered unique-buyer rates per tier are clean monotonic fractions:
        Bronze   -> 1 of 4 customers buys -> rate 0.25
        Silver   -> 2 of 4 customers buy  -> rate 0.50
        Gold     -> 3 of 4 customers buy  -> rate 0.75
        Platinum -> 4 of 4 customers buy  -> rate 1.00
    Overall rate = 10/16 = 0.625, so Platinum is top by lift.

    Some customers buy multiple times (Silver cust 5, Platinum cust 14, 16)
    so we can verify the unique-buyer logic counts each customer exactly once
    regardless of transaction count.

    SKU mix: sku 1 (Lipstick) wins by revenue, sku 2 (Mascara) wins by units.
    """
    out: list[tuple] = []
    # Bronze: customer 1 buys once.
    out.append((1, 1, "2026-04-15", 50.0, 1, 0.0))
    # Silver: customer 5 buys twice (still 1 unique buyer), customer 6 buys once.
    out.append((5, 1, "2026-04-15", 30.0, 1, 0.0))
    out.append((5, 1, "2026-04-15", 30.0, 1, 0.0))
    out.append((6, 1, "2026-04-15", 30.0, 1, 0.0))
    # Gold: customers 9, 10, 11 each buy once; customer 12 does not buy.
    for cid in (9, 10, 11):
        out.append((cid, 2, "2026-04-15", 5.0, 10, 0.0))  # 10 units, $50/tx
    # Platinum: all 4 customers buy. Customer 14 buys twice, customer 16 buys 3x.
    out.append((13, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((14, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((14, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((15, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((16, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((16, 1, "2026-04-15", 100.0, 1, 0.0))
    out.append((16, 1, "2026-04-15", 100.0, 1, 0.0))
    return out


TRANSACTIONS = _build_transactions()


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "cpa_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    conn.executemany("INSERT INTO campaigns VALUES (?,?,?,?,?,?,?,?)", CAMPAIGNS)
    conn.executemany(
        "INSERT INTO campaign_performance VALUES (?,?,?,?,?,?,?,?)",
        PERFORMANCE,
    )
    conn.executemany("INSERT INTO customers VALUES (?,?)", CUSTOMERS)
    conn.executemany("INSERT INTO sku_catalog VALUES (?,?,?)", SKUS)
    conn.executemany(
        "INSERT INTO transactions "
        "(customer_id, sku_id, transaction_date, unit_price, quantity, discount_pct) "
        "VALUES (?,?,?,?,?,?)",
        TRANSACTIONS,
    )
    conn.commit()
    conn.close()
    return db_path


# ---------- DB / connect ----------


def test_connect_db_missing_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        analyze_mod.connect_db(tmp_path / "no.db")


def test_analyze_campaign_unknown_id_raises(seeded_db: Path):
    with pytest.raises(ValueError):
        analyze_mod.analyze_campaign(99_999, db_path=seeded_db)


def test_analyze_campaign_missing_db_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        analyze_mod.analyze_campaign(100, db_path=tmp_path / "missing.db")


# ---------- pure helpers ----------


def test_safe_divide_zero_denom_returns_default():
    assert analyze_mod._safe_divide(10, 0) == 0.0
    assert analyze_mod._safe_divide(10, 0, default=99) == 99
    assert analyze_mod._safe_divide(10, None) == 0.0


def test_trend_direction_up_down_flat_thresholds():
    assert analyze_mod._trend_direction(110, 100) == "up"     # +10%
    assert analyze_mod._trend_direction(106, 100) == "up"     # +6%
    assert analyze_mod._trend_direction(105, 100) == "flat"   # +5% boundary
    assert analyze_mod._trend_direction(100, 100) == "flat"
    assert analyze_mod._trend_direction(94, 100) == "down"    # -6%
    assert analyze_mod._trend_direction(95, 100) == "flat"    # -5% boundary
    assert analyze_mod._trend_direction(100, 0) == "flat"     # safe


# ---------- forecast_metric ----------


def test_forecast_metric_insufficient_data_raises():
    with pytest.raises(ValueError):
        analyze_mod.forecast_metric([1, 2, 3, 4, 5], horizon_days=14)


def test_forecast_metric_perfectly_linear_recovers_slope():
    # y = 50*x + 1300 over 30 points; horizon 14 -> day 43
    values = [1300 + 50 * i for i in range(30)]
    out = analyze_mod.forecast_metric(values, horizon_days=14)
    # day_index target = n - 1 + horizon = 30 - 1 + 14 = 43
    assert out["predicted"] == pytest.approx(50 * 43 + 1300)
    # No noise -> CI bounds equal predicted.
    assert out["lower_bound"] == pytest.approx(out["predicted"])
    assert out["upper_bound"] == pytest.approx(out["predicted"])
    assert out["slope"] == pytest.approx(50.0)
    assert out["intercept"] == pytest.approx(1300.0)


def test_forecast_metric_returns_lower_le_predicted_le_upper():
    # Linear with small alternating noise.
    values = [100 + 5 * i + (1 if i % 2 == 0 else -1) for i in range(20)]
    out = analyze_mod.forecast_metric(values, horizon_days=14)
    assert out["lower_bound"] <= out["predicted"] <= out["upper_bound"]
    assert out["lower_bound"] < out["upper_bound"]  # nontrivial CI


def test_forecast_metric_constant_series_is_flat():
    out = analyze_mod.forecast_metric([100.0] * 20, horizon_days=14)
    assert out["trend_direction"] == "flat"


def test_forecast_metric_increasing_series_trends_up():
    values = [100 + 10 * i for i in range(20)]
    out = analyze_mod.forecast_metric(values, horizon_days=14)
    assert out["trend_direction"] == "up"


def test_forecast_metric_decreasing_series_trends_down():
    values = [1000 - 20 * i for i in range(20)]
    out = analyze_mod.forecast_metric(values, horizon_days=14)
    assert out["trend_direction"] == "down"


# ---------- attribution_by_channel ----------


def test_attribution_by_channel_returns_one_row_per_channel(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod.attribution_by_channel(conn, 100)
    finally:
        conn.close()
    assert {r["channel"] for r in rows} == {"email", "display"}


def test_attribution_by_channel_revenue_matches_sum(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod.attribution_by_channel(conn, 100)
    finally:
        conn.close()
    by_ch = {r["channel"]: r for r in rows}
    # email: revenue = sum_{i=0..29}(1000 + 50*i) = 30*1000 + 50*sum(0..29)
    expected_email_rev = 30 * 1000 + 50 * (29 * 30 // 2)
    assert by_ch["email"]["revenue"] == pytest.approx(expected_email_rev)
    # display: 30 * 300 = 9000
    assert by_ch["display"]["revenue"] == pytest.approx(9000.0)


def test_attribution_by_channel_roas_and_cac_calculated(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod.attribution_by_channel(conn, 100)
    finally:
        conn.close()
    by_ch = {r["channel"]: r for r in rows}
    # display: revenue 9000, spend 30*400=12000, ROAS=0.75
    assert by_ch["display"]["roas"] == pytest.approx(0.75)
    # display: spend 12000, conversions 30*3=90, CAC ≈ 133.33
    assert by_ch["display"]["cac"] == pytest.approx(12000 / 90, abs=0.01)


def test_attribution_by_channel_ranks_descending_by_roas(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod.attribution_by_channel(conn, 100)
    finally:
        conn.close()
    roas_seq = [r["roas"] for r in rows]
    assert roas_seq == sorted(roas_seq, reverse=True)
    assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1))


def test_attribution_by_channel_top_and_worst_channel(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod.attribution_by_channel(conn, 100)
    finally:
        conn.close()
    assert analyze_mod._pick_top_channel(rows) == "email"
    assert analyze_mod._pick_worst_channel(rows) == "display"


def test_pick_worst_channel_ignores_low_spend_channels():
    """A channel with only 2 percent of total spend should not be flagged
    as the worst, even if its ROAS is the lowest."""
    rows = [
        {"channel": "email", "roas": 4.0, "spend": 1000.0},
        {"channel": "display", "roas": 1.5, "spend": 500.0},
        {"channel": "experimental", "roas": 0.1, "spend": 30.0},  # 2% of total
    ]
    assert analyze_mod._pick_worst_channel(rows) == "display"


def test_pick_worst_channel_handles_empty():
    assert analyze_mod._pick_worst_channel([]) is None


def test_pick_top_channel_handles_empty():
    assert analyze_mod._pick_top_channel([]) is None


# ---------- attribution_by_segment ----------


def test_attribution_by_segment_groups_by_loyalty_tier(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    tiers = {s["segment"] for s in segs}
    assert tiers == {"Bronze", "Silver", "Gold", "Platinum"}


def test_attribution_by_segment_lift_formula(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    by_tier = {s["segment"]: s for s in segs}
    # Unique-buyer rates per tier: 1/4, 2/4, 3/4, 4/4. Overall 10/16 = 0.625.
    overall = 10 / 16
    expected_rates = {
        "Bronze": 0.25,
        "Silver": 0.50,
        "Gold": 0.75,
        "Platinum": 1.00,
    }
    for tier, expected_rate in expected_rates.items():
        expected_lift = (expected_rate - overall) / overall
        assert by_tier[tier]["conversion_rate"] == pytest.approx(expected_rate, abs=1e-4)
        assert by_tier[tier]["lift_vs_avg"] == pytest.approx(expected_lift, abs=1e-3)


def test_attribution_by_segment_rates_are_bounded_in_unit_interval(seeded_db: Path):
    """Unique-buyer rate must always be in [0, 1]."""
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    for s in segs:
        assert 0.0 <= s["conversion_rate"] <= 1.0


def test_attribution_by_segment_counts_repeat_buyers_only_once(seeded_db: Path):
    """Customer 16 (Platinum) has 3 transactions; should still count as 1 unique buyer.
    Platinum has 4 customers, all of whom bought, so the rate is exactly 1.0."""
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    platinum = next(s for s in segs if s["segment"] == "Platinum")
    # 4 unique buyers, NOT 7 transactions.
    assert platinum["conversions"] == 4
    assert platinum["conversion_rate"] == pytest.approx(1.0)


def test_attribution_by_segment_silver_repeat_buyer_counted_once(seeded_db: Path):
    """Customer 5 (Silver) buys twice; combined with customer 6 there are
    2 unique buyers among the 4 Silver customers (rate 0.5)."""
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    silver = next(s for s in segs if s["segment"] == "Silver")
    assert silver["conversions"] == 2  # customers 5 and 6
    assert silver["conversion_rate"] == pytest.approx(0.5)


def test_attribution_by_segment_lift_still_meaningful(seeded_db: Path):
    """Lift values should still differentiate tiers even with bounded rates."""
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    by_tier = {s["segment"]: s["lift_vs_avg"] for s in segs}
    # Lift signs make sense: Platinum/Gold positive, Bronze/Silver negative.
    assert by_tier["Platinum"] > 0
    assert by_tier["Gold"] > 0
    assert by_tier["Silver"] < 0
    assert by_tier["Bronze"] < 0
    # Strict ordering by lift.
    assert by_tier["Platinum"] > by_tier["Gold"] > by_tier["Silver"] > by_tier["Bronze"]


def test_attribution_by_segment_sorted_by_lift_descending(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        segs = analyze_mod.attribution_by_segment(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    lifts = [s["lift_vs_avg"] for s in segs]
    assert lifts == sorted(lifts, reverse=True)
    assert segs[0]["segment"] == "Platinum"  # highest engineered lift


# ---------- attribution by SKU ----------


def test_attribution_by_sku_revenue_top_first(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod._attribution_by_sku_revenue(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    assert rows[0]["sku_id"] == 1  # lipstick, $50 + 4*$30 + 10*$100 = $1170
    revenues = [r["revenue"] for r in rows]
    assert revenues == sorted(revenues, reverse=True)


def test_attribution_by_sku_units_top_first(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod._attribution_by_sku_units(conn, "2026-04-01", "2026-04-30")
    finally:
        conn.close()
    # sku 2 has 6 transactions x 10 units = 60 units, sku 1 has 16 single-unit txns.
    assert rows[0]["sku_id"] == 2
    units = [r["units"] for r in rows]
    assert units == sorted(units, reverse=True)


def test_attribution_by_sku_revenue_limit_applies(seeded_db: Path):
    conn = analyze_mod.connect_db(seeded_db)
    try:
        rows = analyze_mod._attribution_by_sku_revenue(conn, "2026-04-01", "2026-04-30", limit=2)
    finally:
        conn.close()
    assert len(rows) == 2


# ---------- analyze_campaign full pipeline ----------


REQUIRED_TOP_KEYS = {
    "campaign_id",
    "campaign_name",
    "campaign_status",
    "campaign_window",
    "totals",
    "attribution",
    "forecast",
    "summary",
    "generated_at",
}

REQUIRED_ATTRIBUTION_KEYS = {
    "by_channel",
    "by_segment",
    "by_sku_revenue",
    "by_sku_units",
    "top_channel",
    "worst_channel",
    "top_segment",
}


def test_analyze_campaign_returns_expected_top_level_keys(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    assert REQUIRED_TOP_KEYS.issubset(a.keys())


def test_analyze_campaign_attribution_structure(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    assert REQUIRED_ATTRIBUTION_KEYS.issubset(a["attribution"].keys())


def test_analyze_campaign_window_has_start_end_days(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    w = a["campaign_window"]
    assert {"start", "end", "days"}.issubset(w.keys())
    assert w["days"] >= 1


def test_analyze_campaign_totals_match_channel_aggregates(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    totals = a["totals"]
    by_ch = a["attribution"]["by_channel"]
    assert totals["revenue"] == pytest.approx(sum(c["revenue"] for c in by_ch))
    assert totals["spend"] == pytest.approx(sum(c["spend"] for c in by_ch))
    assert totals["conversions"] == sum(c["conversions"] for c in by_ch)


def test_analyze_campaign_forecast_succeeds_for_rich_campaign(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, forecast_days=14, db_path=seeded_db)
    f = a["forecast"]
    assert f["forecast_status"] == "success"
    assert f["history_days"] == 30
    assert f["revenue"]["lower_bound"] <= f["revenue"]["predicted"] <= f["revenue"]["upper_bound"]


def test_analyze_campaign_forecast_revenue_trends_up_for_rising_series(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    # Daily revenue grows on email + flat on display, so net trend should be "up".
    assert a["forecast"]["revenue"]["trend_direction"] == "up"


def test_analyze_campaign_forecast_insufficient_data_for_sparse_campaign(seeded_db: Path):
    a = analyze_mod.analyze_campaign(200, db_path=seeded_db)
    f = a["forecast"]
    assert f["forecast_status"] == "insufficient_data"
    assert f["revenue"] is None
    assert f["conversions"] is None
    assert f["roas"] is None
    assert "Need at least" in f["message"]


def test_analyze_campaign_planned_campaign_no_perf_data(seeded_db: Path):
    """Campaign 300 has no performance rows; analysis should still succeed."""
    a = analyze_mod.analyze_campaign(300, db_path=seeded_db)
    assert a["attribution"]["by_channel"] == []
    assert a["attribution"]["top_channel"] is None
    assert a["forecast"]["forecast_status"] == "insufficient_data"


def test_analyze_campaign_top_channel_is_highest_roas(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    top = a["attribution"]["top_channel"]
    by_ch = {c["channel"]: c["roas"] for c in a["attribution"]["by_channel"]}
    assert top == max(by_ch, key=by_ch.get)


def test_analyze_campaign_top_segment_matches_first_in_list(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    assert a["attribution"]["top_segment"] == a["attribution"]["by_segment"][0]["segment"]
    assert a["attribution"]["top_segment"] == "Platinum"


def test_analyze_campaign_sku_revenue_top_10_or_fewer(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    assert len(a["attribution"]["by_sku_revenue"]) <= 10


# ---------- summary ----------


def test_summary_contains_campaign_name_and_top_channel(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    summary = a["summary"]
    assert a["campaign_name"] in summary
    assert a["attribution"]["top_channel"] in summary


def test_summary_contains_revenue_amount(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    # Revenue is formatted with $ and either K or M.
    assert "$" in a["summary"]


def test_summary_for_sparse_campaign_notes_forecast_unavailable(seeded_db: Path):
    a = analyze_mod.analyze_campaign(200, db_path=seeded_db)
    assert "Forecast is not available" in a["summary"]


# ---------- determinism ----------


def test_analyze_campaign_is_deterministic(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    b = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    # Everything except generated_at should match.
    a_copy = {k: v for k, v in a.items() if k != "generated_at"}
    b_copy = {k: v for k, v in b.items() if k != "generated_at"}
    assert a_copy == b_copy


# ---------- formatter + main ----------


def test_format_results_renders_all_sections(seeded_db: Path):
    a = analyze_mod.analyze_campaign(100, db_path=seeded_db)
    out = analyze_mod.format_results(a)
    assert "CAMPAIGN PERFORMANCE ANALYSIS" in out
    assert "REVENUE BREAKDOWN" in out
    assert "CHANNEL ATTRIBUTION" in out
    assert "SEGMENT ATTRIBUTION" in out
    assert "TOP SKUs BY REVENUE" in out
    assert "FORECAST" in out
    assert "EXECUTIVE SUMMARY" in out


def test_format_results_renders_insufficient_data_message(seeded_db: Path):
    a = analyze_mod.analyze_campaign(200, db_path=seeded_db)
    out = analyze_mod.format_results(a)
    assert "insufficient" in out.lower() or "Need at least" in out


def test_main_runs_against_seeded_db(seeded_db: Path, capsys):
    rc = analyze_mod.main(
        ["analyze.py", "100", "--db", str(seeded_db)]
    )
    assert rc == 0
    out = capsys.readouterr().out
    assert "Big Test Campaign" in out


def test_main_unknown_campaign_raises(seeded_db: Path):
    with pytest.raises(ValueError):
        analyze_mod.main(["analyze.py", "99999", "--db", str(seeded_db)])


# ---------- formatter helpers ----------


def test_format_money_formats_thousands_and_millions():
    assert analyze_mod._format_money(1_500_000) == "$1.50M"
    assert analyze_mod._format_money(125_000) == "$125K"
    assert analyze_mod._format_money(500) == "$500"


def test_format_pct_signed():
    assert analyze_mod._format_pct(0.28) == "+28%"
    assert analyze_mod._format_pct(-0.36) == "-36%"
    assert analyze_mod._format_pct(0.0) == "+0%"
