"""HTTP entry points for the Macy's automation skills."""

from __future__ import annotations

import importlib.util
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api._skill_loader import ANALYZE, DAM, LOCALIZE, SEGMENT, SKU_RECOMMEND

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


@router.post("/sku-recommend")
def run_sku_recommend(body: SkuRecommendBody) -> dict:
    try:
        result = SKU_RECOMMEND.recommend_skus(
            brief={
                "category": body.category,
                "discount_pct": body.discount_pct,
                "campaign_period": body.campaign_period,
                "season": body.season,
            },
            max_results=body.max_results,
        )
        return {"ok": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
