"""
Agentic orchestrator (Option B) for the Macys M3 chained skills.

Where Option A (orchestrator.orchestrator) walks a fixed routing table,
Option B lets Claude decide which skill to invoke next, what to retrieve,
and when to pause for human input. The agent has 12 tools at its disposal:
5 skill invokers, 1 RAG retrieve, 3 MCP tools, 2 state tools, and 1
request_human_input signal.

The agent uses the OpenAI chat completions function calling protocol,
routed through the TritonAI proxy. Iterations are hard capped to keep
the loop bounded.

Run as a module from the repo root:

    python -m orchestrator.agent

Or with options:

    python -m orchestrator.agent --max-iterations 10 --state-path data/workflow_state.json --quiet
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from orchestrator.agent_schemas import TOOLS
from orchestrator.agent_tools import build_tool_registry

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_PATH = REPO_ROOT / "workflow_state.json"
SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent / "agent_system_prompt.md"
TRITONAI_BASE_URL = "https://tritonai-api.ucsd.edu/v1"
CLAUDE_MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2000
TEMPERATURE = 0.2


def _load_state(state_path: Path) -> dict:
    """Read the workflow state JSON from disk."""
    return json.loads(state_path.read_text(encoding="utf-8"))


def _save_state(state: dict, state_path: Path) -> None:
    """Write the workflow state JSON to disk pretty printed."""
    state_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _load_system_prompt() -> str:
    """Load the agent system prompt from disk."""
    return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")


def _summarize_result(result: Any, max_chars: int = 300) -> str:
    """Short string representation of a tool result for the transcript."""
    try:
        rendered = json.dumps(result, ensure_ascii=False, default=str)
    except Exception:
        rendered = str(result)
    if len(rendered) > max_chars:
        return rendered[:max_chars] + "..."
    return rendered


def _format_args(args: dict) -> str:
    """Compact one line representation of tool call arguments."""
    if not args:
        return ""
    parts: list[str] = []
    for key, value in args.items():
        rendered = json.dumps(value, ensure_ascii=False, default=str)
        if len(rendered) > 60:
            rendered = rendered[:57] + "..."
        parts.append(f"{key}={rendered}")
    return ", ".join(parts)


def run_agent(
    state_path: str | Path = DEFAULT_STATE_PATH,
    max_iterations: int = 10,
    verbose: bool = True,
) -> tuple[dict, list[dict]]:
    """Run the agentic orchestrator loop.

    Args:
        state_path: path to the workflow state JSON file. Read at start
            and re saved after each state mutating tool call.
        max_iterations: hard cap on agent turns (default 10).
        verbose: print tool calls and results as they happen.

    Returns:
        Tuple of (final_state, transcript). The transcript is a list of
        dicts, each with step, type ('tool_call' or 'final_response'),
        and the associated payload.
    """
    path = Path(state_path)
    state = _load_state(path)
    state_holder: dict[str, dict] = {"state": state}
    tool_registry = build_tool_registry(state_holder, path)
    system_prompt = _load_system_prompt()

    client = OpenAI(
        api_key=os.environ["TRITONAI_API_KEY"],
        base_url=TRITONAI_BASE_URL,
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                "Here is the current workflow state:\n\n"
                "```json\n"
                + json.dumps(state, ensure_ascii=False, indent=2)
                + "\n```\n\nPlease proceed."
            ),
        },
    ]

    transcript: list[dict] = []
    final_text: str | None = None
    force_text_next = False
    iteration = 0

    for iteration in range(1, max_iterations + 1):
        response = client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="none" if force_text_next else "auto",
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
        )
        message = response.choices[0].message

        # Append the assistant message to the conversation history.
        asst_msg: dict[str, Any] = {
            "role": "assistant",
            "content": message.content,
        }
        if message.tool_calls:
            asst_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in message.tool_calls
            ]
        messages.append(asst_msg)

        if not message.tool_calls:
            final_text = message.content or ""
            transcript.append(
                {
                    "step": iteration,
                    "type": "final_response",
                    "content": final_text,
                }
            )
            if verbose:
                print(f"\nStep {iteration}: final response")
                print(final_text)
            break

        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            args_json = tool_call.function.arguments or "{}"
            try:
                args = json.loads(args_json)
            except json.JSONDecodeError:
                args = {}
            tool_fn = tool_registry.get(tool_name)
            if tool_fn is None:
                result: Any = {"error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = tool_fn(**args)
                except Exception as exc:
                    result = {"error": str(exc), "tool": tool_name}

            transcript.append(
                {
                    "step": iteration,
                    "type": "tool_call",
                    "tool": tool_name,
                    "args": args,
                    "result": result,
                }
            )

            if verbose:
                print(
                    f"Step {iteration}: tool {tool_name}({_format_args(args)})"
                )
                print(f"  result: {_summarize_result(result)}")

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(
                        result, ensure_ascii=False, default=str
                    ),
                }
            )

            if tool_name == "request_human_input":
                force_text_next = True
    else:
        if verbose:
            print(f"\nHit max iterations cap ({max_iterations}), stopping")

    final_state = state_holder["state"]
    _save_state(final_state, path)

    tool_calls = [t for t in transcript if t["type"] == "tool_call"]
    skills_invoked = [
        t["tool"] for t in tool_calls if t["tool"].startswith("invoke_")
    ]
    if final_text is not None:
        halt_reason = (
            "paused for human (request_human_input then final text)"
            if any(t["tool"] == "request_human_input" for t in tool_calls)
            else "final response from agent"
        )
    else:
        halt_reason = "max iterations reached"

    if verbose:
        print()
        print("=== agent summary ===")
        print(f"iterations:     {iteration}")
        print(f"tool calls:     {len(tool_calls)}")
        print(f"skills invoked: {skills_invoked}")
        print(f"halt reason:    {halt_reason}")

    return final_state, transcript


def main() -> int:
    """CLI entry, parse args, verify env, run the agent."""
    parser = argparse.ArgumentParser(
        description="Run the agentic orchestrator (Option B)."
    )
    parser.add_argument(
        "--state-path",
        default=str(DEFAULT_STATE_PATH),
        help="Path to workflow_state.json.",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=10,
        help="Hard cap on agent turns (default 10).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per step tool call printing.",
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
            "ERROR: TRITONAI_API_KEY is not set or is still a placeholder.\n"
            f"Set it in {REPO_ROOT / '.env'} or export it in your shell, "
            "then re run.",
            file=sys.stderr,
        )
        return 2

    final_state, _ = run_agent(
        state_path=args.state_path,
        max_iterations=args.max_iterations,
        verbose=not args.quiet,
    )
    print()
    print("=== final state ===")
    print(json.dumps(final_state, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
