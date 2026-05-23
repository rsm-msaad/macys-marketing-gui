"""Impact metrics endpoints — computes per-campaign and portfolio savings."""

from __future__ import annotations

from fastapi import APIRouter

from api import state as st

router = APIRouter(tags=["impact"])

# ---- Constants from estimates.md ----
# $75/hr fully loaded labor (class-context estimate for mid-level marketing role)
HOURLY_RATE = 75

# Per-step baseline days (current manual process, from estimates.md)
BASELINE_DAYS: dict[str, tuple[float, float]] = {
    "1": (3, 5),      # Briefing
    "2": (2, 3),      # Segmentation
    "3": (3, 5),      # SKU Selection
    "4": (5, 10),     # Creative Production
    "5": (5, 7),      # Layout Assembly
    "6": (3, 7),      # Final Approval (6a+6b+6c combined)
    "7": (5, 8),      # Localization
    "8": (1, 3),      # Activation
    "9": (1, 2),      # Monitoring (report assembly portion)
    "10": (5, 10),    # Reporting
}

# Per-step AI-supported time (from estimates.md, converted to days)
AI_SUPPORTED_DAYS: dict[str, tuple[float, float]] = {
    "1": (0.25, 0.5),   # 2-4 hours
    "2": (0.25, 0.5),   # 2-4 hours
    "3": (0.5, 0.75),   # 4-6 hours
    "4": (1, 2),         # 1-2 business days
    "5": (1, 2),         # 1-2 business days
    "6": (0.25, 0.5),   # 2-4 hours
    "7": (0.125, 0.25), # 1-2 hours
    "8": (0.25, 0.5),   # 2-4 hours
    "9": (0.25, 0.5),   # 2-4 hours
    "10": (1, 2),        # 1-2 business days
}

STEP_NAMES: dict[str, str] = {
    "1": "Briefing",
    "2": "Segmentation",
    "3": "SKU Selection",
    "4": "Creative Production",
    "5": "Layout Assembly",
    "6": "Final Approval",
    "7": "Localization",
    "8": "Activation",
    "9": "Monitoring",
    "10": "Reporting",
}

HOURS_PER_DAY = 6  # productive hours per business day
# Reasoned estimate: 65-100 distinct campaigns per year. See the
# breakdown on /impact and in estimates.md for how this range is derived.
ANNUAL_CAMPAIGN_VOLUME_LOW = 65
ANNUAL_CAMPAIGN_VOLUME_HIGH = 100
ANNUAL_CAMPAIGN_VOLUME = 82  # midpoint for single-number projections


def _midpoint(r: tuple[float, float]) -> float:
    return (r[0] + r[1]) / 2


def _per_step_impact(step: str, completed: bool) -> dict:
    baseline = BASELINE_DAYS.get(step, (1, 1))
    ai = AI_SUPPORTED_DAYS.get(step, (0.5, 0.5))
    baseline_mid = _midpoint(baseline)
    ai_mid = _midpoint(ai)
    days_saved = max(0, baseline_mid - ai_mid)
    hours_saved = round(days_saved * HOURS_PER_DAY, 1)
    dollars_saved = round(hours_saved * HOURLY_RATE)
    return {
        "step": step,
        "step_name": STEP_NAMES.get(step, f"Step {step}"),
        "completed": completed,
        "baseline_days": {"low": baseline[0], "high": baseline[1], "mid": baseline_mid},
        "ai_supported_days": {"low": ai[0], "high": ai[1], "mid": ai_mid},
        "days_saved": round(days_saved, 2),
        "hours_saved": hours_saved,
        "dollars_saved": dollars_saved,
    }


def _campaign_impact(campaign_id: str) -> dict:
    """Compute impact metrics for a single campaign."""
    s = st._STATE.get(campaign_id)
    if s is None:
        return {"error": f"Campaign {campaign_id} not found"}

    brief = st._BRIEFS.get(campaign_id, {})
    completed_steps = set(str(x) for x in s.get("completed_steps", []))
    step_outputs = s.get("step_outputs", {})
    audit_log = s.get("audit_log", [])
    evidence = s.get("evidence", {})

    # Per-step breakdown
    steps = []
    total_hours_saved = 0
    total_dollars_saved = 0
    for i in range(1, 11):
        sid = str(i)
        completed = sid in completed_steps
        row = _per_step_impact(sid, completed)
        if completed:
            total_hours_saved += row["hours_saved"]
            total_dollars_saved += row["dollars_saved"]
        steps.append(row)

    # Quality measures
    compliance_findings = 0
    compliance_failures = 0
    if "6" in step_outputs and isinstance(step_outputs["6"], dict):
        cc = step_outputs["6"].get("compliance_check", {})
        if isinstance(cc, dict):
            for finding in ["brand_alignment", "disclaimers", "pricing_cross_check"]:
                f = cc.get(finding, {})
                if isinstance(f, dict):
                    compliance_findings += 1
                    if f.get("status") == "fail":
                        compliance_failures += 1

    revision_count = sum(1 for e in audit_log if "reject" in str(e.get("action", "")).lower() or "rerun" in str(e.get("action", "")).lower())
    evidence_coverage = sum(1 for k in evidence if not k.endswith("_output")) if evidence else 0
    mcp_invocations = sum(1 for e in audit_log if "mcp" in str(e).lower() or "tool" in str(e).lower())

    # Also count MCP tools from step_outputs metadata
    for sid, out in step_outputs.items():
        if isinstance(out, dict):
            if out.get("pricing_check"):
                mcp_invocations += 1
            if out.get("mcp_find_dam_assets"):
                mcp_invocations += 1
            if out.get("mcp_generate_locale_variants"):
                mcp_invocations += len(out["mcp_generate_locale_variants"])

    baseline_total_days = sum(_midpoint(BASELINE_DAYS[str(i)]) for i in range(1, 11))
    ai_total_days = sum(_midpoint(AI_SUPPORTED_DAYS[str(i)]) for i in range(1, 11))

    return {
        "campaign_id": campaign_id,
        "campaign_name": brief.get("name", campaign_id),
        "current_step": s.get("current_step", 1),
        "is_complete": s.get("current_step", 1) > 10,
        "completed_step_count": len(completed_steps),
        "hero": {
            "hours_saved": round(total_hours_saved, 1),
            "dollars_saved": total_dollars_saved,
            "baseline_days": round(baseline_total_days, 1),
            "ai_supported_days": round(ai_total_days, 1),
            "days_saved": round(baseline_total_days - ai_total_days, 1),
            "pct_reduction": round((1 - ai_total_days / baseline_total_days) * 100) if baseline_total_days > 0 else 0,
        },
        "steps": steps,
        "quality": {
            "compliance_findings": compliance_findings,
            "compliance_failures": compliance_failures,
            "revision_rounds": revision_count,
            "evidence_coverage_steps": evidence_coverage,
            "evidence_coverage_pct": round(evidence_coverage / 10 * 100) if evidence_coverage else 0,
            "mcp_invocations": mcp_invocations,
        },
    }


@router.get("/campaigns/{campaign_id}/impact")
def get_campaign_impact(campaign_id: str) -> dict:
    return _campaign_impact(campaign_id)


@router.get("/impact/portfolio")
def get_portfolio_impact() -> dict:
    """Aggregate impact across all campaigns."""
    campaign_ids = list(st._STATE.keys())
    campaigns = []
    total_hours = 0
    total_dollars = 0

    for cid in campaign_ids:
        impact = _campaign_impact(cid)
        if "error" in impact:
            continue
        campaigns.append(impact)
        total_hours += impact["hero"]["hours_saved"]
        total_dollars += impact["hero"]["dollars_saved"]

    # Extrapolation
    avg_savings_per_campaign = total_dollars / len(campaigns) if campaigns else 0
    projected_annual = round(avg_savings_per_campaign * ANNUAL_CAMPAIGN_VOLUME)

    total_compliance = sum(c["quality"]["compliance_findings"] for c in campaigns)
    total_failures = sum(c["quality"]["compliance_failures"] for c in campaigns)
    total_revisions = sum(c["quality"]["revision_rounds"] for c in campaigns)
    total_mcp = sum(c["quality"]["mcp_invocations"] for c in campaigns)

    return {
        "campaigns": campaigns,
        "campaign_count": len(campaigns),
        "aggregate": {
            "total_hours_saved": round(total_hours, 1),
            "total_dollars_saved": round(total_dollars),
            "avg_dollars_per_campaign": round(avg_savings_per_campaign),
            "projected_annual_savings": projected_annual,
            "annual_campaign_volume": ANNUAL_CAMPAIGN_VOLUME,
            "annual_campaign_volume_low": ANNUAL_CAMPAIGN_VOLUME_LOW,
            "annual_campaign_volume_high": ANNUAL_CAMPAIGN_VOLUME_HIGH,
            "projected_annual_low": round(avg_savings_per_campaign * ANNUAL_CAMPAIGN_VOLUME_LOW),
            "projected_annual_high": round(avg_savings_per_campaign * ANNUAL_CAMPAIGN_VOLUME_HIGH),
            "hourly_rate": HOURLY_RATE,
        },
        "quality_aggregate": {
            "total_compliance_findings": total_compliance,
            "total_compliance_failures": total_failures,
            "total_revision_rounds": total_revisions,
            "total_mcp_invocations": total_mcp,
        },
    }
