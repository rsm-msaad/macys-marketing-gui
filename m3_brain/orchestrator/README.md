# orchestrator

Two orchestrators live here.

* **Option A**, the deterministic router. Walks a fixed routing table, pre fetches RAG and MCP context per skill, calls Claude once per skill, merges the result into state, repeats.
* **Option B**, the agentic version. Gives Claude 12 tools (5 skill invokers, 1 RAG retrieve, 3 MCP tools, 2 state tools, 1 request_human_input signal) and lets the model decide which to call next, in what order.

Both share the same underlying skills, MCP tools, RAG layer, and workflow state file. They are alternative front ends, not competing implementations.

## Option A, the deterministic router

## How it works

The orchestrator runs a tight loop:

1. Read [../data/workflow_state.json](../data/workflow_state.json).
2. Ask the routing table which skill should run next.
3. Pre fetch the RAG chunks and MCP tool data that skill needs.
4. Invoke the skill: load its SKILL.md, build a prompt, call Claude, parse the JSON response.
5. Merge the skill's output into the workflow state and write it back to disk.
6. Repeat until the routing table says "terminal" (no further skill) or `max_steps` is reached.

The orchestrator does not reason about the campaign. It does not write copy, judge approval decisions, or pick between options. It routes. The reasoning lives in each SKILL.md and runs inside the Claude call. The deterministic work (string scans, timezone math, MAP brand lookups) lives in the skill helpers and the MCP tools.

## The routing table

The routing rules live in [routing_table.py](routing_table.py). There are 8 rules, walked in priority order. The first rule whose predicate matches the state wins.

| Rule | Trigger | Next skill |
|------|---------|------------|
| Initial submission | status submitted_by_sarah and no compliance_check | compliance-pre-check |
| Compliance passed | compliance_check.recommended_action proceed and no approval_brief | approval-brief-generator |
| Compliance failed, return to Sarah | compliance_check.recommended_action revise (and status not already revision_in_progress) | terminal (await human) |
| VP approved | approval_decision approved and no localized_variants | localization-generator |
| VP requested revision | approval_decision revise and no revision_routing | revision-router |
| Localization done | localized_variants present and no activation_schedule | activation-scheduler |
| Activation schedule drafted | activation_schedule present and status not in_production | terminal (await coordinator) |
| Rejected | approval_decision rejected | terminal |

If no rule matches, the orchestrator stops with `no_rule_matched` as the terminal reason. That state is also legitimate: it is what you see after the approval brief is written but before a human sets `approval_decision`.

## The pre fetch pattern

For the safe baseline (Option A), the orchestrator pre fetches the context each skill needs and hands it to the model, rather than letting the model issue retrieval or MCP calls in a tool calling loop. Per skill config lives in `skill_invoker.SKILL_PREFETCH_CONFIG`.

Trade off:

* Pro: deterministic, easy to debug, no tool calling round trips, predictable token cost per skill.
* Con: less flexible than letting the model decide what to retrieve. If a skill needs context outside the standing query list, the model has to make do.

We accept the trade off for the M3 baseline. A future iteration (Option B) could expose RAG retrieval and the MCP tools as model callable tools and run a real tool use loop.

## Running the orchestrator

Prerequisites:

* `TRITONAI_API_KEY` set in [../.env](../) (see [../.env.example](../.env.example)). We call Claude through TritonAI, the UCSD course provided LLM proxy at `https://tritonai-api.ucsd.edu/v1`. The proxy speaks the OpenAI chat completions protocol on the wire, so the orchestrator uses the `openai` Python SDK with a custom base_url.
* RAG index built: `python -m rag.build_index`.
* Tools database seeded: `python tools/seed_db.py`.

Run from the repo root:

```
python -m orchestrator.orchestrator
```

Optional flags:

```
python -m orchestrator.orchestrator --state-path data/workflow_state.json --max-steps 10
```

## Seeding a fresh state

The workflow state mutates as the orchestrator runs. To re run the demo from scratch, reset to the starter campaign:

```
python -m orchestrator.seed_state
```

## Terminal states

The orchestrator stops in one of these states:

* `Compliance failed, return to Sarah`. The compliance pre check flagged fail level issues. Sarah revises the campaign and the orchestrator restarts from the top of the chain.
* `Activation schedule drafted`. The chain produced a schedule. The media coordinator reviews and confirms, then sets `status` to `in_production` (human action).
* `Rejected`. The VP rejected the campaign. The chain stops.
* `no_rule_matched`. No routing rule applies to the current state. This is what you see after the approval brief is written and the chain is waiting on a VP decision. It is also what you see if a state field is missing. Inspect the state to tell the difference.
* `max_steps_reached`. The hard stop. Increase `max_steps` if needed, but a runaway loop usually means a routing rule keeps matching after its skill already wrote its output.

## Option B, the agentic orchestrator

Option B replaces the fixed routing table with a Claude agent. The agent runs in a loop:

1. The agent reads the workflow state and the system prompt at [agent_system_prompt.md](agent_system_prompt.md).
2. The agent picks a tool to call from a registered set of 12 (see below).
3. The orchestrator executes the tool server side and feeds the result back into the conversation.
4. The agent decides what to do next: call another tool, or respond with a final text summary.
5. The loop is hard capped at 10 iterations to keep the run bounded.

The agent uses the OpenAI chat completions function calling protocol, routed through the TritonAI proxy. Each tool call is its own Claude turn, so a full chain typically costs 20 to 40 cents per run during testing.

### The 12 tools available to the agent

| Category | Tool | Purpose |
|----------|------|---------|
| Skill invokers | invoke_compliance_pre_check | Run skill 6a |
| | invoke_approval_brief_generator | Run skill 6b |
| | invoke_revision_router | Run skill 6c |
| | invoke_localization_generator | Run skill 7 |
| | invoke_activation_scheduler | Run skill 8 |
| RAG | retrieve_from_knowledge_base | Top k chunks from the 12 doc corpus |
| MCP | check_pricing_conflicts | Validate SKUs against MAP and stacking rules |
| | find_dam_assets | Lookup DAM assets by category and region |
| | generate_locale_variants | Simulated transcreation to es or fr-CA |
| State | read_workflow_state | Return the current state dict |
| | update_workflow_state | Write one top level field (use sparingly) |
| Control | request_human_input | Pause for a VP, Sarah, or coordinator decision |

### Running Option B

```
python -m orchestrator.agent
```

Optional flags:

```
python -m orchestrator.agent --state-path data/workflow_state.json --max-iterations 10 --quiet
```

The end to end integration test is at [../tests/test_agent_e2e.py](../tests/test_agent_e2e.py). Run it manually after setting `TRITONAI_API_KEY` in `.env`.

### Termination

The agent halts in one of three ways:

* It produces a final text response with no tool call. This is the clean exit.
* It calls `request_human_input` and the next turn forces a text response (we set `tool_choice="none"` after the signal).
* It hits the max iterations cap (10). The cap is a safety net, the agent should never hit it on the starter campaign.

After every run, the final workflow state is saved to disk and a transcript is returned listing every tool call and result.

### When to use Option A vs Option B

* **Option A** for predictable demos, deterministic grading, and any case where a buggy model response would be expensive. The routing table is auditable.
* **Option B** for the agentic narrative, the wow factor, and any case where you want the model to reason about what to retrieve and which skill to run next. Use when context matters more than determinism.

### Files for Option B

| File | Purpose |
|------|---------|
| [agent.py](agent.py) | Agent loop and CLI |
| [agent_schemas.py](agent_schemas.py) | OpenAI function calling tool definitions |
| [agent_tools.py](agent_tools.py) | Tool registry, closures over state |
| [agent_system_prompt.md](agent_system_prompt.md) | Role, workflow logic, rules, termination guidance |

## Files in this folder

| File | Purpose |
|------|---------|
| [__init__.py](__init__.py) | Package marker |
| [routing_table.py](routing_table.py) | (Option A) 8 routing rules plus `pick_next_skill` |
| [skill_invoker.py](skill_invoker.py) | Load SKILL.md, pre fetch RAG and MCP, call Claude, parse JSON, merge |
| [orchestrator.py](orchestrator.py) | (Option A) main loop and CLI |
| [seed_state.py](seed_state.py) | Reset the workflow state to the starter campaign |
| [agent.py](agent.py) | (Option B) agent loop and CLI |
| [agent_schemas.py](agent_schemas.py) | (Option B) OpenAI tool schemas |
| [agent_tools.py](agent_tools.py) | (Option B) tool registry |
| [agent_system_prompt.md](agent_system_prompt.md) | (Option B) agent system prompt |
| [README.md](README.md) | This file |
