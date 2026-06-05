"""HTTP entry points for the Macy's automation skills."""

from __future__ import annotations

import importlib.util
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api._skill_loader import ANALYZE, DAM, LOCALIZE, SEGMENT, SKU_RECOMMEND

REPO_ROOT = Path(__file__).resolve().parents[2]

router = APIRouter(prefix="/skills", tags=["skills"])


class SegmentBody(BaseModel):
    brief: str = Field(default="Mother's Day Beauty Event")
    n_clusters: int = Field(default=3, ge=2, le=8)


class DamBody(BaseModel):
    brief: str = Field(default="Mother's Day Beauty Event")
    max_results: int = Field(default=12, ge=1, le=50)
    category: str | None = Field(default=None)


class LocalizeBody(BaseModel):
    brief: str = Field(default="Mother's Day Beauty Event")
    sku_ids: list[int] = Field(default_factory=lambda: [4, 18])


class AnalyzeBody(BaseModel):
    campaign_id: int = Field(default=7)
    forecast_days: int = Field(default=14, ge=1, le=90)


@router.post("/segment")
def run_segment(body: SegmentBody) -> dict:
    try:
        segments = SEGMENT.build_segments(body.brief, n_clusters=body.n_clusters)

        # Try LLM naming skill with a tight timeout (12s) so a slow LLM
        # or quota error never hangs the demo. Falls back to deterministic
        # naming on any failure.
        import concurrent.futures

        SKILL_TIMEOUT_S = 12
        skill_result = None
        try:
            import sys
            ai_root = str(Path(__file__).resolve().parent.parent / "ai_engine")
            if ai_root not in sys.path:
                sys.path.insert(0, ai_root)
            from orchestrator.skill_invoker import invoke_skill

            state = {
                "campaign_id": "segment-naming",
                "status": "segment_complete",
                "campaign": {"brief": body.brief, "category": ""},
                "segments": segments,
            }

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(invoke_skill, "segment-namer", state)
                result = future.result(timeout=SKILL_TIMEOUT_S)
            skill_result = result.get("segment_naming")
        except concurrent.futures.TimeoutError:
            pass  # LLM too slow, use deterministic fallback
        except Exception:
            pass  # Skill unavailable (quota, network, etc.), use fallback

        # Apply skill names or fallback
        if skill_result and "segments" in skill_result:
            name_map = {s["original_name"]: s for s in skill_result["segments"]}
            for seg in segments:
                if seg["name"] in name_map:
                    seg["display_name"] = name_map[seg["name"]].get("display_name", seg["name"])
                    seg["descriptor"] = name_map[seg["name"]].get("descriptor", "")
                else:
                    seg["display_name"] = seg["name"]
                    seg["descriptor"] = ""
            recommended = skill_result.get("recommended_segment")
            recommendation_reason = skill_result.get("recommendation_reason", "")
            brief_suggestion = skill_result.get("brief_suggestion")
        else:
            # Deterministic fallback
            hp = Path(__file__).resolve().parent.parent / "ai_engine" / "skills" / "segment-namer" / "helpers.py"
            spec = importlib.util.spec_from_file_location("seg_namer_helpers", hp)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            fb_names = mod.fallback_names(segments)
            for seg, fb in zip(segments, fb_names):
                seg["display_name"] = fb["display_name"]
                seg["descriptor"] = fb["descriptor"]

            fb_rec = mod.fallback_recommendation(segments, body.brief)
            recommended = fb_rec["recommended_segment"]
            recommendation_reason = fb_rec["recommendation_reason"]
            brief_suggestion = fb_rec["brief_suggestion"]

        return {
            "ok": True,
            "brief": body.brief,
            "n_clusters": body.n_clusters,
            "segments": segments,
            "total_clustered": sum(s["customer_count"] for s in segments),
            "recommended_segment": recommended,
            "recommendation_reason": recommendation_reason,
            "brief_suggestion": brief_suggestion,
            "naming_source": "skill" if skill_result else "fallback",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dam-search")
def run_dam(body: DamBody) -> dict:
    try:
        results, stats = DAM.search_with_stats(body.brief, max_results=body.max_results, category=body.category)
        return {
            "ok": True,
            "brief": body.brief,
            "max_results": body.max_results,
            "results": results,
            "stats": stats,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))




# MCP tool: find_dam_assets — queries DAM by category and region
class FindDamAssetsBody(BaseModel):
    category: str = Field(default="Beauty")
    region: str = Field(default="NY")
    max_results: int = Field(default=5, ge=1, le=20)


@router.post("/find-dam-assets")
def run_find_dam_assets(body: FindDamAssetsBody) -> dict:
    """MCP tool firing: find_dam_assets at Step 4 (Creative Production).

    Queries the DAM database by category and region, filtering out assets
    with expired model releases. Returns assets with active rights.
    """
    from ai_engine.tools.find_dam_assets import find_dam_assets
    result = find_dam_assets(body.category, body.region, max_results=body.max_results)
    return {
        "ok": True,
        "mcp_tool": "find_dam_assets",
        **result,
        "input": {"category": body.category, "region": body.region, "max_results": body.max_results},
    }


@router.post("/localize")
def run_localize(body: LocalizeBody) -> dict:
    try:
        variants, stats = LOCALIZE.generate_variants_with_stats(body.brief, body.sku_ids)
        return {
            "ok": True,
            "brief": body.brief,
            "sku_ids": body.sku_ids,
            "variants": variants,
            "stats": stats,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class GenerateReportBody(BaseModel):
    campaign_id: str = Field(default="MDC-2026-MD-001")
    campaign_name: str = Field(default="Mother's Day Beauty Event")
    step_outputs: dict = Field(default_factory=dict)
    audit_log: list = Field(default_factory=list)
    category: str = Field(default="Beauty")
    segment_name: str | None = Field(default=None)


@router.post("/generate-report")
def run_generate_report(body: GenerateReportBody) -> dict:
    """Generate executive report via Claude from the full audit trail."""
    import time as _time
    started = _time.monotonic()

    # Try Claude via skill_invoker
    try:
        from ai_engine.orchestrator.skill_invoker import invoke_skill
        state = {
            "campaign": {
                "campaign_id": body.campaign_id,
                "title": body.campaign_name,
                "category": body.category,
                "audience_segment": body.segment_name or "General",
                "copy": "",
                "skus": [],
                "discount_pct": 25,
            },
            "step_outputs": body.step_outputs,
            "audit_log": body.audit_log,
            "status": "submitted",
        }
        updated = invoke_skill("report-generator", state)
        result = updated.get("executive_report", {})
        elapsed = round((_time.monotonic() - started) * 1000, 1)
        return {
            "ok": True,
            "report": result,
            "generation_metadata": {
                "skill": "report-generator",
                "method": "claude_via_skill_invoker",
                "duration_ms": elapsed,
            },
        }
    except Exception as exc:
        # Fallback: return a stub report
        elapsed = round((_time.monotonic() - started) * 1000, 1)
        return {
            "ok": True,
            "report": {
                "executive_summary": (
                    f"# {body.campaign_name} — Executive Report\n\n"
                    f"This report was generated from {len(body.step_outputs)} step outputs. "
                    f"Claude was unavailable; this is a placeholder summary.\n\n"
                    f"Category: {body.category}. Segment: {body.segment_name or 'N/A'}."
                ),
                "key_metrics": {},
                "recommendations": ["Run with TritonAI API key for a full AI-generated report."],
                "risks_and_concerns": [f"Fallback mode: {str(exc)[:100]}"],
                "retrieved_docs": [],
            },
            "generation_metadata": {
                "skill": "report-generator",
                "method": "deterministic_fallback",
                "duration_ms": elapsed,
            },
        }


@router.post("/analyze")
def run_analyze(body: AnalyzeBody) -> dict:
    try:
        analysis = ANALYZE.analyze_campaign(body.campaign_id, forecast_days=body.forecast_days)
        return {"ok": True, "analysis": analysis}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Activation Scheduler (deterministic automation, no LLM)
_ACTIVATION_HELPERS = None


def _get_activation_helpers():
    global _ACTIVATION_HELPERS
    if _ACTIVATION_HELPERS is None:
        helpers_path = REPO_ROOT / "ai_engine" / "automations" / "activation-scheduler" / "helpers.py"
        spec = importlib.util.spec_from_file_location("activation_helpers", helpers_path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _ACTIVATION_HELPERS = mod
    return _ACTIVATION_HELPERS


class ActivateBody(BaseModel):
    regions: list[str] = Field(default_factory=lambda: ["NY", "CA", "FL", "TX"])
    estimated_spend: int = Field(default=200_000)
    launch_date: str = Field(default="2026-06-01")


@router.post("/activate")
def run_activate(body: ActivateBody) -> dict:
    try:
        helpers = _get_activation_helpers()
        started = time.monotonic()
        per_region = []
        for region in body.regions:
            tz = helpers.region_to_timezone(region)
            per_region.append(
                {
                    "region": region,
                    "timezone": tz,
                    "email_send_utc": helpers.compute_send_time(tz, body.launch_date),
                    "paid_social_window_local": helpers.peak_social_window(tz),
                    "display_frequency_cap": helpers.display_cap(body.estimated_spend, region),
                    "signage_window_local": helpers.signage_window(tz),
                }
            )
        elapsed = round((time.monotonic() - started) * 1000, 1)
        schedule = helpers.assemble_schedule(per_region, [])
        return {
            "ok": True,
            "schedule": schedule,
            "generation_metadata": {
                "skill": "activation-scheduler",
                "method": "deterministic",
                "duration_ms": elapsed,
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class SkuRecommendBody(BaseModel):
    category: str = Field(default="Beauty")
    discount_pct: float = Field(default=25)
    campaign_period: str = Field(default="Q2 2026")
    season: str = Field(default="")
    max_results: int = Field(default=18, ge=1, le=50)
    segment_top_category: str | None = Field(default=None)


@router.post("/sku-recommend")
def run_sku_recommend(body: SkuRecommendBody) -> dict:
    try:
        result = SKU_RECOMMEND.recommend_skus(
            brief={
                "category": body.category,
                "discount_pct": body.discount_pct,
                "campaign_period": body.campaign_period,
                "season": body.season,
                "segment_top_category": body.segment_top_category,
            },
            max_results=body.max_results,
        )
        return {"ok": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# MCP tool: check_pricing_conflicts — validates SKUs against MAP rules
# Now reads from macys.db sku_catalog (same source as SKU Recommender).
# Use the lazy-loaded SKU_RECOMMEND module for MAP brand checking.


class CheckPricingBody(BaseModel):
    sku_ids: list[str] = Field(default_factory=list)
    proposed_discount_pct: float = Field(default=25)


@router.post("/check-pricing")
def run_check_pricing(body: CheckPricingBody) -> dict:
    """MCP tool firing: check_pricing_conflicts at Step 3 (SKU lock-in).

    Validates selected SKUs against MAP-enforced brand list from
    PRICE-RULES-2026-001 and checks for discount floor violations.
    Reads from macys.db sku_catalog so SKU IDs match the recommender.
    """
    import sqlite3

    db_path = REPO_ROOT / "data" / "macys.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    conflicts: list[dict] = []
    try:
        for sku_id in body.sku_ids:
            row = conn.execute(
                "SELECT sku_id, product_name, brand FROM sku_catalog WHERE sku_id = ?",
                (sku_id,),
            ).fetchone()
            if row is None:
                conflicts.append({"sku_id": sku_id, "issue": "SKU not found in catalog.", "severity": "fail"})
                continue
            brand = str(row["brand"])
            if SKU_RECOMMEND._is_map_brand(brand):
                if (body.proposed_discount_pct / 100.0) > SKU_RECOMMEND.DEFAULT_MAP_FLOOR_PCT:
                    conflicts.append({
                        "sku_id": sku_id,
                        "brand": brand,
                        "issue": (
                            f"Brand {brand} is MAP-enforced per PRICE-RULES-2026-001. "
                            f"Proposed {body.proposed_discount_pct:.0f}% discount exceeds "
                            f"MAP floor of {SKU_RECOMMEND.DEFAULT_MAP_FLOOR_PCT * 100:.0f}%."
                        ),
                        "severity": "fail",
                    })
    finally:
        conn.close()

    if any(c["severity"] == "fail" for c in conflicts):
        status = "fail"
    elif conflicts:
        status = "warn"
    else:
        status = "pass"

    return {
        "ok": True,
        "mcp_tool": "check_pricing_conflicts",
        "status": status,
        "conflicts": conflicts,
        "checked_count": len(body.sku_ids),
        "input": {"sku_ids": body.sku_ids, "proposed_discount_pct": body.proposed_discount_pct},
    }


# MCP tool: generate_locale_variants — simulated transcreation
class GenerateLocaleBody(BaseModel):
    source_copy: str = Field(default="Discover the magic of Macy's this season")
    target_language: str = Field(default="es")
    regional_pricing: dict | None = Field(default=None)


@router.post("/generate-locale-variants")
def run_generate_locale(body: GenerateLocaleBody) -> dict:
    """MCP tool firing: generate_locale_variants at Step 7 (Localization).

    Simulated transcreation to Spanish (es) or Quebec French (fr-CA)
    with optional regional pricing overlay.
    """
    from ai_engine.tools.generate_locale_variants import generate_locale_variants
    result = generate_locale_variants(body.source_copy, body.target_language, body.regional_pricing)
    return {
        "ok": True,
        "mcp_tool": "generate_locale_variants",
        **result,
        "input": {"copy": body.source_copy, "target_language": body.target_language},
    }


# Layout Copy Generator (LLM skill with deterministic fallback)
_LAYOUT_HELPERS = None


def _get_layout_helpers():
    global _LAYOUT_HELPERS
    if _LAYOUT_HELPERS is None:
        skill_path = (
            Path(__file__).resolve().parents[2] / "ai_engine" / "skills" / "layout-copy-generator" / "helpers.py"
        )
        spec = importlib.util.spec_from_file_location("layout_helpers", skill_path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _LAYOUT_HELPERS = mod
    return _LAYOUT_HELPERS


class LayoutCopyBody(BaseModel):
    name: str = Field(default="Mother's Day Beauty Event")
    objective: str = Field(default="")
    target_customer: str = Field(default="")
    promotional_offer: list[str] = Field(default_factory=list)
    category: str = Field(default="Beauty")
    segment_name: str | None = Field(default=None)
    segment_customer_count: int | None = Field(default=None)
    segment_avg_monetary: float | None = Field(default=None)


@router.post("/generate-layout-copy")
def run_layout_copy(body: LayoutCopyBody) -> dict:
    helpers = _get_layout_helpers()
    started = time.monotonic()
    brief = {
        "name": body.name,
        "objective": body.objective,
        "target_customer": body.target_customer,
        "promotional_offer": body.promotional_offer,
        "category": body.category,
    }

    # Try Claude via skill_invoker first; fall back to deterministic if unavailable
    try:
        from ai_engine.orchestrator.skill_invoker import invoke_skill
        # Build audience context from segment data if available
        audience = body.target_customer
        if body.segment_name:
            audience = f"{body.segment_name} ({body.segment_customer_count or '?'} customers, avg spend ${body.segment_avg_monetary or 0:,.0f}). {body.target_customer}"
        state = {
            "campaign": {
                "title": body.name,
                "copy": body.objective,
                "category": body.category,
                "audience_segment": audience,
                "promotional_offer": body.promotional_offer,
            },
            "status": "submitted",
        }
        updated = invoke_skill("layout-copy-generator", state)
        result = updated.get("layout_copy", {})
        # If Claude returned valid placements, use them
        if isinstance(result, dict) and any(k in result for k in ("web_banner", "email", "mobile", "in_store_signage", "placements")):
            placements = result.get("placements", result)
            elapsed = round((time.monotonic() - started) * 1000, 1)
            errors = helpers.validate_placements(placements) if isinstance(placements, dict) else []
            return {
                "ok": True,
                "placements": placements,
                "validation_errors": errors,
                "generation_metadata": {
                    "skill": "layout-copy-generator",
                    "method": "claude_via_skill_invoker",
                    "duration_ms": elapsed,
                },
            }
    except Exception:
        pass  # Fall through to deterministic fallback

    # Deterministic fallback (always works, no API key needed)
    try:
        # Enrich target_customer with segment data for the fallback too
        if body.segment_name:
            brief["target_customer"] = f"{body.segment_name} ({body.segment_customer_count or '?'} customers)"
        placements = helpers.generate_fallback(brief)
        errors = helpers.validate_placements(placements)
        elapsed = round((time.monotonic() - started) * 1000, 1)
        return {
            "ok": True,
            "placements": placements,
            "validation_errors": errors,
            "generation_metadata": {
                "skill": "layout-copy-generator",
                "method": "deterministic_fallback",
                "duration_ms": elapsed,
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
