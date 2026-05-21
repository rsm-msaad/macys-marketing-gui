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


class DamBody(BaseModel):
    brief: str = Field(default="Mother's Day Beauty Event")
    max_results: int = Field(default=12, ge=1, le=50)


class LocalizeBody(BaseModel):
    brief: str = Field(default="Mother's Day Beauty Event")
    sku_ids: list[int] = Field(default_factory=lambda: [4, 18])


class AnalyzeBody(BaseModel):
    campaign_id: int = Field(default=7)
    forecast_days: int = Field(default=14, ge=1, le=90)


@router.post("/segment")
def run_segment(body: SegmentBody) -> dict:
    try:
        segments = SEGMENT.build_segments(body.brief)
        return {
            "ok": True,
            "brief": body.brief,
            "segments": segments,
            "total_clustered": sum(s["customer_count"] for s in segments),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dam-search")
def run_dam(body: DamBody) -> dict:
    try:
        results, stats = DAM.search_with_stats(body.brief, max_results=body.max_results)
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


@router.post("/analyze")
def run_analyze(body: AnalyzeBody) -> dict:
    try:
        analysis = ANALYZE.analyze_campaign(body.campaign_id, forecast_days=body.forecast_days)
        return {"ok": True, "analysis": analysis}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
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
# Uses the same product catalog as the SKU Recommender so IDs match.
_MAP_ENFORCED_BRANDS: set[str] = {
    "Levi's", "Coach", "Lancome", "Estee Lauder",
    "Clinique", "La Mer", "Dior Beauty", "Tag Heuer",
}


class CheckPricingBody(BaseModel):
    sku_ids: list[str] = Field(default_factory=list)
    proposed_discount_pct: float = Field(default=25)


@router.post("/check-pricing")
def run_check_pricing(body: CheckPricingBody) -> dict:
    """MCP tool firing: check_pricing_conflicts at Step 3 (SKU lock-in).

    Validates selected SKUs against MAP-enforced brand list from
    PRICE-RULES-2026-001 and checks for discount floor violations.
    """
    import json

    catalog_path = REPO_ROOT / "ai_engine" / "automations" / "sku-recommender" / "product_catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    by_id = {s["sku_id"]: s for s in catalog}

    conflicts: list[dict] = []
    for sku_id in body.sku_ids:
        sku = by_id.get(sku_id)
        if sku is None:
            conflicts.append({"sku_id": sku_id, "issue": "SKU not found in catalog.", "severity": "fail"})
            continue
        if sku.get("brand") in _MAP_ENFORCED_BRANDS:
            conflicts.append({
                "sku_id": sku_id,
                "brand": sku["brand"],
                "issue": (
                    f"Brand {sku['brand']} is on the MAP enforced list "
                    "per PRICE-RULES-2026-001. Discount requires Merchandising approval."
                ),
                "severity": "fail",
            })
            continue
        if sku.get("map_protected") and (body.proposed_discount_pct / 100.0) > sku.get("map_floor_pct", 0):
            conflicts.append({
                "sku_id": sku_id,
                "brand": sku["brand"],
                "issue": (
                    f"Proposed {body.proposed_discount_pct:.0f}% discount exceeds "
                    f"MAP floor of {sku['map_floor_pct'] * 100:.0f}%."
                ),
                "severity": "fail",
            })

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


@router.post("/generate-layout-copy")
def run_layout_copy(body: LayoutCopyBody) -> dict:
    try:
        helpers = _get_layout_helpers()
        started = time.monotonic()
        brief = {
            "name": body.name,
            "objective": body.objective,
            "target_customer": body.target_customer,
            "promotional_offer": body.promotional_offer,
            "category": body.category,
        }
        # Use the deterministic fallback. When the LLM is available via
        # TritonAI, the orchestrator's skill_invoker handles the real call.
        # This endpoint provides the demo path that always works.
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
