"""
OpenAI function calling schemas for the agentic orchestrator (Option B).

The TOOLS constant is a list of tool definitions in the OpenAI chat
completions function calling format. Each entry has a type, function
name, description (read by the model to decide when to call), and a
JSON schema for the parameters.

The agent loop in orchestrator.agent reads this list and registers the
matching Python implementations from orchestrator.agent_tools. Keep the
two files in sync.
"""

from __future__ import annotations

from typing import Any


TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "invoke_compliance_pre_check",
            "description": (
                "Run the compliance pre check skill on the current campaign. "
                "Step 6a of the workflow. Pre fetches the relevant brand, "
                "legal, and pricing context, calls the check_pricing_conflicts "
                "MCP tool, then writes a compliance_check object to state with "
                "brand_alignment, disclaimers, pricing_cross_check, and "
                "recommended_action (proceed or revise). Run this first on a "
                "newly submitted campaign."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_approval_brief_generator",
            "description": (
                "Run the approval brief generator skill. Step 6b. Produces a "
                "five field VP brief (campaign_goal, target_audience, "
                "expected_roi, risk_flags, ai_recommendation). Run after the "
                "compliance check returns recommended_action proceed."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_revision_router",
            "description": (
                "Run the revision router skill. Step 6c. Parses the VP "
                "revision_comment from state, classifies the change type "
                "(copy, imagery, targeting, pricing, legal, localization), "
                "and routes to the right owner. Run when approval_decision "
                "is revise."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_localization_generator",
            "description": (
                "Run the localization generator skill. Step 7. Produces "
                "regional variants of an approved campaign with language and "
                "DAM assets per region. Run when approval_decision is "
                "approved."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_activation_scheduler",
            "description": (
                "Run the activation scheduler skill. Step 8. Drafts a channel "
                "schedule per region with timezone aware send times. Run "
                "after localized_variants is populated."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "retrieve_from_knowledge_base",
            "description": (
                "Retrieve relevant chunks from the 12 document Macys "
                "knowledge base (brand guidelines, approval policy, legal "
                "disclaimers, pricing rules, DAM tagging, localization, past "
                "tickets, compliance examples, internal FAQ). Use this when "
                "you need policy or precedent before making a recommendation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language query string.",
                    },
                    "k": {
                        "type": "integer",
                        "description": "Number of chunks to return (default 4).",
                        "default": 4,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_pricing_conflicts",
            "description": (
                "Check a list of SKUs against MAP enforced brand rules and "
                "the 50 percent stacking ceiling. MCP tool. Returns conflicts "
                "with severity for each SKU."
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
                        "description": ("Proposed discount percentage, for example 40 for 40 percent off."),
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
                "active model release rights. MCP tool. Returns asset IDs "
                "with filenames and tag lists."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": ("Top level category (Beauty, Apparel, Home, etc)."),
                    },
                    "region": {
                        "type": "string",
                        "description": ("Region code (NY, CA, FL, TX, PR, QC, etc)."),
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 5,
                    },
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
                "Produce a simulated transcreation of campaign copy into "
                "Spanish (es) or Quebec French (fr-CA). MCP tool. Does not "
                "call an external translation API."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "copy": {"type": "string"},
                    "target_language": {
                        "type": "string",
                        "enum": ["es", "fr-CA"],
                    },
                },
                "required": ["copy", "target_language"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_workflow_state",
            "description": (
                "Return the current workflow state dict. Use this when you "
                "need to inspect the most recent state, especially after "
                "running a skill."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_workflow_state",
            "description": (
                "Write a single top level field in the workflow state. Use "
                "sparingly. The skills normally write their own outputs. "
                "Typical valid fields: approval_decision (only after a human "
                "VP has decided), status."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "description": "Top level state field name.",
                    },
                    "value": {
                        "description": ("New value. May be a string, object, or null."),
                    },
                },
                "required": ["field", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_human_input",
            "description": (
                "Signal that the workflow needs a human action before it can "
                "proceed (the VP must decide approve, revise, or reject, or "
                "Merna must revise a flagged campaign, or the media "
                "coordinator must confirm a schedule). Call this when you "
                "have done all the automated work for the current stage. "
                "After calling, produce a final text summary in your next "
                "response and stop."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": ("One sentence reason explaining what the human needs to do."),
                    },
                },
                "required": ["reason"],
            },
        },
    },
]
