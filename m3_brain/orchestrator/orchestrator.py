"""
M3 deterministic orchestrator.

Main loop: read workflow_state.json, ask the routing table for the next
skill, invoke that skill via the skill_invoker, save state, repeat.
Stops when the routing table returns None (terminal state) or when
max_steps is reached.

The orchestrator does not reason about the campaign. It only decides
which skill to run next, based on the rules in orchestrator.routing_table.
The skills reason. The orchestrator routes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from orchestrator.routing_table import pick_next_skill
from orchestrator.skill_invoker import SKILL_OUTPUT_FIELD, invoke_skill

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_PATH = REPO_ROOT / "workflow_state.json"


def _load_state(state_path: Path) -> dict:
    """Read the workflow state JSON from disk."""
    return json.loads(state_path.read_text(encoding="utf-8"))


def _save_state(state: dict, state_path: Path) -> None:
    """Write the workflow state JSON to disk, pretty printed."""
    state_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def run_workflow(
    state_path: str | Path = DEFAULT_STATE_PATH,
    max_steps: int = 10,
) -> dict:
    """Read state, route, invoke, save, loop. Return the final state.

    Args:
        state_path: path to the workflow state JSON file. Read once at
            start and saved after each successful skill invocation, so
            an interrupted run leaves a valid checkpoint on disk.
        max_steps: upper bound on the number of skill invocations. Acts
            as a safety net if a routing rule keeps matching after its
            skill already wrote its output.

    Returns:
        The final state dict.
    """
    path = Path(state_path)
    state = _load_state(path)
    terminal_reason = "max_steps_reached"
    step = 0
    for step in range(1, max_steps + 1):
        next_skill, rule_name = pick_next_skill(state)
        if next_skill is None:
            terminal_reason = rule_name
            print(f"Step {step}: no further skill (rule: {rule_name})")
            break
        print(f"Step {step}: invoking {next_skill} (rule: {rule_name})")
        state = invoke_skill(next_skill, state)
        _save_state(state, path)
        field = SKILL_OUTPUT_FIELD.get(next_skill, "(unknown)")
        print(f"Step {step} done, state field {field!r} populated")
    print()
    print("=== orchestrator finished ===")
    print(f"terminal reason: {terminal_reason}")
    print(f"steps run:       {step}")
    print(f"final status:    {state.get('status')}")
    return state


def main() -> int:
    """CLI entry, parse args, load env, run the workflow."""
    parser = argparse.ArgumentParser(description="Run the M3 orchestrator.")
    parser.add_argument(
        "--state-path",
        default=str(DEFAULT_STATE_PATH),
        help="Path to workflow_state.json (default: data/workflow_state.json).",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=10,
        help="Maximum skill invocations before stopping (default: 10).",
    )
    args = parser.parse_args()
    load_dotenv(REPO_ROOT / ".env")
    api_key = os.environ.get("TRITONAI_API_KEY", "")
    if (
        not api_key
        or api_key.startswith("your_")
        or api_key.startswith("placeholder")
    ):
        print(
            "ERROR: TRITONAI_API_KEY is not set or is still the placeholder.\n"
            f"Set it in {REPO_ROOT / '.env'} or export it in your shell, "
            "then re run.",
            file=sys.stderr,
        )
        return 2
    final_state = run_workflow(args.state_path, args.max_steps)
    print()
    print("=== final state ===")
    print(json.dumps(final_state, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
