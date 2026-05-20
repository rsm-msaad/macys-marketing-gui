"""
Tool registry for the agentic orchestrator (Option B).

Each function wraps an underlying capability (skill, MCP tool, RAG query,
or state read/write) so the agent can call it through the OpenAI function
calling protocol. Tool functions are built as closures over the in memory
workflow state, so the agent's calls do not re read the state file on
every turn (and so multiple tool calls in a single agent turn see each
other's updates).

The agent loop in orchestrator.agent reads the OpenAI tool schemas from
orchestrator.agent_schemas and the matching Python implementations from
this module. Keep the two files in sync.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from orchestrator.skill_invoker import invoke_skill
from rag.retrieval import retrieve as rag_retrieve
from tools import (
    check_pricing_conflicts as _check_pricing_conflicts,
)
from tools import (
    find_dam_assets as _find_dam_assets,
)
from tools import (
    generate_locale_variants as _generate_locale_variants,
)


def _save_state(state: dict, path: Path) -> None:
    """Write the workflow state to disk pretty printed."""
    path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def build_tool_registry(
    state_holder: dict[str, dict],
    state_path: Path,
) -> dict[str, Callable[..., dict]]:
    """Return a mapping of tool name to its Python implementation.

    Args:
        state_holder: a dict shaped like {'state': <workflow_state_dict>}.
            The holder lets tools mutate or replace the state dict
            without losing the reference passed into the agent loop.
        state_path: path to the workflow state file. Tools that change
            state write back to this path so the disk copy stays in sync
            with the in memory copy.

    Returns:
        Dict mapping each tool name to a callable. Each callable accepts
        keyword arguments parsed from the OpenAI tool call arguments
        JSON, and returns a JSON serializable dict.
    """

    def _run_skill(skill_name: str, output_field: str) -> dict:
        """Run a skill, save state, return the new field plus status."""
        state_holder["state"] = invoke_skill(skill_name, state_holder["state"])
        _save_state(state_holder["state"], state_path)
        return {
            "skill": skill_name,
            output_field: state_holder["state"].get(output_field),
            "status_after": state_holder["state"].get("status"),
        }

    def invoke_compliance_pre_check() -> dict:
        return _run_skill("compliance-pre-check", "compliance_check")

    def invoke_approval_brief_generator() -> dict:
        return _run_skill("approval-brief-generator", "approval_brief")

    def invoke_revision_router() -> dict:
        return _run_skill("revision-router", "revision_routing")

    def invoke_localization_generator() -> dict:
        return _run_skill("localization-generator", "localized_variants")

    def invoke_activation_scheduler() -> dict:
        return _run_skill("activation-scheduler", "activation_schedule")

    def retrieve_from_knowledge_base(query: str, k: int = 4) -> dict:
        hits = rag_retrieve(query, k=k)
        return {
            "query": query,
            "k": k,
            "count": len(hits),
            "results": hits,
        }

    def check_pricing_conflicts(
        sku_ids: list[str],
        proposed_discount_pct: float,
    ) -> dict:
        return _check_pricing_conflicts(sku_ids, proposed_discount_pct)

    def find_dam_assets(
        category: str,
        region: str,
        max_results: int = 5,
    ) -> dict:
        return _find_dam_assets(category, region, max_results=max_results)

    def generate_locale_variants(
        copy: str,
        target_language: str,
    ) -> dict:
        return _generate_locale_variants(copy, target_language)

    def read_workflow_state() -> dict:
        return state_holder["state"]

    def update_workflow_state(field: str, value: Any) -> dict:
        state_holder["state"][field] = value
        _save_state(state_holder["state"], state_path)
        return {
            "updated_field": field,
            "new_value": value,
            "current_status": state_holder["state"].get("status"),
        }

    def request_human_input(reason: str) -> dict:
        return {
            "status": "paused_for_human",
            "reason": reason,
            "instruction": (
                "The agent should produce a final text summary in its next "
                "response and stop. A human will pick up from here."
            ),
        }

    return {
        "invoke_compliance_pre_check": invoke_compliance_pre_check,
        "invoke_approval_brief_generator": invoke_approval_brief_generator,
        "invoke_revision_router": invoke_revision_router,
        "invoke_localization_generator": invoke_localization_generator,
        "invoke_activation_scheduler": invoke_activation_scheduler,
        "retrieve_from_knowledge_base": retrieve_from_knowledge_base,
        "check_pricing_conflicts": check_pricing_conflicts,
        "find_dam_assets": find_dam_assets,
        "generate_locale_variants": generate_locale_variants,
        "read_workflow_state": read_workflow_state,
        "update_workflow_state": update_workflow_state,
        "request_human_input": request_human_input,
    }
