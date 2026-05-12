"""
Reset data/workflow_state.json to a starter campaign.

Two starter campaigns are available:

* Default (no flag): the fail path Spring Beauty Refresh that triggers
  compliance issues (Lancome MAP enforced SKU, missing minimum discount
  clause). Useful for demoing the compliance halt path.

* --happy-path: a cleaned up Spring Beauty Refresh with generic Beauty
  SKUs and a fully formed pricing claim. Passes compliance, advances
  through the brief, and halts pending the VP decision.

Usage:
    python orchestrator/seed_state.py
    python orchestrator/seed_state.py --happy-path
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_PATH = REPO_ROOT / "workflow_state.json"

STARTER_STATE: dict = {
    "campaign_id": "CAMP-2026-0511",
    "status": "submitted_by_sarah",
    "submitted_at": "2026-05-11T14:30:00Z",
    "campaign": {
        "title": "Spring Beauty Refresh",
        "audience_segment": "Beauty Loyalists",
        "copy": (
            "Up to 40 percent off on your favorite Beauty brands. "
            "Refresh your routine for spring."
        ),
        "tagline": "The Magic of Macys",
        "skus": ["BTY-001", "BTY-045", "BTY-112"],
        "discount_pct": 40,
        "regions": ["NY", "CA", "FL", "TX"],
        "estimated_spend": 350000,
        "campaign_manager": "Sarah Chen",
    },
    "compliance_check": None,
    "approval_brief": None,
    "approval_decision": None,
    "revision_routing": None,
    "localized_variants": None,
    "activation_schedule": None,
}

HAPPY_PATH_STATE: dict = {
    "campaign_id": "CAMP-2026-0512",
    "status": "submitted_by_sarah",
    "submitted_at": "2026-05-12T09:00:00Z",
    "campaign": {
        "title": "Spring Beauty Refresh, Clean",
        "audience_segment": "Beauty Loyalists",
        "copy": (
            "Up to 40 percent off, starting at 10 percent off, on your "
            "favorite Beauty brands. Refresh your routine for spring."
        ),
        "tagline": "The Magic of Macys",
        "skus": ["BTY-200", "BTY-201", "BTY-202"],
        "discount_pct": 40,
        "regions": ["NY", "CA", "FL", "TX"],
        "estimated_spend": 350000,
        "campaign_manager": "Sarah Chen",
    },
    "compliance_check": None,
    "approval_brief": None,
    "approval_decision": None,
    "revision_routing": None,
    "localized_variants": None,
    "activation_schedule": None,
}


def _write_state(state: dict, label: str) -> None:
    """Write a state dict to STATE_PATH and print a confirmation line."""
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {label} starter state to {STATE_PATH}")


def seed_fail_path_state() -> None:
    """Write the default Spring Beauty Refresh that fails compliance."""
    _write_state(STARTER_STATE, "fail path")


def seed_happy_path_state() -> None:
    """Write the cleaned up Spring Beauty Refresh that passes compliance."""
    _write_state(HAPPY_PATH_STATE, "happy path")


def main(argv: list[str] | None = None) -> int:
    """CLI entry, seed either the fail path or the happy path campaign."""
    parser = argparse.ArgumentParser(
        description="Reset the workflow state to a starter campaign."
    )
    parser.add_argument(
        "--happy-path",
        action="store_true",
        help=(
            "Seed the cleaned campaign that passes compliance and advances "
            "to the VP brief (default seeds the fail path campaign)."
        ),
    )
    args = parser.parse_args(argv)
    if args.happy_path:
        seed_happy_path_state()
    else:
        seed_fail_path_state()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
