"""
Deterministic routing rules for the M3 orchestrator.

Pure data plus a single lookup function. No network calls, no LLM, no
imports beyond stdlib. The orchestrator reads workflow_state.json,
passes the state dict into pick_next_skill, and gets back the name of
the skill to invoke next (or None for a terminal state).
"""

from __future__ import annotations

from typing import Any, Callable


def _get(state: dict, *keys: str, default: Any = None) -> Any:
    """Safe nested get. Returns default if any key in the chain is missing.

    Example:
        _get(state, 'compliance_check', 'recommended_action')
    """
    current: Any = state
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


# Each rule is (name, predicate, next_skill_or_None). Order matters.
# The first rule whose predicate returns True wins.
ROUTING_TABLE: list[tuple[str, Callable[[dict], bool], str | None]] = [
    (
        "Initial submission",
        lambda s: s.get("status") == "submitted_by_sarah" and s.get("compliance_check") is None,
        "compliance-pre-check",
    ),
    (
        "Compliance passed",
        lambda s: _get(s, "compliance_check", "recommended_action") == "proceed" and s.get("approval_brief") is None,
        "approval-brief-generator",
    ),
    (
        "Compliance failed, return to Merna",
        lambda s: (
            _get(s, "compliance_check", "recommended_action") == "revise" and s.get("status") != "revision_in_progress"
        ),
        None,
    ),
    (
        "VP approved",
        lambda s: s.get("approval_decision") == "approved" and s.get("localized_variants") is None,
        "localization-generator",
    ),
    (
        "VP requested revision",
        lambda s: s.get("approval_decision") == "revise" and s.get("revision_routing") is None,
        "revision-router",
    ),
    (
        "Localization done",
        lambda s: s.get("localized_variants") is not None and s.get("activation_schedule") is None,
        "activation-scheduler",
    ),
    (
        "Activation schedule drafted",
        lambda s: s.get("activation_schedule") is not None and s.get("status") != "in_production",
        None,
    ),
    (
        "Rejected",
        lambda s: s.get("approval_decision") == "rejected",
        None,
    ),
]


def pick_next_skill(state: dict) -> tuple[str | None, str]:
    """Return the next skill to invoke, plus the rule label that picked it.

    Walks ROUTING_TABLE in order. The first rule whose predicate is True
    wins. If no rule matches, returns (None, 'no_rule_matched'), which
    the orchestrator treats as a terminal state (typically awaiting a
    human action like a VP decision).

    Args:
        state: the workflow state dict, shaped like data/workflow_state.json.

    Returns:
        Tuple of (skill_folder_name or None, rule_name).
    """
    for name, predicate, next_skill in ROUTING_TABLE:
        try:
            matched = predicate(state)
        except Exception:
            matched = False
        if matched:
            return next_skill, name
    return None, "no_rule_matched"
