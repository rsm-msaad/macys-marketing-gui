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
| `check_pricing_conflicts` | Step 3 (SKU lock-in) | Deterministic | Validates SKUs against MAP-enforced brands per PRICE-RULES-2026-001 |
| `check_pricing_conflicts` | Step 6a (compliance) | **Agentic** | Claude calls to verify pricing claims mid-reasoning |
| `check_pricing_conflicts` | Step 6b (brief) | **Agentic** | Claude may re-verify pricing for risk_flags |
| `find_dam_assets` | Step 4 (creative) | **Agentic** | Claude curates assets by reasoning about campaign mood, then calls tool |
| `generate_locale_variants` | Step 7 (localization) | **Agentic** | Claude reasons about cultural nuances per locale, then calls tool |

## Agentic vs Pre-fetch Skills

| Skill | Step | Mode | MCP Tools | Why Agentic |
|---|---|---|---|---|
| DAM Asset Curator | 4 | **Agentic** | find_dam_assets | Claude reasons about mood/brand/season before searching DAM |
| Layout Copy Generator | 5 | Pre-fetch | — | Creative generation, no tool verification needed |
| Compliance Pre Check | 6a | **Agentic** | check_pricing_conflicts | Claude decides when to verify pricing claims |
| Approval Brief Generator | 6b | **Agentic** | check_pricing_conflicts | Claude may verify pricing for risk_flags |
| Revision Router | 6c | Pre-fetch | — | Classification is text-only |
| Localization Strategist | 7 | **Agentic** | generate_locale_variants | Claude reasons about cultural nuances per locale |

All agentic skills pre-fetch RAG documents deterministically. Only MCP tool calls are agentic — Claude decides when and whether to call them. The agentic trace (reasoning + tool calls + results) is captured in the Evidence panel for full transparency.

## Component Tally

- **6 LLM Skills:** DAM Asset Curator, Layout Copy Generator, Compliance Pre Check, Approval Brief Generator, Revision Router, Localization Strategist
- **7 Deterministic Automations:** Audience Segment Builder, SKU Recommender, DAM Asset Finder (fallback), Localization Generator (fallback), Activation Scheduler, Campaign Performance Analyzer, Report Generator
- **3 MCP Tools:** check_pricing_conflicts, find_dam_assets, generate_locale_variants — all 3 fire agentically at Steps 4, 6a/6b, and 7
- **12 RAG Documents:** BRAND-GL through TEAM-FAQ in HyQ FAISS index (381 entries)
