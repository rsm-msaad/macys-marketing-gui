"""Impact metrics endpoints — computes per-campaign and portfolio savings.

Uses a two-axis model that separates elapsed calendar days (for cycle-time
reduction %) from actual labor hours (for dollar savings). Elapsed days
include waiting, handoffs, and coordination; labor hours count only
hands-on work. The old model multiplied elapsed days by 6h/day, which
overstated savings by treating wait time as paid labor.

All constants match estimates.md. Both files must be updated together.
"""

from __future__ import annotations

from fastapi import APIRouter

from api import state as st

router = APIRouter(tags=["impact"])

# ---- Constants from estimates.md ----
HOURLY_RATE = 75  # $75/hr fully loaded (class-context estimate)

# Elapsed calendar days per step (baseline manual process).
# These measure how long the calendar is blocked, NOT labor hours.
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

# Elapsed calendar days per step (AI-supported process).
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

# Actual hands-on labor hours per step (NOT elapsed days * 6).
# Elapsed days include waiting, handoffs, coordination overhead.
# Labor hours count only the time someone is actively working.
BASELINE_LABOR_HOURS: dict[str, float] = {
    "1": 12,    # Briefing: ~3h/day over 4 days (email/Slack cycles, not continuous work)
    "2": 8,     # Segmentation: CSV pulls, offline analysis
    "3": 12,    # SKU Selection: spreadsheet cross-referencing
    "4": 24,    # Creative Production: active design + DAM hunting
    "5": 24,    # Layout Assembly: production from blank pages
    "6": 20,    # Final Approval: compliance review, brief drafting, revision rounds
    "7": 18,    # Localization: manual variant production (40-50 files)
    "8": 6,     # Activation: schedule building, channel coordination
    "9": 6,     # Monitoring: dashboard pulls, report assembly
    "10": 24,   # Reporting: manual decision-trail reconstruction
}
# Total: 154 labor hours per campaign (baseline)

AI_LABOR_HOURS: dict[str, float] = {
    "1": 2,     # Briefing: structured /start form, one session
    "2": 2,     # Segmentation: review 3 segments, select one
    "3": 4,     # SKU Selection: review ranked list, toggle, lock in
    "4": 6,     # Creative Production: review shortlist, select assets
    "5": 6,     # Layout Assembly: review AI-drafted copy, refine
    "6": 3,     # Final Approval: review compliance + brief, 5-action decision
    "7": 1,     # Localization: spot-check 4-6 of 40+ auto-generated variants
    "8": 2,     # Activation: review computed schedule, confirm
    "9": 2,     # Monitoring: review pre-computed KPIs, add interpretation
    "10": 6,    # Reporting: review AI-drafted summary, edit, send
}
# Total: 34 labor hours per campaign (AI-supported)

# End-to-end elapsed time for the full campaign (NOT the sum of per-step
# days, which overstates because it assumes strict sequential execution).
# Some steps overlap or run in parallel. These ranges come from
# estimates.md and M1 Process Documentation.
CAMPAIGN_ELAPSED_BASELINE = (30, 40)   # 6 to 8 weeks
CAMPAIGN_ELAPSED_AI = (6, 10)          # 1 to 2 weeks

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

ANNUAL_CAMPAIGN_VOLUME_LOW = 65
ANNUAL_CAMPAIGN_VOLUME_HIGH = 100
ANNUAL_CAMPAIGN_VOLUME = 82  # midpoint

# Per-campaign savings midpoint for annual projection.
# 120h saved * $75/hr = $9,000. Used as the anchor for the annual range.
SAVINGS_PER_CAMPAIGN_MID = round(
    sum(BASELINE_LABOR_HOURS.values()) - sum(AI_LABOR_HOURS.values())
) * HOURLY_RATE


def _midpoint(r: tuple[float, float]) -> float:
    return (r[0] + r[1]) / 2


def _per_step_impact(step: str, completed: bool) -> dict:
    baseline_days = BASELINE_DAYS.get(step, (1, 1))
    ai_days = AI_SUPPORTED_DAYS.get(step, (0.5, 0.5))
    baseline_labor = BASELINE_LABOR_HOURS.get(step, 6)
    ai_labor = AI_LABOR_HOURS.get(step, 2)
    labor_saved = max(0, baseline_labor - ai_labor)
    dollars_saved = round(labor_saved * HOURLY_RATE)
    return {
        "step": step,
        "step_name": STEP_NAMES.get(step, f"Step {step}"),
        "completed": completed,
        "baseline_days": {
            "low": baseline_days[0],
            "high": baseline_days[1],
            "mid": _midpoint(baseline_days),
        },
        "ai_supported_days": {
            "low": ai_days[0],
            "high": ai_days[1],
            "mid": _midpoint(ai_days),
        },
        "baseline_labor_hours": baseline_labor,
        "ai_labor_hours": ai_labor,
        "labor_hours_saved": labor_saved,
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
    total_labor_saved = 0.0
    total_dollars_saved = 0
    for i in range(1, 11):
        sid = str(i)
        completed = sid in completed_steps
        row = _per_step_impact(sid, completed)
        if completed:
            total_labor_saved += row["labor_hours_saved"]
            total_dollars_saved += row["dollars_saved"]
        steps.append(row)

    # Cycle-time reduction: based on realistic end-to-end elapsed time,
    # NOT the sequential sum of per-step days. Scales by fraction of
    # steps completed so a 0/10 campaign shows 0%.
    n_completed = len(completed_steps)
    baseline_elapsed_mid = _midpoint(CAMPAIGN_ELAPSED_BASELINE)  # 35 days
    ai_elapsed_mid = _midpoint(CAMPAIGN_ELAPSED_AI)              # 8 days
    full_pct_reduction = round((1 - ai_elapsed_mid / baseline_elapsed_mid) * 100)
    # Scale: 10/10 steps = full %, 5/10 = half, 0/10 = 0%
    pct_reduction = round(full_pct_reduction * n_completed / 10)

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

    revision_count = sum(
        1
        for e in audit_log
        if "reject" in str(e.get("action", "")).lower()
        or "rerun" in str(e.get("action", "")).lower()
    )
    evidence_coverage = (
        sum(1 for k in evidence if not k.endswith("_output")) if evidence else 0
    )
    mcp_invocations = sum(
        1 for e in audit_log if "mcp" in str(e).lower() or "tool" in str(e).lower()
    )
    for sid, out in step_outputs.items():
        if isinstance(out, dict):
            if out.get("pricing_check"):
                mcp_invocations += 1
            if out.get("mcp_find_dam_assets"):
                mcp_invocations += 1
            if out.get("mcp_generate_locale_variants"):
                mcp_invocations += len(out["mcp_generate_locale_variants"])

    return {
        "campaign_id": campaign_id,
        "campaign_name": brief.get("name", campaign_id),
        "current_step": s.get("current_step", 1),
        "is_complete": s.get("current_step", 1) > 10,
        "completed_step_count": n_completed,
        "hero": {
            "labor_hours_saved": round(total_labor_saved, 1),
            "dollars_saved": total_dollars_saved,
            "dollars_saved_range": {
                "low": round(total_dollars_saved * 0.8),
                "high": round(total_dollars_saved * 1.2),
            },
            "baseline_elapsed_days": round(baseline_elapsed_mid, 1),
            "ai_elapsed_days": round(ai_elapsed_mid, 1),
            "pct_reduction": pct_reduction,
            "full_campaign_pct_reduction": full_pct_reduction,
        },
        "labor_totals": {
            "baseline_hours": round(sum(BASELINE_LABOR_HOURS.values())),
            "ai_hours": round(sum(AI_LABOR_HOURS.values())),
        },
        "steps": steps,
        "quality": {
            "compliance_findings": compliance_findings,
            "compliance_failures": compliance_failures,
            "revision_rounds": revision_count,
            "evidence_coverage_steps": evidence_coverage,
            "evidence_coverage_pct": (
                round(evidence_coverage / 10 * 100) if evidence_coverage else 0
            ),
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
    total_hours = 0.0
    total_dollars = 0

    for cid in campaign_ids:
        impact = _campaign_impact(cid)
        if "error" in impact:
            continue
        campaigns.append(impact)
        total_hours += impact["hero"]["labor_hours_saved"]
        total_dollars += impact["hero"]["dollars_saved"]

    # Annual projection uses the fixed per-completed-campaign midpoint
    # ($9,000 = 120h * $75), not the demo average which is dragged down
    # by campaigns with 0 completed steps.
    return {
        "campaigns": campaigns,
        "campaign_count": len(campaigns),
        "aggregate": {
            "total_labor_hours_saved": round(total_hours, 1),
            "total_dollars_saved": round(total_dollars),
            "savings_per_completed_campaign": SAVINGS_PER_CAMPAIGN_MID,
            "projected_annual_low": SAVINGS_PER_CAMPAIGN_MID * ANNUAL_CAMPAIGN_VOLUME_LOW,
            "projected_annual_high": SAVINGS_PER_CAMPAIGN_MID * ANNUAL_CAMPAIGN_VOLUME_HIGH,
            "annual_campaign_volume_low": ANNUAL_CAMPAIGN_VOLUME_LOW,
            "annual_campaign_volume_high": ANNUAL_CAMPAIGN_VOLUME_HIGH,
            "hourly_rate": HOURLY_RATE,
        },
        "per_step_labor": [
            {
                "step": s,
                "step_name": STEP_NAMES[s],
                "baseline_hours": BASELINE_LABOR_HOURS[s],
                "ai_hours": AI_LABOR_HOURS[s],
            }
            for s in sorted(STEP_NAMES, key=lambda x: int(x))
        ],
        "costs_not_netted": {
            "ai_api_cost_per_campaign": "$0.50 to $2.00",
            "ai_api_note": "5 LLM skills via TritonAI/Claude; 7 automations at negligible compute cost",
            "pattern4_rework_per_campaign": "estimated 1-2h (~$75-$150) on ~30% of campaigns (estimated from limited testing, 2 runs, not a measured production rate)",
            "pattern4_note": "Agentic compliance skill over-flags clean copy (Pattern 4 in test_report.md)",
        },
        "quality_aggregate": {
            "total_compliance_findings": sum(
                c["quality"]["compliance_findings"] for c in campaigns
            ),
            "total_compliance_failures": sum(
                c["quality"]["compliance_failures"] for c in campaigns
            ),
            "total_revision_rounds": sum(
                c["quality"]["revision_rounds"] for c in campaigns
            ),
            "total_mcp_invocations": sum(
                c["quality"]["mcp_invocations"] for c in campaigns
            ),
        },
    }
