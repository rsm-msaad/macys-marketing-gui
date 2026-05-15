"""
Deterministic routing rules for the orchestrator.

Pure data plus a single lookup function. No network calls, no LLM, no
imports beyond stdlib. The orchestrator reads workflow_state.json,
passes the state dict into pick_next_step, and gets back the name of
the step to invoke next (or None for a terminal state).

Steps are either skills (LLM judgment) or automations (deterministic).
The step_type field tells the invoker which folder to look in.
"""

from __future__ import annotations

from typing import Any, Callable


def _get(state: dict, *keys: str, default: Any = None) -> Any:
    """Safe nested get. Returns default if any key in the chain is missing."""
    current: Any = state
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


# Each rule: (name, predicate, step_name_or_None, step_type, next_action)
# step_type is "skill" or "automation" (tells invoker which folder to look in)
# next_action follows the professor's JSON envelope contract
ROUTING_TABLE: list[tuple[str, Callable[[dict], bool], str | None, str, str | None]] = [
    (
        "Initial submission",
        lambda s: s.get("status") == "submitted_by_sarah" and s.get("compliance_check") is None,
        "compliance-pre-check",
        "skill",
        "approval-brief-generator",
    ),
    (
        "Compliance passed",
        lambda s: _get(s, "compliance_check", "recommended_action") == "proceed" and s.get("approval_brief") is None,
        "approval-brief-generator",
        "skill",
        "vp-decision",
    ),
    (
        "Compliance failed, return to Merna",
        lambda s: (
            _get(s, "compliance_check", "recommended_action") == "revise" and s.get("status") != "revision_in_progress"
        ),
        None,
        "terminal",
        None,
    ),
    (
        "VP approved",
        lambda s: s.get("approval_decision") == "approved" and s.get("localized_variants") is None,
        "localization-generator",
        "automation",
        "activation-scheduler",
    ),
    (
        "VP requested revision",
        lambda s: s.get("approval_decision") == "revise" and s.get("revision_routing") is None,
        "revision-router",
        "skill",
        "back-to-team",
    ),
    (
        "Localization done",
        lambda s: s.get("localized_variants") is not None and s.get("activation_schedule") is None,
        "activation-scheduler",
        "automation",
        "media-coordinator-confirm",
    ),
    (
        "Activation schedule drafted",
        lambda s: s.get("activation_schedule") is not None and s.get("status") != "in_production",
        None,
        "terminal",
        None,
    ),
    (
        "Rejected",
        lambda s: s.get("approval_decision") == "rejected",
        None,
        "terminal",
        None,
    ),
]


def pick_next_step(state: dict) -> tuple[str | None, str, str, str | None]:
    """Return the next step to invoke, its type, the rule label, and next_action.

    Walks ROUTING_TABLE in order. The first rule whose predicate is True
    wins. If no rule matches, returns (None, 'no_rule_matched', '', None),
    which the orchestrator treats as a terminal state (typically awaiting a
    human action like a VP decision).

    Returns:
        Tuple of (step_folder_name or None, rule_name, step_type, next_action).
    """
    for name, predicate, next_step, step_type, next_action in ROUTING_TABLE:
        try:
            matched = predicate(state)
        except Exception:
            matched = False
        if matched:
            return next_step, name, step_type, next_action
    return None, "no_rule_matched", "", None


# Backwards compatible alias
def pick_next_skill(state: dict) -> tuple[str | None, str]:
    """Legacy alias. Returns (step_name, rule_name) for callers that
    do not yet use the step_type or next_action fields."""
    step, rule, _type, _action = pick_next_step(state)
    return step, rule
