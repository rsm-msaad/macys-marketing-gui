"""Tests for the segment-namer skill helpers (deterministic fallback)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

# Load helpers via importlib to mirror how the API route loads it
_HELPERS_PATH = (
    Path(__file__).resolve().parents[2]
    / "ai_engine"
    / "skills"
    / "segment-namer"
    / "helpers.py"
)
_spec = importlib.util.spec_from_file_location("seg_namer_helpers", _HELPERS_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

fallback_names = _mod.fallback_names
fallback_recommendation = _mod.fallback_recommendation


# --- Fixtures ---

def _make_segment(
    name: str = "VIP Loyalists",
    customer_count: int = 5000,
    avg_monetary: float = 320.0,
    top_category: str = "Beauty",
    top_category_lift: float = 0.25,
    estimated_value: float = 48000.0,
    response_likelihood: float = 0.30,
) -> dict:
    return {
        "name": name,
        "customer_count": customer_count,
        "avg_monetary": avg_monetary,
        "top_category": top_category,
        "top_category_lift": top_category_lift,
        "estimated_value": estimated_value,
        "response_likelihood": response_likelihood,
    }


THREE_SEGMENTS = [
    _make_segment("VIP Loyalists", 5000, 320, "Beauty", 0.25, 48000, 0.30),
    _make_segment("Lapsed Bargain Hunters", 12000, 85, "Apparel", 0.15, 10200, 0.10),
    _make_segment("Occasional Browsers", 8000, 140, "Home", 0.12, 22400, 0.20),
]


# --- fallback_names tests ---

class TestFallbackNames:
    def test_happy_path(self):
        result = fallback_names(THREE_SEGMENTS)
        assert len(result) == 3
        for entry, seg in zip(result, THREE_SEGMENTS):
            assert entry["original_name"] == seg["name"]
            assert entry["display_name"] == seg["name"]
            assert "customers" in entry["descriptor"]
            # Segments with lift >= 10% show category; below show "no strong"
            if seg.get("top_category_lift", 0) >= 0.10:
                assert seg["top_category"] in entry["descriptor"]
            else:
                assert "no strong" in entry["descriptor"]

    def test_preserves_order(self):
        result = fallback_names(THREE_SEGMENTS)
        names = [r["original_name"] for r in result]
        assert names == ["VIP Loyalists", "Lapsed Bargain Hunters", "Occasional Browsers"]

    def test_single_segment(self):
        result = fallback_names([_make_segment()])
        assert len(result) == 1
        assert result[0]["original_name"] == "VIP Loyalists"

    def test_empty_list(self):
        result = fallback_names([])
        assert result == []

    def test_missing_fields_use_defaults(self):
        result = fallback_names([{}])
        assert len(result) == 1
        assert result[0]["original_name"] == "Segment"
        assert result[0]["display_name"] == "Segment"
        assert "0 customers" in result[0]["descriptor"]
        assert "no strong category preference" in result[0]["descriptor"]

    def test_monetary_formatted_as_dollars(self):
        result = fallback_names([_make_segment(avg_monetary=1234.56)])
        assert "$1,235" in result[0]["descriptor"]


# --- fallback_recommendation tests ---

class TestFallbackRecommendation:
    def test_picks_highest_estimated_value(self):
        result = fallback_recommendation(THREE_SEGMENTS, "Mother's Day Beauty Event")
        assert result["recommended_segment"] == "VIP Loyalists"
        assert "$48,000" in result["recommendation_reason"]
        assert "30%" in result["recommendation_reason"]

    def test_brief_suggestion_null_when_category_matches(self):
        result = fallback_recommendation(THREE_SEGMENTS, "Mother's Day Beauty Event")
        # "Beauty" is in the brief and is the top_category of the best segment
        assert result["brief_suggestion"] is None

    def test_brief_suggestion_when_category_mismatch(self):
        # Brief mentions "Apparel" but highest value segment is Beauty
        result = fallback_recommendation(THREE_SEGMENTS, "Summer Apparel Sale")
        assert result["brief_suggestion"] is not None
        assert "Beauty" in result["brief_suggestion"]

    def test_empty_segments(self):
        result = fallback_recommendation([], "Any brief")
        assert result["recommended_segment"] is None
        assert "No segments available" in result["recommendation_reason"]
        assert result["brief_suggestion"] is None

    def test_single_segment_recommended(self):
        segs = [_make_segment("Solo Segment", estimated_value=9999)]
        result = fallback_recommendation(segs, "Solo campaign")
        assert result["recommended_segment"] == "Solo Segment"

    def test_case_insensitive_brief_matching(self):
        result = fallback_recommendation(THREE_SEGMENTS, "BEAUTY blowout sale")
        assert result["brief_suggestion"] is None

    def test_no_top_category_skips_suggestion(self):
        seg = _make_segment(top_category="")
        result = fallback_recommendation([seg], "Random brief")
        assert result["brief_suggestion"] is None

    def test_low_lift_skips_suggestion(self):
        """A tiny lift (below 10%) should not trigger a brief suggestion."""
        seg = _make_segment(top_category="Accessories", top_category_lift=0.03)
        result = fallback_recommendation([seg], "Summer sale")
        assert result["brief_suggestion"] is None

    def test_high_lift_triggers_suggestion(self):
        """Lift above 10% and category not in brief should trigger suggestion."""
        seg = _make_segment(top_category="Home", top_category_lift=0.20)
        result = fallback_recommendation([seg], "Beauty campaign")
        assert result["brief_suggestion"] is not None
        assert "Home" in result["brief_suggestion"]
        assert "20%" in result["brief_suggestion"]
