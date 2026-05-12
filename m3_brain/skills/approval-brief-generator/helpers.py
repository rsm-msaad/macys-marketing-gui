"""
Deterministic helpers for the approval brief generator skill.

The LLM writes the prose (the five field brief). The helpers handle the
numeric benchmark extraction and the approve / revise rule so those are
not subject to model variability.
"""


def extract_roi_benchmark(retrieved_retros: list[dict], audience_segment: str) -> dict:
    """Pull representative numeric benchmarks from the retrieved retros.

    Each retrieved retro is expected to be a dict with optional 'metrics' and
    'segments' keys. The function looks for a segment block matching the
    audience_segment (case insensitive) and returns its metrics. Falls back
    to the campaign level metrics from the first retro, or to an empty dict
    if neither is present.
    """
    if not retrieved_retros:
        return {}
    first = retrieved_retros[0]
    segments = first.get("segments", {})
    for key, block in segments.items():
        if key.lower() == audience_segment.lower():
            return block
    return first.get("metrics", {})


def decide_recommendation(compliance_check: dict, risk_flags: list[str]) -> str:
    """Return approve, revise, or reject based on compliance findings.

    Rule:
      any 'fail' status in compliance_check    triggers 'revise'
      otherwise                                returns 'approve'

    The LLM adds the one sentence rationale after this value is decided.
    Reject is not produced by this helper. A reject is a VP decision, not
    a compliance outcome.
    """
    statuses = []
    for key in ("brand_alignment", "disclaimers", "pricing_cross_check"):
        block = compliance_check.get(key)
        if isinstance(block, dict):
            statuses.append(block.get("status"))
    if "fail" in statuses:
        return "revise"
    return "approve"


def assemble_brief(
    campaign_goal: str,
    target_audience: str,
    expected_roi: str,
    risk_flags: list[str],
    ai_recommendation: str,
    retrieved_docs: list[str],
) -> dict:
    """Package the five field approval brief plus the retrieved doc IDs."""
    return {
        "campaign_goal": campaign_goal,
        "target_audience": target_audience,
        "expected_roi": expected_roi,
        "risk_flags": risk_flags,
        "ai_recommendation": ai_recommendation,
        "retrieved_docs": retrieved_docs,
    }
