"""Audience Segment Builder skill.

Discovers three audience segments via k-means clustering on RFM features
(Recency, Frequency, Monetary value) over the customer transaction history
in `data/macys.db`. Returns segment metrics suitable for a campaign manager
choosing whom to target.

Usage:
    uv run python skills/audience-segment-builder/segment.py "Mother's Day Beauty Event"
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "macys.db"

N_CLUSTERS = 3
RANDOM_STATE = 42
RFM_FEATURES = ("recency_days", "frequency", "monetary")


def connect_db(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    return sqlite3.connect(str(db_path))


def get_reference_date(conn: sqlite3.Connection) -> str:
    """Anchor recency on the most recent transaction date in the DB."""
    row = conn.execute("SELECT MAX(transaction_date) FROM transactions").fetchone()
    if not row or row[0] is None:
        raise ValueError("transactions table is empty, cannot compute RFM")
    return row[0]


def total_customer_count(conn: sqlite3.Connection) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0])


def load_rfm(
    conn: sqlite3.Connection, ref_date: str
) -> tuple[np.ndarray, list[int]]:
    """Compute RFM per customer; exclude customers with no transactions.

    Returns (rfm_matrix shape (n, 3), customer_ids list of length n).
    Columns: 0 = recency_days, 1 = frequency, 2 = monetary.
    """
    rows = conn.execute(
        """
        SELECT
            t.customer_id,
            CAST(julianday(?) - julianday(MAX(t.transaction_date)) AS REAL) AS recency_days,
            COUNT(*)                                                        AS frequency,
            SUM(t.unit_price * t.quantity * (1 - COALESCE(t.discount_pct, 0))) AS monetary
        FROM transactions t
        GROUP BY t.customer_id
        """,
        (ref_date,),
    ).fetchall()

    if not rows:
        return np.zeros((0, 3), dtype=float), []

    customer_ids = [int(r[0]) for r in rows]
    matrix = np.array(
        [(float(r[1]), float(r[2]), float(r[3] or 0.0)) for r in rows],
        dtype=float,
    )
    return matrix, customer_ids


def cluster_rfm(
    rfm: np.ndarray,
    n_clusters: int = N_CLUSTERS,
    random_state: int = RANDOM_STATE,
) -> tuple[np.ndarray, np.ndarray]:
    """Standardize then run KMeans. Returns (labels, centroids_in_original_units)."""
    if rfm.shape[0] < n_clusters:
        raise ValueError(
            f"need at least {n_clusters} customers with transactions to cluster, "
            f"got {rfm.shape[0]}"
        )
    scaler = StandardScaler()
    z = scaler.fit_transform(rfm)
    km = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    labels = km.fit_predict(z)
    centroids_orig = scaler.inverse_transform(km.cluster_centers_)
    return labels.astype(int), centroids_orig


def name_clusters(centroids_orig: np.ndarray) -> list[str]:
    """Auto generate human readable names from RFM centroids.

    Convention: column 0 = recency (lower is better), 1 = frequency (higher
    is better), 2 = monetary (higher is better).

    If the highest monetary cluster also has the lowest recency and the
    highest frequency, and the lowest monetary cluster has the highest
    recency, use the friendly names. Otherwise fall back to a monetary
    rank labelling.
    """
    n = centroids_orig.shape[0]
    if n != 3:
        raise ValueError(f"name_clusters expects 3 clusters, got {n}")

    recency = centroids_orig[:, 0]
    frequency = centroids_orig[:, 1]
    monetary = centroids_orig[:, 2]

    high_idx = int(np.argmax(monetary))
    low_idx = int(np.argmin(monetary))
    mid_idx = next(i for i in range(n) if i != high_idx and i != low_idx)

    high_is_vip = (
        int(np.argmin(recency)) == high_idx
        and int(np.argmax(frequency)) == high_idx
    )
    low_is_lapsed = int(np.argmax(recency)) == low_idx

    names: list[str | None] = [None] * n
    if high_is_vip and low_is_lapsed:
        names[high_idx] = "VIP Loyalists"
        names[mid_idx] = "Mid Tier Engaged"
        names[low_idx] = "Lapsed or New"
    else:
        order = list(np.argsort(monetary)[::-1])  # high to low
        fallback = [
            "Segment A High Value",
            "Segment B Mid Value",
            "Segment C Low Value",
        ]
        for rank, idx in enumerate(order):
            names[int(idx)] = fallback[rank]

    return [str(n) for n in names]


def _populate_temp_ids(conn: sqlite3.Connection, customer_ids: list[int]) -> None:
    conn.execute("DROP TABLE IF EXISTS _seg_ids")
    conn.execute("CREATE TEMP TABLE _seg_ids (customer_id INTEGER PRIMARY KEY)")
    if customer_ids:
        conn.executemany(
            "INSERT INTO _seg_ids (customer_id) VALUES (?)",
            [(int(c),) for c in customer_ids],
        )


def _cluster_category_share(conn: sqlite3.Connection) -> dict[str, float]:
    """Share of each category among transactions of the cluster's customers.

    Cluster member ids must be staged in temp table `_seg_ids`.
    """
    rows = conn.execute(
        """
        SELECT s.category, COUNT(*) AS n
        FROM transactions t
        JOIN sku_catalog s ON t.sku_id = s.sku_id
        WHERE t.customer_id IN (SELECT customer_id FROM _seg_ids)
        GROUP BY s.category
        """
    ).fetchall()
    total = sum(int(r[1]) for r in rows)
    if total == 0:
        return {}
    return {str(r[0]): int(r[1]) / total for r in rows}


def _overall_category_share(conn: sqlite3.Connection) -> dict[str, float]:
    """Share of each category across all transactions in the database."""
    rows = conn.execute(
        """
        SELECT s.category, COUNT(*) AS n
        FROM transactions t
        JOIN sku_catalog s ON t.sku_id = s.sku_id
        GROUP BY s.category
        """
    ).fetchall()
    total = sum(int(r[1]) for r in rows)
    if total == 0:
        return {}
    return {str(r[0]): int(r[1]) / total for r in rows}


def _pick_top_category_by_lift(
    cluster_share: dict[str, float],
    overall_share: dict[str, float],
) -> tuple[str | None, float]:
    """Return (category, lift) for the category with the highest positive lift.

    Lift is `(cluster_pct - overall_pct) / overall_pct`. Tie-broken on
    category name ascending.

    If no category in the cluster has positive lift, fall back to the most
    represented category in the cluster with `lift = 0.0`. If the cluster
    has no transactions at all, return `(None, 0.0)`.
    """
    candidates: list[tuple[str, float, float]] = []  # (category, lift, cluster_share)
    for cat, c_share in cluster_share.items():
        o_share = overall_share.get(cat, 0.0)
        if o_share <= 0:
            continue
        lift = (c_share - o_share) / o_share
        candidates.append((cat, lift, c_share))

    if not candidates:
        return None, 0.0

    positive = [c for c in candidates if c[1] > 0]
    if positive:
        positive.sort(key=lambda x: (-x[1], x[0]))
        return positive[0][0], positive[0][1]

    candidates.sort(key=lambda x: (-x[2], x[0]))
    return candidates[0][0], 0.0


def _loyalty_mix(conn: sqlite3.Connection) -> dict[str, float]:
    rows = conn.execute(
        """
        SELECT loyalty_tier, COUNT(*) AS n
        FROM customers
        WHERE customer_id IN (SELECT customer_id FROM _seg_ids)
        GROUP BY loyalty_tier
        """
    ).fetchall()
    total = sum(int(r[1]) for r in rows)
    if total == 0:
        return {}
    return {str(r[0]): round(100.0 * int(r[1]) / total, 1) for r in rows}


def profile_cluster(
    conn: sqlite3.Connection,
    customer_ids: list[int],
    rfm_subset: np.ndarray,
    overall_category_share: dict[str, float] | None = None,
) -> dict:
    """Return profile metrics for a single cluster.

    `top_category` is selected by lift vs the overall category share, not by
    raw cluster representation. `top_category_lift` is the numeric lift
    (e.g. 0.35 means 35 percent above overall share). Pass
    `overall_category_share` to avoid recomputing it across clusters.
    """
    n = len(customer_ids)
    if n == 0:
        return {
            "customer_count": 0,
            "avg_recency_days": 0.0,
            "avg_frequency": 0.0,
            "avg_monetary": 0.0,
            "top_category": None,
            "top_category_lift": 0.0,
            "loyalty_mix": {},
        }
    avg_recency = float(rfm_subset[:, 0].mean())
    avg_frequency = float(rfm_subset[:, 1].mean())
    avg_monetary = float(rfm_subset[:, 2].mean())

    _populate_temp_ids(conn, customer_ids)
    cluster_share = _cluster_category_share(conn)
    overall_share = (
        overall_category_share
        if overall_category_share is not None
        else _overall_category_share(conn)
    )
    top_category, top_category_lift = _pick_top_category_by_lift(cluster_share, overall_share)
    loyalty_mix = _loyalty_mix(conn)

    return {
        "customer_count": n,
        "avg_recency_days": round(avg_recency, 1),
        "avg_frequency": round(avg_frequency, 1),
        "avg_monetary": round(avg_monetary, 2),
        "top_category": top_category,
        "top_category_lift": round(top_category_lift, 4),
        "loyalty_mix": loyalty_mix,
    }


def _definition_from_centroid(name: str, centroid: np.ndarray) -> str:
    r, f, m = centroid
    return (
        f"K-means RFM cluster: avg recency {r:.0f}d, "
        f"frequency {f:.1f} txns, monetary ${m:,.0f}"
    )


def build_segments(
    brief_description: str,
    db_path: Path | str = DEFAULT_DB_PATH,
    n_clusters: int = N_CLUSTERS,
    random_state: int = RANDOM_STATE,
) -> list[dict]:
    """Run RFM k-means and return one dict per discovered segment.

    Returns a list of length n_clusters (default 3). Each dict contains:
        name, definition, customer_count, avg_recency_days, avg_frequency,
        avg_monetary, top_category, loyalty_mix.

    Customers with no transactions are excluded from clustering.
    """
    conn = connect_db(db_path)
    try:
        ref_date = get_reference_date(conn)
        rfm, customer_ids = load_rfm(conn, ref_date)
        labels, centroids = cluster_rfm(
            rfm, n_clusters=n_clusters, random_state=random_state
        )
        names = name_clusters(centroids) if n_clusters == 3 else [
            f"Cluster {i + 1}" for i in range(n_clusters)
        ]

        overall_share = _overall_category_share(conn)

        segments: list[dict] = []
        for cluster_idx in range(n_clusters):
            mask = labels == cluster_idx
            ids = [customer_ids[i] for i in np.where(mask)[0]]
            profile = profile_cluster(conn, ids, rfm[mask], overall_category_share=overall_share)
            segments.append(
                {
                    "name": names[cluster_idx],
                    "definition": _definition_from_centroid(
                        names[cluster_idx], centroids[cluster_idx]
                    ),
                    **profile,
                }
            )

        priority = {
            "VIP Loyalists": 0,
            "Segment A High Value": 0,
            "Mid Tier Engaged": 1,
            "Segment B Mid Value": 1,
            "Lapsed or New": 2,
            "Segment C Low Value": 2,
        }
        segments.sort(key=lambda s: priority.get(s["name"], 99))
        return segments
    finally:
        conn.close()


def _fmt_int(n: int | None) -> str:
    return f"{n:,}" if n is not None else "n/a"


def _fmt_days(x: float | None) -> str:
    return f"{x:.0f} days" if x is not None else "n/a"


def _fmt_dollars(x: float | None) -> str:
    return f"${x:,.0f}" if x is not None else "n/a"


def _fmt_top_category(category: str | None, lift: float) -> str:
    if category is None:
        return "n/a"
    pct = round(lift * 100)
    sign = "+" if pct >= 0 else "-"
    return f"{category} ({sign}{abs(pct)} percent vs avg)"


def _fmt_loyalty_mix(mix: dict[str, float]) -> str:
    if not mix:
        return "n/a"
    tier_order = ["Platinum", "Gold", "Silver", "Bronze"]
    sorted_tiers = sorted(
        mix.items(),
        key=lambda kv: (tier_order.index(kv[0]) if kv[0] in tier_order else 99, -kv[1]),
    )
    return ", ".join(f"{pct:g} percent {tier}" for tier, pct in sorted_tiers)


def _recommend(segments: list[dict], brief: str) -> str:
    brief_lower = brief.lower()
    by_name = {s["name"]: s for s in segments}

    high_value = (
        by_name.get("VIP Loyalists")
        or by_name.get("Segment A High Value")
    )
    low_value = (
        by_name.get("Lapsed or New")
        or by_name.get("Segment C Low Value")
    )

    high_keywords = ("beauty", "vip", "loyal", "mother", "premium", "luxury")
    low_keywords = ("welcome", "first", "new", "winback", "win back", "reactivate", "lapsed")

    if high_value and any(k in brief_lower for k in high_keywords):
        return f"{high_value['name']} for highest predicted ROI on a {brief.strip()} campaign"
    if low_value and any(k in brief_lower for k in low_keywords):
        return f"{low_value['name']} for a re-engagement push"

    largest = max(segments, key=lambda s: s["customer_count"])
    return f"{largest['name']} (largest reachable audience)"


def format_segments(
    brief: str,
    segments: list[dict],
    total_customers: int | None = None,
) -> str:
    bar = "=" * 60
    lines = [bar, f"SEGMENT OPTIONS for: {brief}"]
    if total_customers is not None:
        lines.append(
            f"Built using RFM clustering (k means, k=3) on "
            f"{_fmt_int(total_customers)} customers"
        )
    else:
        lines.append("Built using RFM clustering (k means, k=3)")
    lines.append(bar)
    lines.append("")

    for i, seg in enumerate(segments, start=1):
        lines.append(f"SEGMENT {i}: {seg['name']}")
        lines.append(f"Customers:     {_fmt_int(seg['customer_count'])}")
        lines.append(f"Avg Recency:   {_fmt_days(seg['avg_recency_days'])}")
        lines.append(
            f"Avg Frequency: {seg['avg_frequency']:g} transactions"
            if seg["customer_count"] > 0
            else "Avg Frequency: n/a"
        )
        lines.append(f"Avg Monetary:  {_fmt_dollars(seg['avg_monetary'])}")
        lines.append(
            f"Top Category:  "
            f"{_fmt_top_category(seg.get('top_category'), seg.get('top_category_lift', 0.0))}"
        )
        lines.append(f"Loyalty Mix:   {_fmt_loyalty_mix(seg['loyalty_mix'])}")
        lines.append("")

    lines.append(f"Recommendation: {_recommend(segments, brief)}")
    lines.append(bar)
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 2 or not argv[1].strip():
        print('Usage: python segment.py "<campaign brief description>"', file=sys.stderr)
        return 1
    brief = argv[1]
    segments = build_segments(brief)
    conn = connect_db(DEFAULT_DB_PATH)
    try:
        total = total_customer_count(conn)
    finally:
        conn.close()
    print(format_segments(brief, segments, total_customers=total))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
