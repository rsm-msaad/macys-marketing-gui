"""
Simulate a VP decision on the current workflow state.

Writes approval_decision to data/workflow_state.json so the orchestrator
can advance past the human checkpoint in demo runs without manual JSON
editing. Also updates status to reflect the decision so the agent and
the routing table can see a consistent state.

Usage:
    python orchestrator/simulate_vp.py approved
    python orchestrator/simulate_vp.py revise
    python orchestrator/simulate_vp.py rejected
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_PATH = REPO_ROOT / "workflow_state.json"
VALID_DECISIONS = ("approved", "revise", "rejected")

STATUS_AFTER_DECISION: dict[str, str] = {
    "approved": "approved",
    "revise": "revision_requested",
    "rejected": "rejected",
}


def set_decision(decision: str) -> dict:
    """Write approval_decision (and matching status) to the state file.

    Args:
        decision: one of 'approved', 'revise', or 'rejected'.

    Returns:
        The updated state dict.
    """
    if decision not in VALID_DECISIONS:
        raise ValueError(
            f"Invalid decision {decision!r}. "
            f"Expected one of: {list(VALID_DECISIONS)}"
        )
    if not STATE_PATH.exists():
        raise FileNotFoundError(
            f"State file not found at {STATE_PATH}. "
            "Seed it first with: python orchestrator/seed_state.py"
        )
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    state["approval_decision"] = decision
    state["status"] = STATUS_AFTER_DECISION[decision]
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return state


def main(argv: list[str] | None = None) -> int:
    """CLI entry, take one decision arg and apply it to the state file."""
    parser = argparse.ArgumentParser(
        description="Simulate a VP decision on the current workflow state."
    )
    parser.add_argument(
        "decision",
        choices=list(VALID_DECISIONS),
        help="The decision the VP would make.",
    )
    args = parser.parse_args(argv)
    state = set_decision(args.decision)
    print(f"Set approval_decision to {args.decision!r} in {STATE_PATH}")
    print(f"Current status: {state.get('status')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
