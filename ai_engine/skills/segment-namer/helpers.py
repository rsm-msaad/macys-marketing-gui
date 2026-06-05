"""Deterministic helpers for the segment-namer skill.

Provides fallback naming and recommendation when the LLM is unavailable.
"""

from __future__ import annotations


def fallback_names(segments: list[dict]) -> list[dict]:
    """Generate display names from the deterministic segment names."""
    result = []
    for seg in segments:
        name = seg.get("name", "Segment")
        lift = seg.get("top_category_lift", 0)
        top_cat = seg.get("top_category", "")
        if top_cat and lift >= MIN_MEANINGFUL_LIFT:
            cat_note = f"top category {top_cat} (+{lift * 100:.0f}%)"
        else:
            cat_note = "no strong category preference"
        result.append({
            "original_name": name,
            "display_name": name,
            "descriptor": (
                f"{seg.get('customer_count', 0):,} customers, "
                f"avg spend ${seg.get('avg_monetary', 0):,.0f}, "
                f"{cat_note}"
            ),
        })
    return result


# Minimum category lift to consider a segment's top category a meaningful
# preference worth surfacing as a brief suggestion. Below this threshold
# the category affinity is too weak to act on.
MIN_MEANINGFUL_LIFT = 0.10  # 10%


def fallback_recommendation(segments: list[dict], brief: str) -> dict:
    """Rule based recommendation: pick the segment with the highest estimated_value.

    A brief category change is only suggested when the recommended segment's
    top category lift exceeds MIN_MEANINGFUL_LIFT (10%) and the category is
    not already mentioned in the brief. Below that threshold, the category
    affinity is noise and we do not suggest a change.
    """
    if not segments:
        return {
            "recommended_segment": None,
            "recommendation_reason": "No segments available",
            "brief_suggestion": None,
        }

    best = max(segments, key=lambda s: s.get("estimated_value", 0))
    brief_lower = brief.lower()
    top_cat = best.get("top_category", "")
    lift = best.get("top_category_lift", 0)

    brief_suggestion = None
    if top_cat and lift >= MIN_MEANINGFUL_LIFT and top_cat.lower() not in brief_lower:
        brief_suggestion = (
            f"The highest value segment ({best.get('name', 'unknown')}) over indexes "
            f"in {top_cat} by {lift * 100:.0f}%. Consider adjusting the brief to "
            f"emphasize {top_cat} for stronger segment alignment."
        )

    return {
        "recommended_segment": best.get("name"),
        "recommendation_reason": (
            f"Highest estimated value at ${best.get('estimated_value', 0):,.0f} "
            f"with {best.get('response_likelihood', 0) * 100:.0f}% projected response rate"
        ),
        "brief_suggestion": brief_suggestion,
    }
