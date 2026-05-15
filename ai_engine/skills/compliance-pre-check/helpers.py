"""
Deterministic helpers for the compliance pre check skill.

The skill itself runs in Claude. Anything that requires exact string scans
against a known list, or assembly of the structured compliance report, is
implemented here so the model can call it instead of computing from memory.
"""

BANNED_WORDS = [
    "cheap",
    "basic",
    "last chance",
    "clearance blowout",
    "dirt cheap",
    "unbeatable",
    "lowest prices anywhere",
    "nobody beats macys",
]

APPROVED_TAGLINES = [
    "the magic of macys",
    "find your magic",
    "star rewards, every day",
    "new in store, new online",
]


def scan_for_banned_words(copy: str) -> list[str]:
    """Return any banned words or phrases found in the campaign copy.

    Case insensitive match. Returns the list of offending phrases in the
    order they appear in the banned list.
    """
    lower = copy.lower()
    return [word for word in BANNED_WORDS if word in lower]


def check_pricing_language(copy: str) -> dict:
    """Check whether a percent off claim includes the required minimum clause.

    Returns a dict with three booleans:
      has_up_to_claim   : True if 'up to' and 'percent off' both appear
      has_minimum_clause: True if 'starting at' appears
      minimum_required  : True if there is an up to claim without a starting
                          at minimum, the case that violates Pricing Language
    """
    lower = copy.lower()
    has_up_to = "up to" in lower and "percent off" in lower
    has_minimum = "starting at" in lower
    return {
        "has_up_to_claim": has_up_to,
        "has_minimum_clause": has_minimum,
        "minimum_required": has_up_to and not has_minimum,
    }


def check_tagline(tagline: str) -> bool:
    """Return True if the tagline matches an entry on the approved list."""
    return tagline.strip().lower() in APPROVED_TAGLINES


def evaluate_recommended_action(findings: dict) -> str:
    """Decide proceed or revise based on the three compliance findings.

    Rule: any 'fail' anywhere triggers 'revise'. Otherwise 'proceed'. Warn
    statuses keep the action at proceed but should be surfaced as risk flags
    by the next skill in the chain.
    """
    statuses = [v.get("status") for v in findings.values() if isinstance(v, dict)]
    if "fail" in statuses:
        return "revise"
    return "proceed"


def assemble_report(
    brand_alignment: dict,
    disclaimers: dict,
    pricing_cross_check: dict,
    retrieved_docs: list[str],
) -> dict:
    """Assemble the final compliance_check object for workflow_state.json."""
    findings = {
        "brand_alignment": brand_alignment,
        "disclaimers": disclaimers,
        "pricing_cross_check": pricing_cross_check,
    }
    return {
        "brand_alignment": brand_alignment,
        "disclaimers": disclaimers,
        "pricing_cross_check": pricing_cross_check,
        "recommended_action": evaluate_recommended_action(findings),
        "retrieved_docs": retrieved_docs,
    }
