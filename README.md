# Macy's AI Coworker

An AI coworker for Macy's campaign managers that walks marketing campaigns through a 10 step workflow, using LLM judgment only where genuinely needed and deterministic Python everywhere else.

|  |  |
| --- | --- |
| **App** | [macysai.vercel.app](https://macysai.vercel.app) |
| **Storyboard** | [macysai.vercel.app/story](https://macysai.vercel.app/story) |
| **RAG Comparison** | [macysai.vercel.app/rag-compare](https://macysai.vercel.app/rag-compare) |
| **Eval Dashboard** | [macysai.vercel.app/evals](https://macysai.vercel.app/evals) |
| **Team** | Merna Saad, Abdullah AlJarallah, Shankar D. |
| **Course** | MGT 449: GenAI for Business |

## What This Project Does

A Macy's campaign manager (persona: Merna) opens the app, picks a campaign, and steps through a 10 stage workflow. Each step is either a human task, a deterministic automation, or one of five LLM-powered skills. Three handle Step 6 (compliance checking, approval brief writing, and revision routing), one drafts layout copy at Step 5, and one generates the executive report at Step 10. The remaining steps are deterministic automations. The result is a production grade demo where the professor can see the full lifecycle of a marketing campaign: brief, segment, select SKUs, produce creative, assemble layouts, approve, localize, activate, monitor performance, and report. Three seeded campaigns let you view an active campaign with live AI, a completed campaign with all outputs, and a planned campaign with partial progress.

## Architecture at a Glance

```
Browser (Next.js on Vercel)
   |
   v
FastAPI backend (Render)
   |
   +--- GUI state (in memory campaign workflow, 10 steps)
   |
   +--- AI engine
   |      |
   |      +--- 5 Skills (LLM judgment via TritonAI / Claude)
   |      |      compliance-pre-check
   |      |      approval-brief-generator
   |      |      revision-router
   |      |      layout-copy-generator
   |      |      report-generator
   |      |
   |      +--- 7 Automations (deterministic Python)
   |      |      audience-segment-builder
   |      |      dam-asset-finder
   |      |      localization-generator-v1
   |      |      localization-generator
   |      |      activation-scheduler
   |      |      campaign-performance-analyzer
   |      |
   |      +--- 3 MCP tools (FastMCP)
   |      |      check_pricing_conflicts
   |      |      find_dam_assets
   |      |      generate_locale_variants
   |      |
   |      +--- RAG corpus (12 docs, FAISS, sentence-transformers)
   |      |      Naive index: 78 chunks
   |      |      HyQ index:   381 entries (78 chunks + 303 questions)
   |      |
   |      +--- Orchestrator (8 deterministic routing rules)
   |
   +--- SQLite database (macys.db: 50K customers, 2K SKUs across 5 categories, 5K DAM assets)
   |
   +--- Eval suite (DeepEval, 67 tests, Claude as judge)
```

## Workflow Navigation Table

Every row maps a workflow step to its implementation, data source, and RAG documents.

| Step | Name | Type | Reads From | MCP Tool | RAG Docs |
| --- | --- | --- | --- | --- | --- |
| 1 | Briefing | Human | — | — | — |
| 2 | Segmentation | Automation | Step 1 brief (category) | — | — |
| 3 | SKU Selection | Automation + Human | Step 2 segment (top_category), macys.db sku_catalog (2K SKUs) | **check_pricing_conflicts** | — |
| 4 | Creative Production | Automation + Human | Step 3 SKUs, brief category | **find_dam_assets** | — |
| 5 | Layout Assembly | Skill + Human | Steps 2-4 (segment, SKUs, assets) | — | — |
| 6a | Compliance Pre Check | **Skill** | Step 5 copy, Step 3 SKUs | check_pricing_conflicts (via invoker) | BRAND-GL, LEGAL-DIS, PRICE-RULES, COMP-EX |
| 6b | Approval Brief Generator | **Skill** | Steps 2-5 + 6a compliance | — | RETRO-Q4, RETRO-SP-BTY |
| 6c | Revision Router | **Skill** | VP comment + campaign context | — | TICKET-INC-4471, TICKET-INC-0212 |
| 7 | Localization | Automation | Step 5 copy, Step 3 SKUs | **generate_locale_variants** (es + fr-CA) | LOC-STYLE-2025-002 |
| 8 | Activation | Automation | Step 7 locale variants | — | — |
| 9 | Monitoring | Automation | Steps 2-3 (segment, SKUs) | — | RETRO-Q4, RETRO-SP-BTY |
| 10 | Reporting | AI + Human | **All steps 2-9** | — | — |

## The 5 Skills (LLM Judgment)

Skills are the only place in the workflow where an LLM is called. Each skill has a `SKILL.md` that defines the prompt contract and output schema.

### Compliance Pre Check

| Field | Value |
| --- | --- |
| **Purpose** | Scan campaign copy, taglines, and pricing claims for policy violations |
| **Location** | `ai_engine/skills/compliance-pre-check/SKILL.md` |
| **Helpers** | `ai_engine/skills/compliance-pre-check/helpers.py` |
| **Inputs** | `campaign_id`, `title`, `copy`, `tagline`, `skus`, `discount_pct`, `regions` |
| **Outputs** | `compliance_check` with three findings: `brand_alignment`, `disclaimers`, `pricing_cross_check` |
| **Recommended action** | `proceed` if all pass, `revise` if any fail |
| **RAG docs** | BRAND-GL-2026-001 (banned words, approved taglines), LEGAL-DIS-2026-002 (disclaimer requirements), PRICE-RULES-2026-001 (MAP and stacking rules), COMP-EX-2026-001 (compliance flag examples) |
| **MCP tool** | `check_pricing_conflicts` (validates SKUs against MAP list) |

Helper functions: `scan_for_banned_words()`, `check_tagline()`, `check_pricing_language()`, `evaluate_recommended_action()`, `assemble_report()`.

### Approval Brief Generator

| Field | Value |
| --- | --- |
| **Purpose** | Write a prose approval brief for the VP, summarizing campaign goal, audience, expected ROI, and risk flags |
| **Location** | `ai_engine/skills/approval-brief-generator/SKILL.md` |
| **Helpers** | `ai_engine/skills/approval-brief-generator/helpers.py` |
| **Inputs** | Campaign block + `compliance_check` from Step 6a |
| **Outputs** | `approval_brief` with 5 fields: `campaign_goal`, `target_audience`, `expected_roi`, `risk_flags`, `ai_recommendation` |
| **RAG docs** | RETRO-SP-2025-BTY (Spring 2025 Beauty retro), RETRO-Q4-2025 (Q4 2025 Holiday retro) |

Helper functions: `extract_roi_benchmark()`, `decide_recommendation()`, `assemble_brief()`.

### Revision Router

| Field | Value |
| --- | --- |
| **Purpose** | Parse free text VP revision comments into structured routing: who should fix it, what type of change, how urgent |
| **Location** | `ai_engine/skills/revision-router/SKILL.md` |
| **Helpers** | `ai_engine/skills/revision-router/helpers.py` |
| **Inputs** | `revision_comment` + campaign context |
| **Outputs** | `revision_routing` with `change_type`, `owner`, `urgency`, `one_line_summary` |
| **RAG docs** | TICKET-INC-2025-4471 (past revision ticket with MAP fix), TICKET-INC-2026-0212 (clean approval reference) |

Owner mapping: copy to Merna, imagery to Abdullah, targeting to Merna, pricing to Merchandising/Anna, legal to Legal team, localization to Shankar.

Urgency rules: high = spend > $500K AND <= 5 days to launch, medium = either condition alone, low = neither.

## The 7 Automations (Deterministic)

No LLM is called. Automations use math, lookups, and templates.

| Automation | Purpose | Key Input | Key Output | Why Not a Skill |
| --- | --- | --- | --- | --- |
| Audience Segment Builder | k-means clustering on RFM features | `data/macys.db` (50K customers) | 3 segments with profiles | Math: k-means is deterministic |
| SKU Recommender | Score and rank SKUs by inventory, margin, vendor, season | `data/macys.db` sku_catalog (2,000 SKUs, 5 categories) | Top 18 ranked SKUs with MAP exclusions | Deterministic scoring formula |
| DAM Asset Finder | Score and rank DAM images by relevance | Campaign brief + `data/macys.db` | Top 12 assets with quality flags | Scoring rules, no judgment needed |
| Localization Generator v1 | Generate 40 regional/placement variants | Approved SKUs + 10 regions x 4 placements | Variant matrix with copy and dimensions | Template expansion, no creativity |
| Localization Generator | Region/language mapping, pricing overrides | Region codes | Language, pricing multiplier, holidays | Lookup table, deterministic |
| Activation Scheduler | Timezone math and send time computation | Region + channel | Send times with frequency caps | Timezone arithmetic, no judgment |
| Campaign Performance Analyzer | Last touch attribution + linear regression forecast | `data/macys.db` (campaign history) | Revenue, ROAS, forecast with 80% CI | Statistical model, reproducible |

## The 3 MCP Tools

All 3 tools are exposed on a FastMCP server (`mcp_servers/macys_marketing.py`, also at `ai_engine/mcp_server/server.py`) launchable via the root `.mcp.json` and callable by any MCP client. At runtime, `check_pricing_conflicts` is invoked through the MCP protocol (stdio transport) with a direct call fallback if the server cannot launch; the protocol path is controlled by the `MCP_PROTOCOL_PRICING` environment variable (defaults to on). `find_dam_assets` and `generate_locale_variants` are called directly as Python functions while remaining available over the protocol for external MCP clients.

### check_pricing_conflicts

Validates SKU list against MAP (minimum advertised price) rules.

```
Input:  sku_ids: list[int], proposed_discount_pct: float
Output: { status: "pass"|"warn"|"fail", conflicts: [...], checked_count: int }
```

MAP enforced brands: Levi's, Coach, Lancome, Estee Lauder, Clinique, La Mer, Dior Beauty, Tag Heuer. Flags any combined promo + proposed discount exceeding 50%.

Used by: **Step 3** (SKU lock-in, via `/skills/check-pricing`) and **Steps 6a/6b** (compliance, invoked agentically by Claude mid-reasoning).

### find_dam_assets

DAM lookup by category and region with active rights filter.

```
Input:  category: str, region: str, max_results: int = 5
Output: { status: str, assets: [...], result_count: int }
```

Filters out expired model releases. Returns ranked assets by relevance.

Used by: **Step 4** (Creative Production, via `/skills/find-dam-assets`).

### generate_locale_variants

Simulated transcreation to Spanish or Quebec French.

```
Input:  copy: str, target_language: "es"|"fr-CA", regional_pricing: dict | None
Output: { localized_copy: str, flags: [...] }
```

Uses a 40+ phrase substitution table for Macy's marketing patterns. Does not call an external translation API.

Used by: **Step 7** (Localization, via `/skills/generate-locale-variants`, 2 calls: es + fr-CA).

## RAG Knowledge Base

12 proprietary Macy's documents (simulated) stored as markdown in `ai_engine/rag/knowledge_base/`.

| # | File | Doc ID | Description |
| --- | --- | --- | --- |
| 1 | `01_brand_guidelines.md` | BRAND-GL-2026-001 | Banned words, approved taglines for campaign copy |
| 2 | `02_approval_policy.md` | APPROVAL-POLICY-2026-001 | Campaign approval workflow and authorization rules |
| 3 | `03_legal_disclaimer_requirements.md` | LEGAL-DIS-2026-002 | Required disclaimers for percent off and Star Rewards |
| 4 | `04_pricing_and_promotion_rules.md` | PRICE-RULES-2026-001 | MAP minimums, brand exclusions, stacking ceiling |
| 5 | `05_dam_tagging_policy.md` | DAM-POLICY-2026-001 | Digital asset tagging standards and rights policies |
| 6 | `06_localization_style_guide.md` | LOC-STYLE-2025-002 | Spanish/French localization rules, holiday calendar |
| 7 | `07_campaign_retro_q4_2025_holiday.md` | RETRO-Q4-2025 | Q4 2025 Holiday campaign retro with ROAS benchmarks |
| 8 | `08_campaign_retro_spring_2025_beauty.md` | RETRO-SP-2025-BTY | Spring 2025 Beauty retro with Beauty Loyalists metrics |
| 9 | `09_approval_ticket_INC_2025_4471.md` | TICKET-INC-2025-4471 | Past revision: pricing language fix, MAP brand clearance |
| 10 | `10_approval_ticket_INC_2026_0212.md` | TICKET-INC-2026-0212 | Clean approval cycle reference for benchmarking |
| 11 | `11_compliance_flag_examples.md` | COMP-EX-2026-001 | Compliance flag examples by category (Beauty, Home) |
| 12 | `12_team_faq_internal.md` | TEAM-FAQ-2026-001 | Internal team FAQ and runbook references |

### Two indexes

**Naive index** (78 chunks): Split each document by L2 headings, further split sections over 500 words by paragraph. Embed with `all-MiniLM-L6-v2` (384 dimensions, L2 normalized). Store in `faiss.IndexFlatIP` (exact inner product = cosine similarity).

**HyQ index** (381 entries): 78 original chunks plus 303 generated questions. For each chunk, an LLM generates 3 to 5 questions that the chunk answers. At query time, the user's question often matches a generated question more closely than the raw chunk text.

### How retrieval works

No LLM is called at query time. The query string is embedded with the same sentence-transformers model, and FAISS returns the top k chunks by cosine similarity. The skill invoker pre-fetches RAG context before calling Claude, so the model receives the relevant documents already retrieved.

```python
from rag.retrieval import retrieve

results = retrieve("banned words and approved taglines", k=4)
# returns: [{ doc_id, filename, section, text, chunk_index, score }, ...]
```

### Naive vs HyQ retrieval results

On 8 near-verbatim test queries, both indexes now retrieve the correct document (the embedding model is fetched at runtime and evolves over time, so we report rank and score rather than a fixed pass count). HyQ ranks the correct document #1 on all 8 queries and scores higher on 6 of 8. On a separate set of 5 realistic paraphrased queries (how a marketer would actually type), HyQ retrieves 5 of 5 correctly while naive misses 1 — the legal disclaimer document for a BOGO pricing question.

## The Orchestrator

The orchestrator is a deterministic router that reads `workflow_state.json` and picks the next step based on 8 priority rules. No LLM is involved in routing.

**Location:** `ai_engine/orchestrator/`

### 8 routing rules (evaluated in order, first match wins)

| # | Rule | Predicate | Next Step | Type |
| --- | --- | --- | --- | --- |
| 1 | Initial submission | status = submitted, no compliance check | compliance-pre-check | Skill |
| 2 | Compliance passed | action = proceed, no brief yet | approval-brief-generator | Skill |
| 3 | Compliance failed | action = revise | Terminal (back to Merna) | Stop |
| 4 | VP approved | decision = approved, no localization | localization-generator | Automation |
| 5 | VP requested revision | decision = revise, no routing yet | revision-router | Skill |
| 6 | Localization done | variants present, no schedule yet | activation-scheduler | Automation |
| 7 | Activation scheduled | schedule present | Terminal (to media coordinator) | Stop |
| 8 | Rejected | decision = rejected | Terminal | Stop |

### Pre-fetch pattern (Option A)

The skill invoker (`ai_engine/orchestrator/skill_invoker.py`) pre-fetches all context before calling Claude:

1. Load the skill's `SKILL.md` (defines prompt contract and output schema)
2. Run RAG queries defined in `SKILL_PREFETCH_CONFIG`
3. Run MCP tool calls defined in the same config
4. Build a prompt with all pre-fetched context
5. Call Claude (`claude-sonnet-4-6` via TritonAI, temperature 0.2, max 2000 tokens)
6. Parse the JSON response
7. Merge result into `workflow_state.json`

Two skills (compliance-pre-check and approval-brief-generator) run in agentic mode where Claude decides when to call MCP tools mid-reasoning. The remaining skills use pre-fetched context and produce structured JSON without tool calls.

### State persistence

Campaign state is checkpointed to `ai_engine/workflow_state.json` after each skill invocation. The shared envelope includes a `next_action` field that tells the router what to evaluate next.

### Human in the loop

Humans stay in the loop at Steps 1 (briefing), 5 (layout assembly), 6 (VP approval decision), 8 (media coordinator confirm), and 10 (final report sign off).

## Testing and Evals

### Unit and integration tests

241 test functions across 11 test files. Run with:

```bash
uv run pytest tests/ -v
```

Test coverage: audience segmentation (33 tests), DAM asset finder (42 tests), localization generator (44 tests), campaign performance analyzer (50 tests), campaign state switching (17 tests), API endpoints (15 tests), CLV skill (8 tests), connectivity (31 tests), smoke (1 test).

### Evaluation suite (DeepEval)

67 tests across 4 eval files, all passing. Run with:

```bash
uv run pytest evals/ -v
```

| Eval | Tests | What It Measures |
| --- | --- | --- |
| Compliance Pre Check | 20 | Banned word scan, tagline validation, pricing language, recommended action |
| Approval Brief Generator | 14 | Recommendation logic, brief structure, value passthrough |
| Revision Router | 9 | Owner lookup, urgency calculation |
| RAG Comparison (naive vs HyQ) | 24 | Document recall, score comparison across 8 queries |

Key finding: On 8 near-verbatim queries both indexes retrieve correctly, but HyQ ranks #1 on all 8 and scores higher on 6 of 8. On 5 realistic paraphrased queries, HyQ retrieves 5/5 while naive misses 1 (the LEGAL-DIS document on a BOGO question).

Live dashboard: [macysai.vercel.app/evals](https://macysai.vercel.app/evals)

## How to Run Locally

### Prerequisites

Python 3.11+, Node.js 20+, [uv](https://docs.astral.sh/uv/), npm.

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd macys_ai_coworker

# 2. Install Python dependencies
uv sync

# 3. Install frontend dependencies
cd gui && npm install && cd ..

# 4. Set environment variables
cp .env.example .env
# Edit .env and add your TRITONAI_API_KEY

cp gui/.env.local.example gui/.env.local
# Edit gui/.env.local if pointing to a remote backend

# 5. Build the RAG index (first time only)
cd ai_engine && python -m rag.build_index && cd ..

# 6. Start the backend
uv run uvicorn api.main:app --reload

# 7. Start the frontend (separate terminal)
cd gui && npm run dev

# 8. Open http://localhost:3000
```

## How to Run the Workflow End to End

1. Open the app and click the **Merna** persona tile
2. The sidebar shows three campaigns: Mother's Day Beauty (active), Spring Beauty Refresh (completed), Summer Style (planned)
3. Click **Mother's Day Beauty Event** (the active campaign)
4. Steps 1 through 3 are shown as completed in the workflow pipeline
5. Step 4 (Creative Production) is active, owned by the Senior Designer persona
6. Switch to the Senior Designer persona to approve Step 4 (or advance via the demo)
7. Step 5 (Layout Assembly) is human only, approve to advance
8. **Step 6 fires the AI cascade:**
   - 6a: Compliance Pre Check runs (scans copy for banned words, validates taglines, checks pricing)
   - 6b: Approval Brief Generator writes the VP brief
   - 6c: If VP clicks Revise, the Revision Router parses the comment and assigns an owner
   - If VP clicks Approve, the cascade continues
9. Steps 7 and 8 fire automatically (localization, then activation scheduling)
10. Step 9 (Monitoring) runs the performance analyzer automation
11. Step 10 (Reporting) shows the executive summary for final sign off

To see a completed campaign: click **Spring Beauty Refresh** in the sidebar. All 10 steps show completed states with pre-computed outputs. No AI is re-fired.

To see a planned campaign: click **Summer Style**. Steps 1 and 2 are complete, Step 3 (SKU Selection) is active.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, Tailwind CSS, Lucide icons |
| Backend | FastAPI, Python 3.11 |
| AI | Claude via TritonAI (`claude-sonnet-4-6`) |
| RAG | FAISS, sentence-transformers (`all-MiniLM-L6-v2`), deferred model load |
| MCP | FastMCP server (stdio transport) |
| Database | SQLite (`data/macys.db`) |
| Tests | pytest, DeepEval 4.0.2 |
| Deploy | Vercel (frontend), Render (backend) |

## Deploy

**Frontend:** Vercel auto-deploys from `main`. The app is at [macysai.vercel.app](https://macysai.vercel.app). Environment variable `NEXT_PUBLIC_API_URL` points to the Render backend.

**Backend:** Render auto-deploys from `main`. Configuration in `render.yaml`. Free tier sleeps after 15 minutes of inactivity; first request after sleep takes 30 to 60 seconds.

**Storyboard editor:** The `/story-edit` page commits slide content to GitHub via a `GITHUB_PAT` environment variable, enabling non-technical team members to update the storyboard.

## File Structure

```
macys_ai_coworker/
  ai_engine/
    skills/
      compliance-pre-check/       SKILL.md + helpers.py
      approval-brief-generator/   SKILL.md + helpers.py
      revision-router/            SKILL.md + helpers.py
    automations/
      audience-segment-builder/   segment.py (k-means RFM)
      dam-asset-finder/           search.py (relevance scoring)
      localization-generator-v1/  generate.py (40 variant matrix)
      localization-generator/     helpers.py (region/language mapping)
      activation-scheduler/       helpers.py (timezone math)
      campaign-performance-analyzer/  analyze.py (attribution + forecast)
    orchestrator/
      orchestrator.py             main loop
      routing_table.py            8 deterministic rules
      skill_invoker.py            pre-fetch + Claude call
    rag/
      knowledge_base/             12 markdown documents
      index/                      naive FAISS index (78 chunks)
      hyq/index/                  HyQ FAISS index (381 entries)
      chunker.py                  L2 heading splitter
      build_index.py              index builder
      retrieval.py                query API
    tools/
      check_pricing_conflicts.py  MAP validation
      find_dam_assets.py          DAM lookup
      generate_locale_variants.py phrase substitution
    mcp_server/
      server.py                   FastMCP server
  api/
    main.py                       FastAPI app
    state.py                      in-memory campaign state
    routes/
      workflow.py                 workflow + campaign endpoints
  gui/
    app/
      page.tsx                    persona picker
      campaign-manager/           Merna's view
      senior-designer/            Abdullah's view
      production-artist/          production view
      marketing-analyst/          analyst view
      story/                      storyboard
      story-edit/                 storyboard editor
      rag-compare/                naive vs HyQ demo
      evals/                      eval dashboard
    components/
      PersonaShell.tsx            main layout with campaign switching
      ActionPanel.tsx             step content router
      WorkflowPipeline.tsx        10 step progress bar
      CampaignSidebar.tsx         campaign list with selection
      ApprovalCascade.tsx         Step 6 cascade animation
      AIRevisionRouting.tsx       Step 6c routing overlay
      steps/                      10 step content components
    lib/
      api.ts                      typed fetch wrappers
  data/
    macys.db                      SQLite (customers, SKUs, DAM, campaigns)
  evals/
    test_compliance_skill.py      20 compliance tests
    test_brief_skill.py           14 brief tests
    test_routing_skill.py         9 routing tests
    test_rag_comparison.py        24 RAG tests (naive vs HyQ)
    datasets/                     JSON test case files
    results/                      eval reports
    triton_judge.py               Claude judge wrapper
  tests/
    automations/                  169 automation tests
    skills/                       8 skill tests
    test_campaign_switching.py    17 campaign state tests
    test_connect.py               31 connectivity tests
    test_activity_api.py          8 API tests
    test_images_api.py            7 image API tests
    test_smoke.py                 1 smoke test
```

## What We Learned

**AI is for judgment, not everything.** Of the 10 workflow steps, only 5 call an LLM. The rest are k-means clustering, SQL queries, timezone arithmetic, and template expansion. Forcing everything through an LLM would be slower, more expensive, and harder to test. The n8n Reddit post Vincent shared crystallized this: "if you can write a deterministic rule, do not ask a model."

**HyQ improved retrieval quality measurably.** On our 8 test queries, naive FAISS retrieval found the right document 62.5% of the time. Adding generated questions (HyQ) brought that to 100%. The 303 generated questions act as a synonym layer, catching intent phrased queries that do not match the original document text.

**Eval frameworks matter as much as the code.** Building the 67 test DeepEval suite forced us to define what "correct" means for each skill output. The compliance skill's `evaluate_recommended_action()` logic was refactored twice after evals revealed edge cases around the warn vs. fail boundary.

**Pre-fetch beats tool calling for this use case.** The orchestrator's Option A pattern (gather all context, then call Claude once) is simpler to debug and test than letting the model loop over tool calls. Each skill invocation is a single Claude call with predictable latency.

## Acknowledgments

Professor Vincent and the MGT 449 instructional team at UCSD Rady School of Management. The course design, the TritonAI API, and the n8n pattern reference shaped how we thought about where AI belongs in a workflow.
