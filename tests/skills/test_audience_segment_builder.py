"""Tests for `skills/audience-segment-builder/segment.py` (RFM k-means version)."""

from __future__ import annotations

import importlib.util
import sqlite3
from pathlib import Path

import numpy as np
import pytest

_MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills"
    / "audience-segment-builder"
    / "segment.py"
)
_spec = importlib.util.spec_from_file_location("segment", _MODULE_PATH)
assert _spec and _spec.loader
segment = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(segment)


SCHEMA_SQL = """
CREATE TABLE customers (
    customer_id   INTEGER PRIMARY KEY,
    loyalty_tier  TEXT
);
CREATE TABLE sku_catalog (
    sku_id    INTEGER PRIMARY KEY,
    category  TEXT
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

# Reference date: max transaction_date in the seeded data is 2026-04-01.
REF = "2026-04-01"

# 9 customers split into 3 well-separated RFM regions, plus 1 extra
# customer with no transactions (edge case).
#   Customers 1..3 = VIP-ish: many recent high-value Beauty txs (Platinum)
#   Customers 4..6 = Mid:     a few mid-recency Apparel txs (Gold)
#   Customers 7..9 = Lapsed:  one old low-value Home tx (Bronze)
#   Customer 10    = no transactions (excluded from clustering)
CUSTOMERS = [
    (1, "Platinum"), (2, "Platinum"), (3, "Platinum"),
    (4, "Gold"), (5, "Gold"), (6, "Gold"),
    (7, "Bronze"), (8, "Bronze"), (9, "Bronze"),
    (10, "Bronze"),
]

SKUS = [
    (1, "Beauty"),
    (2, "Apparel"),
    (3, "Home"),
]

# (customer_id, sku_id, date, unit_price, quantity, discount_pct)
TRANSACTIONS: list[tuple[int, int, str, float, int, float]] = []

# VIPs: 6 recent high-value Beauty transactions per customer in March/April 2026.
for cid in (1, 2, 3):
    for day in (1, 5, 10, 15, 20, 25):
        TRANSACTIONS.append((cid, 1, f"2026-03-{day:02d}", 200.0, 1, 0.0))
# One extra most-recent VIP transaction so MAX(transaction_date) == REF
TRANSACTIONS.append((1, 1, REF, 250.0, 1, 0.0))

# Mid tier: 3 mid-recency Apparel transactions per customer in late 2025.
for cid in (4, 5, 6):
    for date in ("2025-11-01", "2025-12-01", "2026-01-15"):
        TRANSACTIONS.append((cid, 2, date, 50.0, 1, 0.0))

# Lapsed: 1 old low-value Home transaction per customer in early 2024.
for cid in (7, 8, 9):
    TRANSACTIONS.append((cid, 3, "2024-03-15", 15.0, 1, 0.0))


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "macys_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    conn.executemany(
        "INSERT INTO customers (customer_id, loyalty_tier) VALUES (?, ?)",
        CUSTOMERS,
    )
    conn.executemany(
        "INSERT INTO sku_catalog (sku_id, category) VALUES (?, ?)",
        SKUS,
    )
    conn.executemany(
        "INSERT INTO transactions "
        "(customer_id, sku_id, transaction_date, unit_price, quantity, discount_pct) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        TRANSACTIONS,
    )
    conn.commit()
    conn.close()
    return db_path


# ---------- connect_db / get_reference_date ----------


def test_connect_db_missing_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        segment.connect_db(tmp_path / "does-not-exist.db")


def test_get_reference_date_returns_max_tx_date(seeded_db: Path):
    conn = segment.connect_db(seeded_db)
    try:
        assert segment.get_reference_date(conn) == REF
    finally:
        conn.close()


def test_get_reference_date_empty_transactions_raises(tmp_path: Path):
    db_path = tmp_path / "empty.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()
    conn = segment.connect_db(db_path)
    try:
        with pytest.raises(ValueError):
            segment.get_reference_date(conn)
    finally:
        conn.close()


# ---------- load_rfm: customers with no transactions are excluded ----------


def test_load_rfm_excludes_customers_with_no_transactions(seeded_db: Path):
    conn = segment.connect_db(seeded_db)
    try:
        rfm, ids = segment.load_rfm(conn, REF)
    finally:
        conn.close()
    # Customer 10 has no transactions, so should NOT appear.
    assert 10 not in ids
    # Customers 1..9 have transactions.
    assert sorted(ids) == list(range(1, 10))
    # RFM matrix shape matches number of returned customer ids.
    assert rfm.shape == (9, 3)


def test_load_rfm_columns_are_recency_frequency_monetary(seeded_db: Path):
    conn = segment.connect_db(seeded_db)
    try:
        rfm, ids = segment.load_rfm(conn, REF)
    finally:
        conn.close()
    by_id = {cid: rfm[i] for i, cid in enumerate(ids)}
    # Customer 7 (Lapsed): one tx on 2024-03-15, $15. Recency from REF is ~ 2 years.
    rec, freq, mon = by_id[7]
    assert freq == 1
    assert mon == pytest.approx(15.0)
    assert rec > 700  # well over 700 days
    # Customer 4 (Mid): 3 transactions, last on 2026-01-15, $50 each.
    rec, freq, mon = by_id[4]
    assert freq == 3
    assert mon == pytest.approx(150.0)
    # Customer 1 (VIP): 7 transactions (6 March + 1 April), last == REF.
    rec, freq, mon = by_id[1]
    assert freq == 7
    assert rec == pytest.approx(0.0)


# ---------- cluster_rfm: deterministic + minimum size guard ----------


def test_cluster_rfm_is_deterministic_with_fixed_seed():
    rng = np.random.default_rng(0)
    rfm = rng.normal(size=(60, 3))
    rfm[:, 2] *= 100  # make scales unequal so standardization matters
    labels_a, centroids_a = segment.cluster_rfm(rfm)
    labels_b, centroids_b = segment.cluster_rfm(rfm)
    np.testing.assert_array_equal(labels_a, labels_b)
    np.testing.assert_allclose(centroids_a, centroids_b)


def test_cluster_rfm_too_few_rows_raises():
    rfm = np.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])
    with pytest.raises(ValueError):
        segment.cluster_rfm(rfm)


# ---------- name_clusters: friendly names when pattern matches, fallback otherwise ----------


def test_name_clusters_friendly_when_pattern_matches():
    centroids = np.array(
        [
            [10.0, 20.0, 5000.0],   # high monetary, low recency, high freq -> VIP
            [200.0, 5.0, 800.0],    # mid
            [800.0, 1.0, 50.0],     # low monetary, high recency -> Lapsed
        ]
    )
    names = segment.name_clusters(centroids)
    assert names[0] == "VIP Loyalists"
    assert names[1] == "Mid Tier Engaged"
    assert names[2] == "Lapsed or New"


def test_name_clusters_falls_back_when_pattern_breaks():
    # Highest monetary cluster does NOT also have lowest recency, so fallback names.
    centroids = np.array(
        [
            [500.0, 20.0, 5000.0],  # high monetary but high recency
            [10.0, 5.0, 800.0],     # most recent but only mid spend
            [800.0, 1.0, 50.0],
        ]
    )
    names = segment.name_clusters(centroids)
    assert all(n.startswith("Segment ") for n in names)
    # Highest monetary still ranks first.
    assert "High Value" in names[0]
    assert "Low Value" in names[2]


# ---------- build_segments: full pipeline contract ----------


def test_build_segments_returns_exactly_three(seeded_db: Path):
    segments = segment.build_segments("Mother's Day Beauty Event", db_path=seeded_db)
    assert len(segments) == 3


REQUIRED_FIELDS = {
    "name",
    "definition",
    "customer_count",
    "avg_recency_days",
    "avg_frequency",
    "avg_monetary",
    "top_category",
    "top_category_lift",
    "loyalty_mix",
}


def test_build_segments_each_dict_has_all_required_fields(seeded_db: Path):
    segments = segment.build_segments("anything", db_path=seeded_db)
    for seg in segments:
        assert REQUIRED_FIELDS.issubset(seg.keys()), f"missing keys in {seg}"
        assert isinstance(seg["customer_count"], int)
        assert isinstance(seg["avg_recency_days"], float)
        assert isinstance(seg["avg_frequency"], float)
        assert isinstance(seg["avg_monetary"], float)
        assert seg["top_category"] is None or isinstance(seg["top_category"], str)
        assert isinstance(seg["top_category_lift"], float)
        assert isinstance(seg["loyalty_mix"], dict)


def test_build_segments_counts_sum_to_clustered_customer_total(seeded_db: Path):
    """Counts sum to the number of customers with at least one transaction
    (customers without transactions are excluded from RFM)."""
    segments = segment.build_segments("any", db_path=seeded_db)
    total_in_segments = sum(s["customer_count"] for s in segments)

    conn = sqlite3.connect(str(seeded_db))
    total_customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    n_with_tx = conn.execute(
        "SELECT COUNT(DISTINCT customer_id) FROM transactions"
    ).fetchone()[0]
    conn.close()

    assert total_in_segments == n_with_tx
    # The excluded share is small (one no-tx customer here, much less than 5%
    # of the 50k customer base in production data).
    assert total_in_segments >= total_customers - max(1, total_customers // 20)


def test_build_segments_is_deterministic_on_repeated_runs(seeded_db: Path):
    a = segment.build_segments("brief", db_path=seeded_db)
    b = segment.build_segments("brief", db_path=seeded_db)
    a_summary = [(s["name"], s["customer_count"], s["avg_monetary"]) for s in a]
    b_summary = [(s["name"], s["customer_count"], s["avg_monetary"]) for s in b]
    assert a_summary == b_summary


def test_build_segments_assigns_friendly_names_on_seeded_data(seeded_db: Path):
    """The seeded fixture is engineered to produce VIP / Mid / Lapsed."""
    segments = segment.build_segments("brief", db_path=seeded_db)
    names = [s["name"] for s in segments]
    assert "VIP Loyalists" in names
    assert "Mid Tier Engaged" in names
    assert "Lapsed or New" in names


def test_build_segments_vip_segment_top_category_is_beauty(seeded_db: Path):
    """VIP cluster is 100 percent Beauty txs; overall Beauty share is ~61 percent
    (19 of 31 seeded txs), so lift is positive and Beauty wins."""
    segments = segment.build_segments("brief", db_path=seeded_db)
    vip = next(s for s in segments if s["name"] == "VIP Loyalists")
    assert vip["top_category"] == "Beauty"
    assert vip["top_category_lift"] > 0.0
    # 100% in cluster vs ~61.3% overall -> lift ~0.63
    assert vip["top_category_lift"] == pytest.approx(0.63, abs=0.05)
    # VIP cluster contains customers 1..3, all Platinum.
    assert vip["loyalty_mix"] == {"Platinum": 100.0}
    assert vip["customer_count"] == 3


def test_build_segments_mid_segment_top_category_is_apparel(seeded_db: Path):
    """Mid cluster is 100 percent Apparel; overall Apparel share is ~29 percent
    (9 of 31), so Apparel has high positive lift here."""
    segments = segment.build_segments("brief", db_path=seeded_db)
    mid = next(s for s in segments if s["name"] == "Mid Tier Engaged")
    assert mid["top_category"] == "Apparel"
    assert mid["top_category_lift"] > 1.0  # 100% vs ~29% is well over 1.0


def test_build_segments_lapsed_segment_top_category_is_home(seeded_db: Path):
    """Lapsed cluster is 100 percent Home; overall Home share is ~10 percent
    (3 of 31), so Home has the largest lift in the seeded fixture."""
    segments = segment.build_segments("brief", db_path=seeded_db)
    lapsed = next(s for s in segments if s["name"] == "Lapsed or New")
    assert lapsed["top_category"] == "Home"
    assert lapsed["top_category_lift"] > 5.0  # 100% vs ~10% is a very large lift
    assert lapsed["loyalty_mix"] == {"Bronze": 100.0}
    assert lapsed["customer_count"] == 3


def test_build_segments_missing_db_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        segment.build_segments("brief", db_path=tmp_path / "nope.db")


# ---------- _pick_top_category_by_lift ----------


def test_pick_top_category_by_lift_picks_highest_positive():
    cluster = {"Beauty": 0.50, "Apparel": 0.30, "Home": 0.20}
    overall = {"Beauty": 0.20, "Apparel": 0.40, "Home": 0.40}
    # Lifts: Beauty +1.5, Apparel -0.25, Home -0.5
    cat, lift = segment._pick_top_category_by_lift(cluster, overall)
    assert cat == "Beauty"
    assert lift == pytest.approx(1.5)


def test_pick_top_category_by_lift_falls_back_when_no_positive():
    """If every category in the cluster is under-represented vs overall,
    return the highest-share category in the cluster with lift 0.0."""
    cluster = {"Beauty": 0.20, "Apparel": 0.50, "Home": 0.30}
    overall = {"Beauty": 0.30, "Apparel": 0.60, "Home": 0.40}
    # All lifts negative; Apparel has the highest cluster share.
    cat, lift = segment._pick_top_category_by_lift(cluster, overall)
    assert cat == "Apparel"
    assert lift == 0.0


def test_pick_top_category_by_lift_handles_empty_cluster():
    cat, lift = segment._pick_top_category_by_lift({}, {"Beauty": 0.5, "Apparel": 0.5})
    assert cat is None
    assert lift == 0.0


def test_pick_top_category_by_lift_skips_categories_missing_overall():
    """A category that is not present in the overall share has no defined lift,
    and should not be considered."""
    cluster = {"Beauty": 0.40, "Mystery": 0.60}
    overall = {"Beauty": 0.20}
    cat, lift = segment._pick_top_category_by_lift(cluster, overall)
    assert cat == "Beauty"
    assert lift == pytest.approx(1.0)


def test_pick_top_category_by_lift_tie_breaks_on_name():
    cluster = {"Beauty": 0.40, "Apparel": 0.40}
    overall = {"Beauty": 0.20, "Apparel": 0.20}
    # Both lifts == +1.0; tie break on name ascending picks "Apparel".
    cat, lift = segment._pick_top_category_by_lift(cluster, overall)
    assert cat == "Apparel"
    assert lift == pytest.approx(1.0)


# ---------- format_segments + recommend ----------


def test_format_segments_renders_three_blocks_and_header(seeded_db: Path):
    segments = segment.build_segments("Mother's Day Beauty Event", db_path=seeded_db)
    out = segment.format_segments("Mother's Day Beauty Event", segments, total_customers=10)
    assert "SEGMENT OPTIONS for: Mother's Day Beauty Event" in out
    assert "RFM clustering" in out
    assert "SEGMENT 1:" in out
    assert "SEGMENT 2:" in out
    assert "SEGMENT 3:" in out
    assert "Recommendation:" in out


def test_format_segments_top_category_includes_lift_percentage(seeded_db: Path):
    segments = segment.build_segments("brief", db_path=seeded_db)
    out = segment.format_segments("brief", segments, total_customers=10)
    # All seeded segments should have positive lift; expect at least one
    # "Top Category: <name> (+NN percent vs avg)" line.
    import re
    matches = re.findall(r"Top Category:\s+\S+\s+\(\+\d+ percent vs avg\)", out)
    assert len(matches) >= 1, f"no '(+N percent vs avg)' line found in:\n{out}"


def test_fmt_top_category_signs_and_zero_case():
    # Positive lift -> "+N percent vs avg"
    assert segment._fmt_top_category("Beauty", 0.35) == "Beauty (+35 percent vs avg)"
    # Negative lift (shouldn't happen via picker but the formatter handles it).
    assert segment._fmt_top_category("Apparel", -0.20) == "Apparel (-20 percent vs avg)"
    # Zero lift fallback.
    assert segment._fmt_top_category("Home", 0.0) == "Home (+0 percent vs avg)"
    # None category.
    assert segment._fmt_top_category(None, 0.0) == "n/a"


def test_recommend_picks_high_value_for_beauty_brief():
    segments = [
        {"name": "VIP Loyalists", "customer_count": 100},
        {"name": "Mid Tier Engaged", "customer_count": 1000},
        {"name": "Lapsed or New", "customer_count": 500},
    ]
    rec = segment._recommend(segments, "Mother's Day Beauty Event")
    assert "VIP Loyalists" in rec


def test_recommend_picks_low_value_for_winback_brief():
    segments = [
        {"name": "VIP Loyalists", "customer_count": 100},
        {"name": "Mid Tier Engaged", "customer_count": 1000},
        {"name": "Lapsed or New", "customer_count": 500},
    ]
    rec = segment._recommend(segments, "Welcome new customer reactivation")
    assert "Lapsed or New" in rec


def test_recommend_falls_back_to_largest_when_brief_unrelated():
    segments = [
        {"name": "VIP Loyalists", "customer_count": 100},
        {"name": "Mid Tier Engaged", "customer_count": 1000},
        {"name": "Lapsed or New", "customer_count": 500},
    ]
    rec = segment._recommend(segments, "denim flash sale")
    assert "Mid Tier Engaged" in rec  # largest count


# ---------- formatters ----------


def test_fmt_int_with_commas():
    assert segment._fmt_int(8431) == "8,431"
    assert segment._fmt_int(0) == "0"
    assert segment._fmt_int(None) == "n/a"


def test_fmt_dollars_rounds_and_adds_comma():
    assert segment._fmt_dollars(1247.67) == "$1,248"
    assert segment._fmt_dollars(0) == "$0"
    assert segment._fmt_dollars(None) == "n/a"


def test_fmt_loyalty_mix_orders_high_tier_first():
    out = segment._fmt_loyalty_mix({"Bronze": 10.0, "Platinum": 60.0, "Silver": 30.0})
    assert out.index("Platinum") < out.index("Silver") < out.index("Bronze")
    assert "60 percent Platinum" in out


# ---------- main entry point ----------


def test_main_no_args_returns_nonzero(capsys):
    rc = segment.main(["segment.py"])
    assert rc != 0
    err = capsys.readouterr().err
    assert "Usage" in err
