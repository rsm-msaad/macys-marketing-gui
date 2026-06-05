"""Deterministic helpers for the segment-namer skill.

Provides fallback naming and recommendation when the LLM is unavailable.
"""

from __future__ import annotations


def fallback_names(segments: list[dict]) -> list[dict]:
    """Generate display names from the deterministic segment names."""
    result = []
    for seg in segments:
        name = seg.get("name", "Segment")
        result.append({
            "original_name": name,
            "display_name": name,
            "descriptor": (
                f"{seg.get('customer_count', 0):,} customers, "
                f"avg spend ${seg.get('avg_monetary', 0):,.0f}, "
                f"top category {seg.get('top_category', 'N/A')}"
            ),
        })
    return result


def fallback_recommendation(segments: list[dict], brief: str) -> dict:
    """Rule based recommendation: pick the segment with the highest estimated_value."""
    if not segments:
        return {
            "recommended_segment": None,
            "recommendation_reason": "No segments available",
            "brief_suggestion": None,
        }

    best = max(segments, key=lambda s: s.get("estimated_value", 0))
    brief_lower = brief.lower()

    # Check if brief category matches the best segment's top category
    top_cat = best.get("top_category", "")
    brief_suggestion = None
    if top_cat and top_cat.lower() not in brief_lower:
        brief_suggestion = (
            f"The highest value segment ({best.get('name', 'unknown')}) over indexes "
            f"in {top_cat}. Consider adjusting the brief to emphasize {top_cat} "
            f"for stronger segment alignment."
        )

    return {
        "recommended_segment": best.get("name"),
        "recommendation_reason": (
            f"Highest estimated value at ${best.get('estimated_value', 0):,.0f} "
            f"with {best.get('response_likelihood', 0) * 100:.0f}% projected response rate"
        ),
        "brief_suggestion": brief_suggestion,
    }
