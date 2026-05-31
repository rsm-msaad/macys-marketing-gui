# Milestone 04: Macy's AI Coworker

**Team:** Merna Saad, Abdullah AlJarallah, Shankar D.
**Course:** MGT 449: GenAI for Business

See the root README.md for architecture and setup instructions.
See the M4 deliverables at the repo root: human_review_plan.md, evidence_and_sources.md, estimates.md, failure_cases.md, test_report.md, process_redesign.md.

Live app: https://macysai.vercel.app

## Data Flow Architecture

Every step reads from upstream step outputs and passes results downstream.
Cascade invalidation clears all downstream outputs when any step is rerun, edited, or rejected.

```
Step 1 (Brief) → step_outputs["1"]
    ↓ category, objective
Step 2 (Segmentation) → step_outputs["2"]
    ↓ segment.name, segment.top_category
Step 3 (SKU Selection) → step_outputs["3"]  ← MCP: check_pricing_conflicts
    ↓ approved_skus, segment_top_category
Step 4 (Creative Production) → step_outputs["4"]  ← MCP: find_dam_assets
    ↓ approved_assets, category
Step 5 (Layout Assembly) → step_outputs["5"]
    ↓ placements (tagline, body, CTA per placement)
Step 6a (Compliance) → evidence["6a"]  ← reads actual copy from Step 5 + SKUs from Step 3
Step 6b (Approval Brief) → evidence["6b"]  ← reads copy, SKUs, segment from upstream
Step 7 (Localization) → step_outputs["7"]  ← MCP: generate_locale_variants (es + fr-CA)
    ↓ variant_count, regions
Step 8 (Activation) → step_outputs["8"]  ← reads locale variants from Step 7
Step 9 (Monitoring) → step_outputs["9"]  ← reads segment + SKUs from Steps 2-3
Step 10 (Reporting) → step_outputs["10"]  ← reads ALL upstream steps 2-9
```

## MCP Tool Firing Points

| MCP Tool | Fires At | Mode | Purpose |
|---|---|---|---|
| `check_pricing_conflicts` | Step 3 (SKU lock-in) | Python helper | Validates SKUs against MAP-enforced brands per PRICE-RULES-2026-001 |
| `check_pricing_conflicts` | Step 6a (compliance) | **MCP — Agentic** | Claude calls mid-reasoning to verify pricing claims |
| `check_pricing_conflicts` | Step 6b (brief) | **MCP — Agentic** | Claude may re-verify pricing for risk_flags |
| `find_dam_assets` | Step 4 (creative) | Python helper (MCP-registered) | DAM lookup with rights filtering and relevance scoring |
| `generate_locale_variants` | Step 7 (localization) | Python helper (MCP-registered) | Phrase-level transcreation to Spanish and Quebec French |

## Agentic vs Deterministic

We follow the principle: **deterministic where rules are enough, agentic where judgment matters.**

| Step | Component | Mode | Why |
|---|---|---|---|
| 4 | DAM Asset Finder | **Automation** | Tag matching and rights filtering is deterministic scoring |
| 5 | Layout Copy Generator | **Skill** (pre-fetch, Claude) | Claude generates copy; deterministic fallback if API unavailable |
| 6a | Compliance Pre Check | **Skill** (agentic) | Claude decides when to call check_pricing_conflicts based on campaign context |
| 6b | Approval Brief Generator | **Skill** (agentic) | Claude may call check_pricing_conflicts to verify pricing flags |
| 6c | Revision Router | **Skill** (pre-fetch) | Classification is text-only, no tool needed |
| 7 | Localization Generator | **Automation** | Phrase substitution is a lookup table, not judgment |
| 10 | Report Generator | **Skill** (pre-fetch, Claude) | Claude writes executive summary from full audit trail |

Agentic skills pre-fetch RAG documents deterministically. Only MCP tool calls at Steps 6a/6b are agentic. The agentic trace (Claude's reasoning + tool calls + results) is captured in the Evidence panel.

## Component Tally

- **5 LLM Skills (all verified calling Claude via TritonAI):**
  - Layout Copy Generator (pre-fetch, Step 5)
  - Compliance Pre Check (agentic, Step 6a)
  - Approval Brief Generator (agentic, Step 6b)
  - Revision Router (pre-fetch, Step 6c)
  - Report Generator (pre-fetch, Step 10)
- **6 Deterministic Automations:** Audience Segment Builder, SKU Recommender, DAM Asset Finder, Localization Generator, Activation Scheduler, Campaign Performance Analyzer
- **3 MCP Tools:**
  - `check_pricing_conflicts` — agentic at Steps 6a/6b (Claude decides when to call), also used as Python helper at Step 3
  - `find_dam_assets` — MCP-registered, called as deterministic Python helper at Step 4
  - `generate_locale_variants` — MCP-registered, called as deterministic Python helper at Step 7
- **12 RAG Documents:** BRAND-GL through TEAM-FAQ in HyQ FAISS index (381 entries)
