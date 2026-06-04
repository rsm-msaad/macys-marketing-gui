"""
Skill invoker for the M4 orchestrator.

Two invocation patterns:

**Pre-fetch (non-agentic):** Loads SKILL.md, pre-fetches RAG context and
MCP tool data, builds a single prompt, calls Claude, parses JSON. The
model receives context already retrieved. Used by Layout Copy Generator,
Revision Router, Localization Generator, Activation Scheduler.

**Agentic:** Loads SKILL.md, pre-fetches RAG context (deterministic), but
gives Claude the MCP tools as callable functions. Claude decides when and
whether to call check_pricing_conflicts, find_dam_assets, or
generate_locale_variants mid-reasoning. A mini loop (capped at 5
iterations) handles tool call dispatch. Used by Compliance Pre Check and
Approval Brief Generator.

Skills opt in to agentic mode via `agentic: true` in their SKILL.md
frontmatter.
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

# Per-skill model overrides. Skills not listed use CLAUDE_MODEL.
# Brief generation is structured output that doesn't need claude-opus
# quality — api-llama-4-scout is fast and available on On-Prem Instructional.
SKILL_MODEL_OVERRIDE: dict[str, str] = {
    "compliance-pre-check": "claude-sonnet-4-6",
    "approval-brief-generator": "claude-sonnet-4-6",
}


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
        # MCP calls removed: now handled agentically by Claude via tool calling.
        # Claude decides when to call check_pricing_conflicts mid-reasoning.
        "mcp_calls": [],
    },
    "approval-brief-generator": {
        "rag_queries": [
            "{campaign.audience_segment} campaign retro performance benchmarks",
        ],
        "mcp_calls": [],
    },
    "layout-copy-generator": {
        "rag_queries": [
            "brand voice guidelines and approved taglines for campaign copy",
        ],
        "mcp_calls": [],
    },
    "report-generator": {
        "rag_queries": [
            "campaign retro performance benchmarks",
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
    "layout-copy-generator": "layout_copy",
    "report-generator": "executive_report",
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
    "layout-copy-generator": "layout_complete",
    "report-generator": "report_complete",
    "revision-router": "revision_requested",
    "localization-generator": "in_localization",
    "activation-scheduler": "scheduled",
}

# MCP tool registry. Populated lazily on first access to avoid importing
# the tools package at module load time.
_MCP_TOOLS: dict[str, Callable[..., dict]] | None = None


def _get_mcp_tools() -> dict[str, Callable[..., dict]]:
    """Load MCP tool implementations.

    check_pricing_conflicts uses data/macys.db sku_catalog (the same
    2,000-SKU source as the SKU Recommender) and the canonical
    _is_map_brand() function, NOT the legacy macys_m3.db 21-SKU table.
    """
    global _MCP_TOOLS
    if _MCP_TOOLS is None:
        import sqlite3

        # Import from ai_engine/tools/ — add parent to path if needed
        import sys as _sys
        _ai_root = str(Path(__file__).resolve().parent.parent)
        if _ai_root not in _sys.path:
            _sys.path.insert(0, _ai_root)
        from tools import find_dam_assets, generate_locale_variants

        _DATA_DB = Path(__file__).resolve().parent.parent.parent / "data" / "macys.db"

        def _check_pricing_via_main_db(
            sku_ids: list[str],
            proposed_discount_pct: float,
        ) -> dict:
            """Check pricing conflicts against data/macys.db sku_catalog."""
            # Lazy import to avoid circular dependency at module load
            import importlib.util as _ilu

            rec_path = AUTOMATIONS_DIR / "sku-recommender" / "recommend.py"
            spec = _ilu.spec_from_file_location("_rec", rec_path)
            rec_mod = _ilu.module_from_spec(spec)
            spec.loader.exec_module(rec_mod)

            conn = sqlite3.connect(str(_DATA_DB))
            conn.row_factory = sqlite3.Row
            conflicts: list[dict] = []
            try:
                for sid in sku_ids:
                    row = conn.execute(
                        "SELECT sku_id, product_name, brand FROM sku_catalog WHERE sku_id = ?",
                        (sid,),
                    ).fetchone()
                    if row is None:
                        conflicts.append({"sku_id": sid, "issue": "SKU not found in catalog.", "severity": "fail"})
                        continue
                    brand = str(row["brand"])
                    if rec_mod._is_map_brand(brand):
                        if (proposed_discount_pct / 100.0) > rec_mod.DEFAULT_MAP_FLOOR_PCT:
                            conflicts.append({
                                "sku_id": sid,
                                "brand": brand,
                                "issue": (
                                    f"Brand {brand} is MAP-enforced per PRICE-RULES-2026-001. "
                                    f"Proposed {proposed_discount_pct:.0f}% discount exceeds "
                                    f"MAP floor of {rec_mod.DEFAULT_MAP_FLOOR_PCT * 100:.0f}%."
                                ),
                                "severity": "fail",
                            })
            finally:
                conn.close()

            if any(c["severity"] == "fail" for c in conflicts):
                status = "fail"
            elif conflicts:
                status = "warn"
            else:
                status = "pass"
            return {"status": status, "conflicts": conflicts, "checked_count": len(sku_ids)}

        _MCP_TOOLS = {
            "check_pricing_conflicts": _check_pricing_via_main_db,
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


def _extract_json_from_text(text: str) -> str:
    """Extract a JSON object from text that may contain reasoning around it.

    Tries three strategies in order:
    1. If the text starts with '{', treat as pure JSON (fast path).
    2. Extract content between ```json ... ``` fences.
    3. Find the first '{' ... last '}' span (greedy brace match).

    Returns the extracted JSON string for parsing.
    """
    stripped = text.strip()

    # Fast path: pure JSON
    if stripped.startswith("{"):
        return stripped

    # Strategy 2: markdown fences
    fence_match = re.search(r"```(?:json)?\s*\n(.*?)```", stripped, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()

    # Strategy 3: first { to last }
    first_brace = stripped.find("{")
    last_brace = stripped.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        return stripped[first_brace : last_brace + 1]

    # Give up — return as-is for the caller to handle
    return stripped


def _model_for_skill(skill_name: str) -> str:
    """Return the model to use for a skill, checking per-skill overrides."""
    return SKILL_MODEL_OVERRIDE.get(skill_name, CLAUDE_MODEL)


def _call_claude(system: str, user_payload: dict, skill_name: str = "") -> str:
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
    model = _model_for_skill(skill_name)
    response = client.chat.completions.create(
        model=model,
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


# ---- Agentic tool calling support ----
# MCP tools exposed to Claude during agentic skill execution. These are
# the same 3 tools available via the MCP server, described in the OpenAI
# function calling format so Claude can call them mid-reasoning.

AGENTIC_MCP_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "check_pricing_conflicts",
            "description": (
                "Check a list of SKUs against MAP enforced brand rules "
                "(Lancome, Estee Lauder, Clinique, La Mer, Dior, Tag Heuer, "
                "Coach, Michael Kors, Kate Spade, Levi's, Calvin Klein, "
                "Tommy Hilfiger, Cole Haan, Ralph Lauren) and the 50 percent "
                "stacking ceiling per PRICE-RULES-2026-001. Call this tool "
                "when you need to verify whether specific SKUs in the campaign "
                "have pricing conflicts before issuing a compliance finding."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sku_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "SKU identifiers to check.",
                    },
                    "proposed_discount_pct": {
                        "type": "number",
                        "description": "Proposed discount percentage (e.g. 25 for 25% off).",
                    },
                },
                "required": ["sku_ids", "proposed_discount_pct"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_dam_assets",
            "description": (
                "Look up DAM assets matching a category and region with "
                "active model release rights. Call this when you need to "
                "verify asset availability for a specific region."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "region": {"type": "string"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["category", "region"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_locale_variants",
            "description": (
                "Produce a localized variant of campaign copy in Spanish "
                "(es) or Quebec French (fr-CA). Call when you need to verify "
                "transcreation quality."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "copy": {"type": "string"},
                    "target_language": {"type": "string", "enum": ["es", "fr-CA"]},
                },
                "required": ["copy", "target_language"],
            },
        },
    },
]

AGENTIC_MAX_ITERATIONS = 5


def _is_agentic_skill(skill_md: str) -> bool:
    """Check if SKILL.md declares agentic: true in its frontmatter."""
    # Look for YAML-style frontmatter between --- delimiters
    if skill_md.startswith("---"):
        end = skill_md.find("---", 3)
        if end != -1:
            frontmatter = skill_md[3:end].lower()
            return "agentic: true" in frontmatter or "agentic:true" in frontmatter
    # Also check for inline declaration
    first_lines = skill_md[:500].lower()
    return "agentic: true" in first_lines


def _invoke_agentic_skill(skill_name: str, state: dict) -> dict:
    """Run an agentic LLM skill with tool calling.

    RAG context is pre-fetched deterministically. MCP tools are given to
    Claude as callable functions. Claude decides when to call them.
    Returns the updated state with the skill result and an agentic_trace.
    """
    from openai import OpenAI

    skill_md = _load_skill_markdown(skill_name)
    retrieved = _prefetch_rag(skill_name, state)
    tools = _get_mcp_tools()

    # Build initial messages
    system_prompt = skill_md + (
        "\n\n## Available MCP Tools\n\n"
        "You have access to the following MCP tools. Call them when you need "
        "to verify data before making a finding. Do NOT guess — if you are "
        "uncertain about a pricing claim, call check_pricing_conflicts. "
        "If you need to verify asset availability, call find_dam_assets.\n\n"
        "After your analysis is complete, respond with ONLY a JSON object "
        "matching the Output schema. No commentary, no markdown fences."
    )

    user_payload = {
        "current_state": state,
        "retrieved_context": retrieved,
        "instruction": (
            "Execute this skill. You have MCP tools available to call if you "
            "need to verify pricing conflicts, DAM assets, or locale variants. "
            "Call tools when verification would strengthen your findings. "
            "When done, return ONLY the JSON output schema."
        ),
    }

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False, indent=2)},
    ]

    client = OpenAI(
        api_key=os.environ.get("TRITONAI_API_KEY", ""),
        base_url=TRITONAI_BASE_URL,
    )
    skill_model = _model_for_skill(skill_name)

    agentic_trace: list[dict[str, Any]] = []

    for iteration in range(1, AGENTIC_MAX_ITERATIONS + 1):
        response = client.chat.completions.create(
            model=skill_model,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            messages=messages,
            tools=AGENTIC_MCP_TOOLS,
            tool_choice="auto",
        )

        choice = response.choices[0]
        msg = choice.message

        # Capture any reasoning text Claude produced before/alongside tool calls
        reasoning_text = msg.content or ""

        # If no tool calls, this is the final response
        if not msg.tool_calls:
            # Record final reasoning in trace
            if reasoning_text:
                agentic_trace.append({
                    "iteration": iteration,
                    "type": "final_response",
                    "reasoning": reasoning_text,
                })
            break

        # Process tool calls
        # Add assistant message with tool calls to conversation
        messages.append({
            "role": "assistant",
            "content": reasoning_text or None,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ],
        })

        for tc in msg.tool_calls:
            tool_name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            # Dispatch to MCP tool
            tool_fn = tools.get(tool_name)
            if tool_fn is None:
                tool_result = {"error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    tool_result = tool_fn(**args)
                except Exception as exc:
                    tool_result = {"error": str(exc)}

            # Record in agentic trace
            agentic_trace.append({
                "iteration": iteration,
                "type": "tool_call",
                "reasoning_before": reasoning_text,
                "tool_name": tool_name,
                "tool_input": args,
                "tool_output": tool_result,
            })

            # Append tool result to conversation
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(tool_result, ensure_ascii=False, default=str),
            })

    # Extract final text (from the last iteration's response)
    final_text = reasoning_text
    cleaned = _extract_json_from_text(final_text)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        # Graceful fallback: return a placeholder that the UI can render
        # without crashing, flagged for human review.
        import logging
        logging.warning(
            "Agentic skill %s returned non-JSON after %d iterations. "
            "Raw response (first 500 chars): %s",
            skill_name, iteration, final_text[:500],
        )
        result = {
            "brand_alignment": {"status": "warn", "reason": "Agentic analysis could not be parsed. Needs human review.", "cited_doc": "N/A"},
            "disclaimers": {"status": "warn", "reason": "Agentic analysis could not be parsed. Needs human review.", "cited_doc": "N/A"},
            "pricing_cross_check": {"status": "warn", "reason": "Agentic analysis could not be parsed. Needs human review.", "cited_doc": "N/A"},
            "recommended_action": "revise",
            "retrieved_docs": [],
            "_parse_error": True,
            "_raw_response": final_text[:1000],
        }

    # Attach agentic trace to the result for evidence capture
    result["_agentic_trace"] = agentic_trace
    result["_agentic_iterations"] = iteration
    result["_agentic_tool_calls"] = sum(1 for t in agentic_trace if t["type"] == "tool_call")

    return update_state_field(state, skill_name, result)


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
    text = _call_claude(skill_md, user_payload, skill_name=skill_name)
    cleaned = _strip_json_fences(text)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        # For layout-copy-generator, fall back to deterministic copy so a
        # vague brief produces valid output instead of crashing the skill.
        if skill_name == "layout-copy-generator":
            import importlib.util as _ilu

            _hp = SKILLS_DIR / "layout-copy-generator" / "helpers.py"
            _sp = _ilu.spec_from_file_location("_layout_fallback", _hp)
            _mod = _ilu.module_from_spec(_sp)
            _sp.loader.exec_module(_mod)
            campaign = state.get("campaign", {})
            result = _mod.generate_fallback(campaign)
        else:
            raise ValueError(f"Skill {skill_name} returned non JSON response:\n{cleaned[:500]}") from exc
    return update_state_field(state, skill_name, result)


def invoke_skill(skill_name: str, state: dict) -> dict:
    """Run a step (skill or automation) and return the updated state.

    Dispatches to:
      - _invoke_automation for deterministic automations (no LLM)
      - _invoke_agentic_skill for skills with agentic: true in SKILL.md
      - _invoke_llm_skill for standard pre-fetch skills
    """
    if _is_automation(skill_name):
        return _invoke_automation(skill_name, state)

    # Check if the skill opts into agentic mode
    skill_md = _load_skill_markdown(skill_name)
    if _is_agentic_skill(skill_md):
        return _invoke_agentic_skill(skill_name, state)

    return _invoke_llm_skill(skill_name, state)
