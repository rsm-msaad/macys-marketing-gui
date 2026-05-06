"""HTTP entry points for the four Macy's skills."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api._skill_loader import ANALYZE, DAM, LOCALIZE, SEGMENT

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
        analysis = ANALYZE.analyze_campaign(
            body.campaign_id, forecast_days=body.forecast_days
        )
        return {"ok": True, "analysis": analysis}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
