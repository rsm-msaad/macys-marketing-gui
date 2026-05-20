"""
Skill invoker for the M3 orchestrator.

Loads a SKILL.md, pre fetches the RAG context and any MCP tool data the
skill needs, builds a prompt, calls Claude, parses the JSON response,
and merges it into the workflow state.

The pre fetch pattern (Option A) keeps the orchestrator deterministic.
The model receives the context it needs already retrieved, and only
produces the structured JSON the SKILL.md output schema describes. No
tool calling loop, no model issued retrieval, no model issued MCP calls.
The model reasons, the orchestrator routes.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Callable

# Heavy imports deferred to the functions that use them:
#   OpenAI       -> inside _call_claude()
#   retrieve     -> inside _prefetch_rag()
#   tools        -> inside _get_mcp_tools()

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
AUTOMATIONS_DIR = REPO_ROOT / "automations"

CLAUDE_MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2000
TEMPERATURE = 0.2
TRITONAI_BASE_URL = "https://tritonai-api.ucsd.edu/v1"


# Per skill pre fetch configuration. Each entry:
#   rag_queries: list of query strings. May contain {dotted.path}
#                placeholders that are filled from the state dict.
#   mcp_calls:   list of (tool_name, args_callable) where args_callable
#                takes the state dict and returns a dict of kwargs for
#                the tool function.
SKILL_PREFETCH_CONFIG: dict[str, dict[str, Any]] = {
    "compliance-pre-check": {
        "rag_queries": [
            "banned words and approved taglines",
            "required legal disclaimers for percent off pricing",
            "MAP minimum advertised price restrictions",
            "past compliance flag examples",
        ],
        "mcp_calls": [
            (
                "check_pricing_conflicts",
                lambda s: {
                    "sku_ids": s["campaign"]["skus"],
                    "proposed_discount_pct": s["campaign"]["discount_pct"],
                },
            ),
        ],
    },
    "approval-brief-generator": {
        "rag_queries": [
            "{campaign.audience_segment} campaign retro performance benchmarks",
        ],
        "mcp_calls": [],
    },
    "revision-router": {
        "rag_queries": [],
        "mcp_calls": [],
    },
    "localization-generator": {
        "rag_queries": [
            "localization rules including holidays pricing",
            "DAM asset usage rights and tagging for regional campaigns",
        ],
        "mcp_calls": [
            (
                "find_dam_assets",
                lambda s: {
                    "category": s.get("campaign", {}).get("category", "Beauty"),
                    "region": (s.get("campaign", {}).get("regions") or ["NY"])[0],
                    "max_results": 3,
                },
            ),
            (
                "generate_locale_variants",
                lambda s: {
                    "copy": s.get("campaign", {}).get("copy", ""),
                    "target_language": "es",
                    "regional_pricing": None,
                },
            ),
        ],
    },
    "activation-scheduler": {
        "rag_queries": [
            "activation timing for campaign across email social display",
        ],
        "mcp_calls": [],
    },
}

# Where each skill writes its result inside the workflow state.
SKILL_OUTPUT_FIELD: dict[str, str] = {
    "compliance-pre-check": "compliance_check",
    "approval-brief-generator": "approval_brief",
    "revision-router": "revision_routing",
    "localization-generator": "localized_variants",
    "activation-scheduler": "activation_schedule",
}

# Status to set after the skill completes, so the routing table can
# pick the next rule cleanly. The skill output itself does not have to
# include a status field.
SKILL_STATUS_AFTER: dict[str, str] = {
    "compliance-pre-check": "compliance_check_complete",
    "approval-brief-generator": "in_vp_review",
    "revision-router": "revision_requested",
    "localization-generator": "in_localization",
    "activation-scheduler": "scheduled",
}

# MCP tool registry. Populated lazily on first access to avoid importing
# the tools package at module load time.
_MCP_TOOLS: dict[str, Callable[..., dict]] | None = None


def _get_mcp_tools() -> dict[str, Callable[..., dict]]:
    global _MCP_TOOLS
    if _MCP_TOOLS is None:
        from tools import check_pricing_conflicts, find_dam_assets, generate_locale_variants

        _MCP_TOOLS = {
            "check_pricing_conflicts": check_pricing_conflicts,
            "find_dam_assets": find_dam_assets,
            "generate_locale_variants": generate_locale_variants,
        }
    return _MCP_TOOLS


def _format_query(template: str, state: dict) -> str:
    """Fill {dotted.path} placeholders in a query template from state.

    Example: '{campaign.audience_segment} retro' with the starter state
    becomes 'Beauty Loyalists retro'. If a path is missing, the literal
    placeholder is left in the query rather than crashing.
    """

    def replacer(match: re.Match[str]) -> str:
        path = match.group(1)
        current: Any = state
        for key in path.split("."):
            if not isinstance(current, dict):
                return match.group(0)
            current = current.get(key)
            if current is None:
                return match.group(0)
        return str(current)

    return re.sub(r"\{([a-zA-Z0-9_.]+)\}", replacer, template)


def _load_skill_markdown(skill_name: str) -> str:
    """Load SKILL.md for the named skill folder. Raise if missing."""
    path = SKILLS_DIR / skill_name / "SKILL.md"
    if not path.exists():
        raise FileNotFoundError(f"SKILL.md not found at {path}")
    return path.read_text(encoding="utf-8")


def _prefetch_rag(skill_name: str, state: dict) -> dict[str, list[dict]]:
    """Run the configured RAG queries. Return dict keyed by filled query."""
    from rag.retrieval import retrieve

    config = SKILL_PREFETCH_CONFIG.get(skill_name, {})
    queries = config.get("rag_queries", [])
    out: dict[str, list[dict]] = {}
    for template in queries:
        query = _format_query(template, state)
        out[query] = retrieve(query, k=4)
    return out


def _prefetch_mcp(skill_name: str, state: dict) -> dict[str, dict]:
    """Run the configured MCP tool calls. Return dict keyed by tool name."""
    config = SKILL_PREFETCH_CONFIG.get(skill_name, {})
    calls = config.get("mcp_calls", [])
    out: dict[str, dict] = {}
    tools = _get_mcp_tools()
    for tool_name, args_fn in calls:
        tool = tools.get(tool_name)
        if tool is None:
            continue
        args = args_fn(state)
        if isinstance(args, dict):
            out[tool_name] = tool(**args)
        elif isinstance(args, tuple):
            out[tool_name] = tool(*args)
        else:
            out[tool_name] = tool(args)
    return out


def _strip_json_fences(text: str) -> str:
    """Strip ```json ... ``` or ``` ... ``` fences if present."""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1 :]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
    return stripped.strip()


def _call_claude(system: str, user_payload: dict) -> str:
    """Call Claude via the TritonAI proxy and return the response text.

    TritonAI is the UCSD course provided LLM proxy. It speaks the OpenAI
    chat completions protocol but routes to Claude on the backend, so we
    use the openai Python SDK with a custom base_url. Reads
    TRITONAI_API_KEY from the environment.
    """
    from openai import OpenAI

    client = OpenAI(
        api_key=os.environ["TRITONAI_API_KEY"],
        base_url=TRITONAI_BASE_URL,
    )
    response = client.chat.completions.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False, indent=2),
            },
        ],
    )
    return response.choices[0].message.content or ""


def update_state_field(state: dict, skill_name: str, result: Any) -> dict:
    """Merge the skill result into the matching state field and set status."""
    field = SKILL_OUTPUT_FIELD.get(skill_name)
    if field is None:
        raise KeyError(f"No output field mapping for skill {skill_name!r}")
    state[field] = result
    after_status = SKILL_STATUS_AFTER.get(skill_name)
    if after_status is not None:
        state["status"] = after_status
    return state


def _is_automation(step_name: str) -> bool:
    """Check if a step lives in automations/ (no SKILL.md, no LLM)."""
    return (AUTOMATIONS_DIR / step_name).is_dir()


def _invoke_automation(step_name: str, state: dict) -> dict:
    """Run an automation deterministically using its helpers. No LLM call.

    Each automation has a helpers.py with pure Python functions. This
    dispatcher calls the right helper chain based on the step name and
    merges the result into the workflow state.
    """
    import importlib
    import sys

    helpers_path = AUTOMATIONS_DIR / step_name / "helpers.py"
    if not helpers_path.exists():
        raise FileNotFoundError(f"helpers.py not found at {helpers_path}")

    module_name = f"automations.{step_name.replace('-', '_')}.helpers"
    spec = importlib.util.spec_from_file_location(module_name, helpers_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)

    campaign = state.get("campaign", {})
    retrieved = _prefetch_rag(step_name, state)
    doc_ids = []
    for chunks in retrieved.values():
        for c in chunks:
            did = c.get("doc_id", "")
            if did and did not in doc_ids:
                doc_ids.append(did)

    if step_name == "localization-generator":
        regions = campaign.get("regions", [])
        category = campaign.get("category", "")
        discount_pct = campaign.get("discount_pct", 0)
        month = int(campaign.get("launch_month", 0)) or 6
        variants = []
        for region in regions:
            lang = mod.region_to_language(region)
            pricing = mod.apply_regional_pricing(discount_pct, region, category)
            holiday = mod.holiday_overlay(region, month)
            variants.append(
                {
                    "region": region,
                    "language": lang,
                    "pricing_note": pricing.get("pricing_note", ""),
                    "effective_discount_pct": pricing.get("effective_discount_pct", discount_pct),
                    "holiday_overlay": holiday,
                    "retrieved_docs": doc_ids,
                }
            )
        result = mod.assemble_variants(variants)

    elif step_name == "activation-scheduler":
        variants = state.get("localized_variants", [])
        if isinstance(variants, dict) and "localized_variants" in variants:
            variants = variants["localized_variants"]
        estimated_spend = campaign.get("estimated_spend", 0)
        launch_date = campaign.get("launch_date", "2026-06-01")
        per_region = []
        for v in variants if isinstance(variants, list) else []:
            region = v.get("region", "NY")
            tz = mod.region_to_timezone(region)
            per_region.append(
                {
                    "region": region,
                    "timezone": tz,
                    "email_send_utc": mod.compute_send_time(tz, launch_date),
                    "paid_social_window_local": mod.peak_social_window(tz),
                    "display_frequency_cap": mod.display_cap(estimated_spend, region),
                    "signage_window_local": mod.signage_window(tz),
                }
            )
        result = mod.assemble_schedule(per_region, doc_ids)

    else:
        raise ValueError(f"No automation dispatch logic for {step_name!r}")

    return update_state_field(state, step_name, result)


def _invoke_llm_skill(skill_name: str, state: dict) -> dict:
    """Run one LLM skill end to end and return the updated state.

    Steps:
      1. Load SKILL.md as the system prompt.
      2. Pre fetch RAG chunks and MCP tool data per SKILL_PREFETCH_CONFIG.
      3. Build a user payload with state, retrieved_context, tool_results,
         and a clear "return JSON only" instruction.
      4. Call Claude.
      5. Strip code fences, parse JSON.
      6. Merge into state via update_state_field, update status.
    """
    skill_md = _load_skill_markdown(skill_name)
    retrieved = _prefetch_rag(skill_name, state)
    tool_results = _prefetch_mcp(skill_name, state)
    user_payload = {
        "current_state": state,
        "retrieved_context": retrieved,
        "tool_results": tool_results,
        "instruction": (
            "Execute this skill according to the SKILL.md instructions. "
            "Use the retrieved_context and tool_results to inform your "
            "decisions. Return ONLY a JSON object that matches the Output "
            "schema in the SKILL.md. No commentary, no markdown fences."
        ),
    }
    text = _call_claude(skill_md, user_payload)
    cleaned = _strip_json_fences(text)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Skill {skill_name} returned non JSON response:\n{cleaned[:500]}") from exc
    return update_state_field(state, skill_name, result)


def invoke_skill(skill_name: str, state: dict) -> dict:
    """Run a step (skill or automation) and return the updated state.

    Dispatches to _invoke_automation if the step lives in automations/,
    otherwise to _invoke_llm_skill. This keeps the api/main.py call
    sites unchanged.
    """
    if _is_automation(skill_name):
        return _invoke_automation(skill_name, state)
    return _invoke_llm_skill(skill_name, state)
