"""Backend endpoints for the sidebar pages: dashboard, segments, analytics."""

from __future__ import annotations

from fastapi import APIRouter

from api import state as st
from api.routes.impact import _campaign_impact, HOURLY_RATE, ANNUAL_CAMPAIGN_VOLUME

router = APIRouter(tags=["sidebar"])

STEP_NAMES = st.STEP_NAMES


@router.get("/dashboard/overview")
def dashboard_overview() -> dict:
    """Operational overview: stat cards, active campaigns, recent activity."""
    campaign_ids = list(st._STATE.keys())

    # Stat cards
    active_count = 0
    completed_count = 0
    planned_count = 0
    total_hours_saved = 0.0

    campaigns_summary = []
    all_audit_entries: list[dict] = []
    escalations: list[dict] = []

    for cid in campaign_ids:
        s = st._STATE.get(cid, {})
        brief = st._BRIEFS.get(cid, {})
        step = s.get("current_step", 1)
        completed_steps = s.get("completed_steps", [])
        is_complete = step > 10

        if is_complete:
            completed_count += 1
            status = "completed"
        elif len(completed_steps) > 0:
            active_count += 1
            status = "active"
        else:
            planned_count += 1
            status = "planned"

        # Hours saved
        impact = _campaign_impact(cid)
        if "hero" in impact:
            total_hours_saved += impact["hero"]["hours_saved"]

        campaigns_summary.append({
            "campaign_id": cid,
            "name": brief.get("name", cid),
            "status": status,
            "current_step": step,
            "current_step_name": STEP_NAMES.get(step, ""),
            "completed_step_count": len(completed_steps),
            "hours_saved": impact.get("hero", {}).get("hours_saved", 0),
        })

        # Audit log entries (tag with campaign name)
        for entry in s.get("audit_log", []):
            all_audit_entries.append({
                **entry,
                "campaign_id": cid,
                "campaign_name": brief.get("name", cid),
            })

        # Escalations
        for esc in s.get("escalations", []):
            escalations.append({
                **esc,
                "campaign_id": cid,
                "campaign_name": brief.get("name", cid),
            })

    # Sort audit entries by timestamp (newest first), take last 10
    all_audit_entries.sort(key=lambda e: e.get("ts", e.get("timestamp", "")), reverse=True)
    recent_activity = all_audit_entries[:10]

    return {
        "stats": {
            "active_campaigns": active_count,
            "completed_campaigns": completed_count,
            "planned_campaigns": planned_count,
            "total_campaigns": len(campaign_ids),
            "pending_escalations": len(escalations),
            "recent_actions": len(all_audit_entries),
            "hours_saved_total": round(total_hours_saved, 1),
            "dollars_saved_total": round(total_hours_saved * HOURLY_RATE),
        },
        "campaigns": campaigns_summary,
        "recent_activity": recent_activity,
        "escalations": escalations,
    }


@router.get("/segments/overview")
def segments_overview() -> dict:
    """Return cached segment data from the demo campaign, or run fresh."""
    # Check if any campaign has segment data in step_outputs["2"]
    segments_found = []
    campaigns_using: dict[str, list[str]] = {}

    for cid in st._STATE:
        s = st._STATE[cid]
        brief = st._BRIEFS.get(cid, {})
        seg = s.get("step_outputs", {}).get("2", {})
        if isinstance(seg, dict) and seg.get("name"):
            seg_name = seg["name"]
            if seg_name not in campaigns_using:
                campaigns_using[seg_name] = []
            campaigns_using[seg_name].append(brief.get("name", cid))

    # Run fresh segmentation to get all 3 segments
    try:
        from api._skill_loader import SEGMENT
        all_segments = SEGMENT.build_segments("Campaign overview")
        total = sum(s["customer_count"] for s in all_segments)

        result = []
        for seg in all_segments:
            result.append({
                "name": seg["name"],
                "customer_count": seg["customer_count"],
                "pct_of_total": round(seg["customer_count"] / total * 100, 1) if total > 0 else 0,
                "top_category": seg.get("top_category"),
                "top_category_lift": seg.get("top_category_lift", 0),
                "avg_recency_days": seg.get("avg_recency_days", 0),
                "avg_frequency": seg.get("avg_frequency", 0),
                "avg_monetary": seg.get("avg_monetary", 0),
                "definition": seg.get("definition", ""),
                "loyalty_mix": seg.get("loyalty_mix", {}),
                "used_by_campaigns": campaigns_using.get(seg["name"], []),
            })

        return {
            "segments": result,
            "total_customers": total,
            "methodology": "K-means clustering (k=3) on RFM features (Recency, Frequency, Monetary) across 50,000 customers from macys.db.",
        }
    except Exception as exc:
        return {"segments": [], "total_customers": 0, "methodology": "", "error": str(exc)}


@router.get("/analytics/overview")
def analytics_overview() -> dict:
    """Cross-campaign trend metrics."""
    campaign_ids = list(st._STATE.keys())

    campaigns_data = []
    total_compliance_findings = 0
    total_compliance_failures = 0
    total_revisions = 0
    total_mcp = 0
    mcp_by_tool: dict[str, int] = {
        "check_pricing_conflicts": 0,
        "find_dam_assets": 0,
        "generate_locale_variants": 0,
    }

    for cid in campaign_ids:
        impact = _campaign_impact(cid)
        if "error" in impact:
            continue

        campaigns_data.append({
            "campaign_id": cid,
            "campaign_name": impact["campaign_name"],
            "hours_saved": impact["hero"]["hours_saved"],
            "dollars_saved": impact["hero"]["dollars_saved"],
            "days_saved": impact["hero"]["days_saved"],
            "pct_reduction": impact["hero"]["pct_reduction"],
            "completed_steps": impact["completed_step_count"],
            "compliance_findings": impact["quality"]["compliance_findings"],
            "revision_rounds": impact["quality"]["revision_rounds"],
            "evidence_coverage_pct": impact["quality"]["evidence_coverage_pct"],
        })

        total_compliance_findings += impact["quality"]["compliance_findings"]
        total_compliance_failures += impact["quality"]["compliance_failures"]
        total_revisions += impact["quality"]["revision_rounds"]
        total_mcp += impact["quality"]["mcp_invocations"]

        # Count MCP by tool from step_outputs
        s = st._STATE.get(cid, {})
        outputs = s.get("step_outputs", {})
        if isinstance(outputs.get("3"), dict) and outputs["3"].get("pricing_check"):
            mcp_by_tool["check_pricing_conflicts"] += 1
        if isinstance(outputs.get("4"), dict) and outputs["4"].get("mcp_find_dam_assets"):
            mcp_by_tool["find_dam_assets"] += 1
        if isinstance(outputs.get("7"), dict) and outputs["7"].get("mcp_generate_locale_variants"):
            mcp_by_tool["generate_locale_variants"] += len(outputs["7"]["mcp_generate_locale_variants"])

    # Sort by hours saved for "top performing"
    campaigns_data.sort(key=lambda c: c["hours_saved"], reverse=True)

    return {
        "campaigns": campaigns_data,
        "campaign_count": len(campaigns_data),
        "totals": {
            "hours_saved": round(sum(c["hours_saved"] for c in campaigns_data), 1),
            "dollars_saved": sum(c["dollars_saved"] for c in campaigns_data),
            "compliance_findings": total_compliance_findings,
            "compliance_failures": total_compliance_failures,
            "revision_rounds": total_revisions,
            "mcp_invocations": total_mcp,
        },
        "mcp_by_tool": mcp_by_tool,
        "projected_annual": round(
            (sum(c["dollars_saved"] for c in campaigns_data) / max(len(campaigns_data), 1))
            * ANNUAL_CAMPAIGN_VOLUME
        ),
    }
