"""In-memory campaign state for the demo.

Single process state. Render free tier runs one worker, so this is fine for
the demo, but it does NOT survive a server restart and would not be coherent
across multiple workers. That's the trade off for keeping the demo trivial.
For production we would back this with sqlite or postgres.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

DEMO_CAMPAIGN_ID = "MDC-2026-MD-001"
LAST_STEP = 10

STEP_NAMES: dict[int, str] = {
    1: "Briefing",
    2: "Segmentation",
    3: "SKU Selection",
    4: "Creative Production",
    5: "Layout Assembly",
    6: "Approval",
    7: "Localization",
    8: "Activation",
    9: "Monitoring",
    10: "Reporting",
}

_LOCK = threading.Lock()


def _initial_state() -> dict[str, Any]:
    return {
        "current_step": 1,
        "completed_steps": [],
        "step_outputs": {},
        "history": [],
    }


_STATE: dict[str, dict[str, Any]] = {DEMO_CAMPAIGN_ID: _initial_state()}


def _snapshot(s: dict[str, Any]) -> dict[str, Any]:
    return {
        "current_step": s["current_step"],
        "completed_steps": list(s["completed_steps"]),
        "step_outputs": dict(s["step_outputs"]),
        "history": list(s["history"]),
        "is_complete": s["current_step"] > LAST_STEP,
    }


def get_state(campaign_id: str) -> dict[str, Any] | None:
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return None
        return _snapshot(s)


def advance(
    campaign_id: str,
    step: int,
    action: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mark `step` complete and move to step+1.

    Raises:
        KeyError if the campaign id is unknown.
        ValueError if the step does not match current_step or has already
        been completed.
    """
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            raise KeyError(f"unknown campaign: {campaign_id}")
        if s["current_step"] > LAST_STEP:
            raise ValueError("campaign is already complete; reset to replay")
        if step != s["current_step"]:
            raise ValueError(
                f"campaign is at step {s['current_step']}, cannot advance step {step}"
            )
        if step in s["completed_steps"]:
            raise ValueError(f"step {step} is already completed")
        s["completed_steps"].append(step)
        s["current_step"] = step + 1
        entry = {
            "step": step,
            "step_name": STEP_NAMES.get(step, f"Step {step}"),
            "action": action,
            "ts": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }
        s["history"].append(entry)
        if metadata:
            s["step_outputs"][str(step)] = metadata
        return _snapshot(s)


def reset(campaign_id: str) -> dict[str, Any]:
    with _LOCK:
        if campaign_id not in _STATE:
            raise KeyError(f"unknown campaign: {campaign_id}")
        _STATE[campaign_id] = _initial_state()
        return _snapshot(_STATE[campaign_id])


def status_for_step(campaign_id: str, step_number: int) -> str:
    """Map a step number to its current status under live state.

    Returns one of: complete, active, pending. (We collapse "blocked" into
    "pending" since the workflow is strictly sequential; the frontend may
    still render a lock icon for steps far ahead of current_step.)
    """
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return "pending"
        if step_number in s["completed_steps"]:
            return "complete"
        if step_number == s["current_step"]:
            return "active"
        return "pending"


def current_step_for(campaign_id: str) -> int | None:
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return None
        return s["current_step"]
