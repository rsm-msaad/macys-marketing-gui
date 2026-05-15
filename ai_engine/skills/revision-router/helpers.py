"""
Deterministic helpers for the revision router skill.

The LLM does the text classification (read the revision comment, pick a
change_type) and writes the one_line_summary. The helpers handle the owner
mapping and the urgency rule so those outcomes are not subject to model
variability.
"""

OWNER_BY_CHANGE_TYPE = {
    "copy": "Merna (campaign manager)",
    "imagery": "Abdullah (creative production)",
    "targeting": "Merna (campaign manager)",
    "pricing": "Merchandising (Anna)",
    "legal": "Legal team",
    "localization": "Shankar (localization lead)",
}


def lookup_owner(change_type: str) -> str:
    """Return the named owner for a given change_type.

    Raises KeyError if change_type is not in the standing mapping. The
    orchestrator should catch this and fall back to Marketing Operations.
    """
    return OWNER_BY_CHANGE_TYPE[change_type]


def assess_urgency(campaign: dict) -> str:
    """Compute urgency from campaign spend and launch timeline.

    Rule:
      high   if spend over $500K AND launch within 5 business days
      medium if spend over $500K OR launch within 5 business days
      low    otherwise

    Expects campaign to include 'estimated_spend' and
    'business_days_to_launch'. If business_days_to_launch is missing, the
    function assumes 10 (not urgent).
    """
    spend = campaign.get("estimated_spend", 0)
    days = campaign.get("business_days_to_launch", 10)
    high_spend = spend > 500_000
    short_timeline = days <= 5
    if high_spend and short_timeline:
        return "high"
    if high_spend or short_timeline:
        return "medium"
    return "low"


def assemble_routing(
    change_type: str,
    owner: str,
    urgency: str,
    one_line_summary: str,
    similar_past_tickets: list[str],
    retrieved_docs: list[str],
) -> dict:
    """Package the routing decision for workflow_state.json."""
    return {
        "change_type": change_type,
        "owner": owner,
        "urgency": urgency,
        "one_line_summary": one_line_summary,
        "similar_past_tickets": similar_past_tickets,
        "retrieved_docs": retrieved_docs,
    }
