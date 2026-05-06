"""Campaign Performance Analyzer skill.

Pulls campaign performance from `data/macys.db`, runs last touch attribution
across channels, segments, and SKUs, then projects the next N days of revenue,
conversions, and ROAS via linear regression with 80 percent confidence intervals.

Maps to workflow step 9 (Monitoring, fully automated). The natural handoff is
step 10 (Reporting), where Anna takes the auto generated readout, adds business
context, and forwards to leadership.

Usage:
    uv run python skills/campaign-performance-analyzer/analyze.py 7
    uv run python skills/campaign-performance-analyzer/analyze.py 7 --forecast-days 14
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = _REPO_ROOT / "data" / "macys.db"

DEFAULT_FORECAST_DAYS = 14
MIN_DAYS_FOR_FORECAST = 14
Z_80_PCT = 1.2816  # two sided 80 percent z score

# Threshold (relative to recent mean) above which a forecast is "up" or "down".
TREND_PCT_THRESHOLD = 0.05

# A channel below this share of total spend is excluded from "worst channel"
# selection so a near zero spend channel does not skew the headline.
WORST_CHANNEL_MIN_SPEND_SHARE = 0.05


# ---------- DB ----------


def connect_db(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    return sqlite3.connect(str(db_path))


def get_campaign_meta(conn: sqlite3.Connection, campaign_id: int) -> dict | None:
    row = conn.execute(
        "SELECT campaign_id, campaign_name, brief, target_segment, "
        "start_date, end_date, total_budget, status "
        "FROM campaigns WHERE campaign_id = ?",
        (int(campaign_id),),
    ).fetchone()
    if not row:
        return None
    return {
        "campaign_id": int(row[0]),
        "campaign_name": row[1],
        "brief": row[2],
        "target_segment": row[3],
        "start_date": row[4],
        "end_date": row[5],
        "total_budget": float(row[6] or 0),
        "status": row[7],
    }


# ---------- pure math helpers ----------


def _safe_divide(numer: float, denom: float, default: float = 0.0) -> float:
    if denom is None or denom == 0:
        return default
    return numer / denom


def _trend_direction(predicted: float, recent_mean: float) -> str:
    """Compare a forecast point estimate to the recent mean of the series."""
    if recent_mean is None or recent_mean == 0:
        return "flat"
    pct = (predicted - recent_mean) / abs(recent_mean)
    if pct > TREND_PCT_THRESHOLD:
        return "up"
    if pct < -TREND_PCT_THRESHOLD:
        return "down"
    return "flat"


def forecast_metric(values: list[float], horizon_days: int) -> dict:
    """Linear regression forecast with 80 percent confidence interval.

    Fits y = m * x + b on (day_index, value) for the input series, then projects
    the value at day index `len(values) - 1 + horizon_days`. Confidence uses the
    OLS residual standard deviation under a normal approximation.

    Returns:
        {"predicted": float, "lower_bound": float, "upper_bound": float,
         "trend_direction": str, "slope": float, "intercept": float}

    Raises ValueError when the input has fewer than MIN_DAYS_FOR_FORECAST points.
    """
    n = len(values)
    if n < MIN_DAYS_FOR_FORECAST:
        raise ValueError(
            f"insufficient_data: need at least {MIN_DAYS_FOR_FORECAST} points, got {n}"
        )

    x = np.arange(n, dtype=float)
    y = np.asarray(values, dtype=float)

    slope, intercept = np.polyfit(x, y, 1)
    fitted = slope * x + intercept
    residuals = y - fitted
    residual_std = float(np.sqrt(np.sum(residuals**2) / max(n - 2, 1)))

    target_x = float(n - 1 + int(horizon_days))
    predicted = float(slope * target_x + intercept)
    margin = Z_80_PCT * residual_std
    lower = predicted - margin
    upper = predicted + margin

    recent_mean = float(np.mean(y[-7:])) if n >= 7 else float(np.mean(y))
    trend = _trend_direction(predicted, recent_mean)

    return {
        "predicted": predicted,
        "lower_bound": lower,
        "upper_bound": upper,
        "trend_direction": trend,
        "slope": float(slope),
        "intercept": float(intercept),
    }


# ---------- attribution ----------


def attribution_by_channel(
    conn: sqlite3.Connection, campaign_id: int
) -> list[dict]:
    """Aggregate revenue, cost, conversions, ROAS, CAC per channel."""
    rows = conn.execute(
        """
        SELECT channel,
               SUM(revenue)     AS revenue,
               SUM(cost)        AS spend,
               SUM(conversions) AS conversions,
               SUM(impressions) AS impressions,
               SUM(clicks)      AS clicks
        FROM campaign_performance
        WHERE campaign_id = ?
        GROUP BY channel
        """,
        (int(campaign_id),),
    ).fetchall()

    out: list[dict] = []
    for r in rows:
        revenue = float(r[1] or 0)
        spend = float(r[2] or 0)
        conversions = int(r[3] or 0)
        out.append(
            {
                "channel": r[0],
                "revenue": round(revenue, 2),
                "spend": round(spend, 2),
                "conversions": conversions,
                "impressions": int(r[4] or 0),
                "clicks": int(r[5] or 0),
                "roas": round(_safe_divide(revenue, spend), 2),
                "cac": round(_safe_divide(spend, conversions), 2),
            }
        )

    out.sort(key=lambda d: (-d["roas"], d["channel"]))
    for i, d in enumerate(out, start=1):
        d["rank"] = i
    return out


def _pick_top_channel(channels: list[dict]) -> str | None:
    if not channels:
        return None
    return channels[0]["channel"]


def _pick_worst_channel(channels: list[dict]) -> str | None:
    """Lowest ROAS, but ignore channels with under 5 percent of total spend."""
    if not channels:
        return None
    total_spend = sum(c["spend"] for c in channels)
    if total_spend <= 0:
        return None
    eligible = [
        c for c in channels if c["spend"] >= WORST_CHANNEL_MIN_SPEND_SHARE * total_spend
    ]
    if not eligible:
        eligible = channels
    return min(eligible, key=lambda c: c["roas"])["channel"]


def attribution_by_segment(
    conn: sqlite3.Connection, start_date: str, end_date: str
) -> list[dict]:
    """Use customers.loyalty_tier as the segment dimension.

    The schema does not store segment on campaign_performance, so we project
    the campaign window onto the transactions table and group by the buyer's
    loyalty tier. Conversion is the count of *unique customers* who made at
    least one purchase in the window. Conversion rate is therefore
    `unique_buyers_in_tier / customer_base_in_tier`, bounded in [0, 1] so
    executives reading the readout see a probability style number.
    """
    rows = conn.execute(
        """
        SELECT c.loyalty_tier,
               COUNT(DISTINCT t.customer_id)                                       AS unique_buyers,
               SUM(t.unit_price * t.quantity * (1 - COALESCE(t.discount_pct, 0)))  AS revenue
        FROM transactions t
        JOIN customers c ON t.customer_id = c.customer_id
        WHERE t.transaction_date BETWEEN ? AND ?
        GROUP BY c.loyalty_tier
        """,
        (start_date, end_date),
    ).fetchall()

    base_rows = conn.execute(
        "SELECT loyalty_tier, COUNT(*) FROM customers GROUP BY loyalty_tier"
    ).fetchall()
    base = {r[0]: int(r[1]) for r in base_rows}

    total_unique_buyers = sum(int(r[1] or 0) for r in rows)
    total_customers = sum(base.values()) or 1
    overall_rate = total_unique_buyers / total_customers

    out: list[dict] = []
    for r in rows:
        tier = r[0]
        unique_buyers = int(r[1] or 0)
        revenue = float(r[2] or 0)
        tier_base = base.get(tier, 0)
        rate = _safe_divide(unique_buyers, tier_base)
        lift = _safe_divide(rate - overall_rate, overall_rate)
        out.append(
            {
                "segment": tier,
                # `conversions` keeps the field name for backward compatibility,
                # but now represents unique buyers (customers with >= 1 tx).
                "conversions": unique_buyers,
                "revenue": round(revenue, 2),
                "customer_base": tier_base,
                "conversion_rate": round(rate, 6),
                "lift_vs_avg": round(lift, 4),
            }
        )

    out.sort(key=lambda d: -d["lift_vs_avg"])
    return out


def _attribution_by_sku_revenue(
    conn: sqlite3.Connection, start_date: str, end_date: str, limit: int = 10
) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.sku_id, s.product_name,
               SUM(t.unit_price * t.quantity * (1 - COALESCE(t.discount_pct, 0))) AS revenue,
               SUM(t.quantity) AS units
        FROM transactions t
        JOIN sku_catalog s ON t.sku_id = s.sku_id
        WHERE t.transaction_date BETWEEN ? AND ?
        GROUP BY s.sku_id, s.product_name
        ORDER BY revenue DESC, s.sku_id ASC
        LIMIT ?
        """,
        (start_date, end_date, int(limit)),
    ).fetchall()
    return [
        {
            "sku_id": int(r[0]),
            "name": r[1],
            "revenue": round(float(r[2] or 0), 2),
            "units": int(r[3] or 0),
        }
        for r in rows
    ]


def _attribution_by_sku_units(
    conn: sqlite3.Connection, start_date: str, end_date: str, limit: int = 10
) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.sku_id, s.product_name,
               SUM(t.quantity) AS units,
               SUM(t.unit_price * t.quantity * (1 - COALESCE(t.discount_pct, 0))) AS revenue
        FROM transactions t
        JOIN sku_catalog s ON t.sku_id = s.sku_id
        WHERE t.transaction_date BETWEEN ? AND ?
        GROUP BY s.sku_id, s.product_name
        ORDER BY units DESC, s.sku_id ASC
        LIMIT ?
        """,
        (start_date, end_date, int(limit)),
    ).fetchall()
    return [
        {
            "sku_id": int(r[0]),
            "name": r[1],
            "units": int(r[2] or 0),
            "revenue": round(float(r[3] or 0), 2),
        }
        for r in rows
    ]


# ---------- forecasting ----------


def _daily_series(
    conn: sqlite3.Connection, campaign_id: int, days: int = 30
) -> dict[str, list[float]]:
    """Return daily revenue, conversions, cost for the last `days` days
    of the campaign's performance, in chronological order."""
    rows = conn.execute(
        """
        SELECT date,
               SUM(revenue)     AS revenue,
               SUM(conversions) AS conversions,
               SUM(cost)        AS cost
        FROM campaign_performance
        WHERE campaign_id = ?
        GROUP BY date
        ORDER BY date ASC
        """,
        (int(campaign_id),),
    ).fetchall()
    rows = rows[-int(days):] if rows else rows
    return {
        "dates": [r[0] for r in rows],
        "revenue": [float(r[1] or 0) for r in rows],
        "conversions": [float(r[2] or 0) for r in rows],
        "cost": [float(r[3] or 0) for r in rows],
    }


def _forecast_block(
    series: dict[str, list[float]], horizon_days: int
) -> dict:
    """Build the forecast section of the analysis dict. Returns
    success/insufficient_data and per metric forecasts."""
    n = len(series["dates"])
    if n < MIN_DAYS_FOR_FORECAST:
        return {
            "horizon_days": horizon_days,
            "history_days": n,
            "forecast_status": "insufficient_data",
            "message": (
                f"Need at least {MIN_DAYS_FOR_FORECAST} days of campaign performance "
                f"history to forecast, found {n}."
            ),
            "revenue": None,
            "conversions": None,
            "roas": None,
        }

    rev = forecast_metric(series["revenue"], horizon_days)
    conv = forecast_metric(series["conversions"], horizon_days)
    daily_roas = [
        _safe_divide(r, c) for r, c in zip(series["revenue"], series["cost"])
    ]
    roas = forecast_metric(daily_roas, horizon_days)

    def _round_block(b: dict, ints: bool = False) -> dict:
        if ints:
            return {
                "predicted": int(round(b["predicted"])),
                "lower_bound": int(round(b["lower_bound"])),
                "upper_bound": int(round(b["upper_bound"])),
                "trend_direction": b["trend_direction"],
            }
        return {
            "predicted": round(b["predicted"], 2),
            "lower_bound": round(b["lower_bound"], 2),
            "upper_bound": round(b["upper_bound"], 2),
            "trend_direction": b["trend_direction"],
        }

    return {
        "horizon_days": horizon_days,
        "history_days": n,
        "forecast_status": "success",
        "revenue": _round_block(rev),
        "conversions": _round_block(conv, ints=True),
        "roas": _round_block(roas),
    }


# ---------- summary ----------


def _format_money(x: float) -> str:
    if abs(x) >= 1_000_000:
        return f"${x / 1_000_000:.2f}M"
    if abs(x) >= 1_000:
        return f"${x / 1_000:.0f}K"
    return f"${x:,.0f}"


def _format_pct(x: float) -> str:
    return f"{x * 100:+.0f}%"


def _make_summary(
    meta: dict,
    totals: dict,
    channels: list[dict],
    segments: list[dict],
    forecast: dict,
) -> str:
    name = meta["campaign_name"]
    revenue_str = _format_money(totals["revenue"])
    days = totals["days"]
    budget = meta.get("total_budget") or 0
    over_under = ""
    if budget > 0 and totals["spend"] > 0:
        delta = (totals["spend"] - budget) / budget
        if delta > 0.05:
            over_under = f", running {abs(delta) * 100:.0f} percent over budget"
        elif delta < -0.05:
            over_under = f", running {abs(delta) * 100:.0f} percent under budget"

    if channels:
        top = channels[0]
        worst_name = _pick_worst_channel(channels) or "n/a"
        worst = next((c for c in channels if c["channel"] == worst_name), None)
        channel_line = (
            f"{top['channel']} was the strongest channel ({top['roas']:.1f}x ROAS), "
            f"while {worst['channel']} underperformed ({worst['roas']:.1f}x ROAS)."
        )
    else:
        channel_line = "No channel performance data is available yet."

    if segments:
        top_segment = segments[0]
        seg_line = (
            f"The {top_segment['segment']} segment over indexed at "
            f"{_format_pct(top_segment['lift_vs_avg'])} vs the campaign average "
            f"conversion rate."
        )
    else:
        seg_line = "Segment data is not available for this window."

    if forecast.get("forecast_status") == "success":
        rev_f = forecast["revenue"]
        forecast_line = (
            f"Looking ahead to the next {forecast['horizon_days']} days, "
            f"revenue is forecast to trend {rev_f['trend_direction']} to "
            f"{_format_money(rev_f['predicted'])} (80 percent CI: "
            f"{_format_money(rev_f['lower_bound'])} to "
            f"{_format_money(rev_f['upper_bound'])})."
        )
    else:
        forecast_line = (
            f"Forecast is not available yet ({forecast.get('history_days', 0)} days "
            f"of history, need at least {MIN_DAYS_FOR_FORECAST})."
        )

    return (
        f"The {name} generated {revenue_str} in revenue across {days} days"
        f"{over_under}. {channel_line} {seg_line} {forecast_line}"
    )


# ---------- main pipeline ----------


def _campaign_window(meta: dict, conn: sqlite3.Connection) -> dict:
    """Compute the effective campaign window using performance data extents
    when available; fall back to the campaign's planned start/end dates."""
    perf = conn.execute(
        "SELECT MIN(date), MAX(date) FROM campaign_performance WHERE campaign_id = ?",
        (meta["campaign_id"],),
    ).fetchone()

    start = perf[0] or meta["start_date"]
    end_planned = meta["end_date"]
    end_perf = perf[1] or meta["end_date"]
    today = date.today().isoformat()
    end = min(today, end_perf, end_planned)

    try:
        days = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    except (ValueError, TypeError):
        days = 0
    return {"start": start, "end": end, "days": max(days, 0)}


def _totals(channels: list[dict]) -> dict:
    revenue = sum(c["revenue"] for c in channels)
    spend = sum(c["spend"] for c in channels)
    conversions = sum(c["conversions"] for c in channels)
    return {
        "revenue": round(revenue, 2),
        "spend": round(spend, 2),
        "conversions": conversions,
        "roas": round(_safe_divide(revenue, spend), 2),
    }


def analyze_campaign(
    campaign_id: int,
    forecast_days: int = DEFAULT_FORECAST_DAYS,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict:
    """Run attribution + forecast + summary for a single campaign."""
    conn = connect_db(db_path)
    try:
        meta = get_campaign_meta(conn, int(campaign_id))
        if meta is None:
            raise ValueError(f"campaign_id {campaign_id} not found in campaigns table")

        window = _campaign_window(meta, conn)
        channels = attribution_by_channel(conn, int(campaign_id))
        segments = attribution_by_segment(conn, window["start"], window["end"])
        sku_revenue = _attribution_by_sku_revenue(conn, window["start"], window["end"])
        sku_units = _attribution_by_sku_units(conn, window["start"], window["end"])
        series = _daily_series(conn, int(campaign_id), days=30)
    finally:
        conn.close()

    forecast = _forecast_block(series, int(forecast_days))
    totals = _totals(channels)
    totals_with_window = {**totals, "days": window["days"]}
    summary = _make_summary(meta, totals_with_window, channels, segments, forecast)

    return {
        "campaign_id": meta["campaign_id"],
        "campaign_name": meta["campaign_name"],
        "campaign_status": meta["status"],
        "campaign_window": window,
        "totals": totals,
        "attribution": {
            "by_channel": channels,
            "by_segment": segments,
            "by_sku_revenue": sku_revenue,
            "by_sku_units": sku_units,
            "top_channel": _pick_top_channel(channels),
            "worst_channel": _pick_worst_channel(channels),
            "top_segment": segments[0]["segment"] if segments else None,
        },
        "forecast": forecast,
        "summary": summary,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------- formatter ----------


def _fmt_int(n: int) -> str:
    return f"{n:,}"


def format_results(analysis: dict) -> str:
    bar = "=" * 64
    meta_line_window = analysis["campaign_window"]
    lines = [
        bar,
        f"CAMPAIGN PERFORMANCE ANALYSIS for: Campaign ID {analysis['campaign_id']}",
        f'"{analysis["campaign_name"]}" '
        f"({meta_line_window['days']} days, {meta_line_window['start']} to {meta_line_window['end']})",
        bar,
        "",
    ]

    totals = analysis["totals"]
    lines.append("REVENUE BREAKDOWN")
    lines.append(f"Total Revenue:    {_format_money(totals['revenue'])}")
    lines.append(f"Total Spend:      {_format_money(totals['spend'])}")
    lines.append(f"Overall ROAS:     {totals['roas']:.1f}x")
    lines.append(f"Total Conversions: {_fmt_int(totals['conversions'])}")
    lines.append("")

    channels = analysis["attribution"]["by_channel"]
    lines.append("CHANNEL ATTRIBUTION (top 5 by ROAS)")
    if channels:
        header = f"{'Channel':<14} {'Revenue':>12} {'Spend':>12} {'ROAS':>6} {'CAC':>9}"
        lines.append(header)
        for c in channels[:5]:
            roas_s = f"{c['roas']:.1f}x"
            cac_s = f"${c['cac']:.2f}" if c["conversions"] else "n/a"
            lines.append(
                f"{c['channel']:<14} "
                f"{_format_money(c['revenue']):>12} "
                f"{_format_money(c['spend']):>12} "
                f"{roas_s:>6} "
                f"{cac_s:>9}"
            )
        lines.append("")
        lines.append(f"Top Channel:    {analysis['attribution']['top_channel']}")
        lines.append(f"Worst Channel:  {analysis['attribution']['worst_channel']}")
    else:
        lines.append("(no channel performance data)")
    lines.append("")

    segments = analysis["attribution"]["by_segment"]
    lines.append("SEGMENT ATTRIBUTION (loyalty tier)")
    if segments:
        header = f"{'Segment':<14} {'Conversions':>12} {'Conv Rate':>10} {'vs Avg':>8}"
        lines.append(header)
        for s in segments:
            rate = f"{s['conversion_rate'] * 100:.2f}%"
            lift = _format_pct(s["lift_vs_avg"])
            lines.append(
                f"{s['segment']:<14} "
                f"{_fmt_int(s['conversions']):>12} "
                f"{rate:>10} "
                f"{lift:>8}"
            )
        lines.append("")
        lines.append(
            f"Top Segment: {analysis['attribution']['top_segment']} "
            f"({_format_pct(segments[0]['lift_vs_avg'])} vs campaign average)"
        )
    else:
        lines.append("(no segment data in window)")
    lines.append("")

    sku_rev = analysis["attribution"]["by_sku_revenue"]
    lines.append("TOP SKUs BY REVENUE")
    if sku_rev:
        for i, s in enumerate(sku_rev, start=1):
            lines.append(
                f"  {i:>2}. {s['name']} (sku {s['sku_id']}): "
                f"{_format_money(s['revenue'])} ({_fmt_int(s['units'])} units)"
            )
    else:
        lines.append("(no transaction data in window)")
    lines.append("")

    forecast = analysis["forecast"]
    lines.append(f"FORECAST (next {forecast['horizon_days']} days)")
    if forecast["forecast_status"] == "success":
        rev = forecast["revenue"]
        conv = forecast["conversions"]
        roas = forecast["roas"]
        lines.append(
            f"Revenue:     {_format_money(rev['predicted'])} "
            f"(CI: {_format_money(rev['lower_bound'])} to {_format_money(rev['upper_bound'])}), "
            f"trending {rev['trend_direction'].upper()}"
        )
        lines.append(
            f"Conversions: {_fmt_int(conv['predicted'])} "
            f"(CI: {_fmt_int(conv['lower_bound'])} to {_fmt_int(conv['upper_bound'])}), "
            f"trending {conv['trend_direction'].upper()}"
        )
        lines.append(
            f"ROAS:        {roas['predicted']:.1f}x "
            f"(CI: {roas['lower_bound']:.1f}x to {roas['upper_bound']:.1f}x), "
            f"trending {roas['trend_direction'].upper()}"
        )
        lines.append(f"Forecast status: success ({forecast['history_days']} days of history used)")
    else:
        lines.append(forecast.get("message", "insufficient data to forecast"))
    lines.append("")

    lines.append("EXECUTIVE SUMMARY")
    lines.append(analysis["summary"])
    lines.append("")
    lines.append(bar)
    return "\n".join(lines)


# ---------- main ----------


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Analyze a campaign's performance: attribution + forecast."
    )
    parser.add_argument("campaign_id", type=int, nargs="?", default=7)
    parser.add_argument("--forecast-days", type=int, default=DEFAULT_FORECAST_DAYS)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args(argv[1:])

    analysis = analyze_campaign(
        args.campaign_id,
        forecast_days=args.forecast_days,
        db_path=Path(args.db),
    )
    print(format_results(analysis))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
