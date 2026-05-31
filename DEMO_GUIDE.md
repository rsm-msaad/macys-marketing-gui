# DEMO_GUIDE.md — Macy's AI Coworker

*Last updated: May 23, 2026*

## Section 1: Routes and Pages

| Route | Page | Who navigates here |
|---|---|---|
| `/` | Landing page — 2 co-CEOs side-by-side + 4 team members | Everyone, first visit |
| `/campaign-manager` | Merna's workspace — workflow, sidebar, campaign selector | Merna |
| `/senior-designer` | Abdullah's workspace | Abdullah |
| `/marketing-analyst` | Anna's workspace | Anna |
| `/production-artist` | Shankar's workspace | Shankar |
| `/ceo` | Prof. Vincent's executive workspace | Vincent |
| `/thales` | Prof. Thales's executive workspace | Thales |
| `/dashboard` | Operational overview — stat cards, campaign list, activity feed, escalations | All personas via sidebar |
| `/campaigns` | Filterable campaign card grid (All/Active/Planned/Completed) | All personas via sidebar |
| `/knowledge` | 12 RAG documents with search, filter, and full-content viewer | Team personas via sidebar |
| `/analytics` | Cross-campaign trends — hours/dollars saved, quality metrics, MCP usage | All personas via sidebar |
| `/segments` | 3 RFM customer segments with full profiles | Direct URL (not in sidebar) |
| `/impact` | Per-campaign impact + portfolio aggregate with animated numbers | TopBar nav pill |
| `/evidence` | Evidence justification viewer for AI decisions | TopBar nav pill |
| `/architecture` | System architecture diagram with component badges | TopBar nav pill |
| `/evals` | Evaluation metrics dashboard (DeepEval test results) | TopBar nav pill |
| `/rag-compare` | Naive vs HyQ retrieval comparison demo | TopBar nav pill |
| `/story` | 75-slide presentation deck viewer | TopBar nav pill |
| `/start` | New campaign creation form | "+ New" button in sidebar |
| `/review` | Step-by-step approval review with 5 actions | Within workflow |
| `/docs` | Documentation index (renders milestone writeups) | TopBar nav pill |
| `/docs/[slug]` | Individual doc page (dynamic route) | From docs index |

## Section 2: Personas

### Merna — Campaign Manager
- **Role:** Owns the brief, builds the audience, picks the SKUs, shepherds through approval
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Steps 1, 2, 3, 6, 8
- **Unique:** Primary demo persona. Interacts with the most steps.

### Abdullah — Senior Designer
- **Role:** Searches the DAM, picks hero photos, owns the layout
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Steps 4, 5
- **Unique:** Reviews DAM asset shortlists and layout copy. Step 5 shows visual ad-style mockups with real DAM photos.

### Shankar — Production Artist
- **Role:** Spins up regional variants for every placement
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Step 7
- **Unique:** Per-variant toggle selection (same pattern as Steps 3/4). Can deselect individual locale variants before lock-in.

### Anna — Marketing Analyst
- **Role:** Pulls the data, runs attribution, drafts the readout
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Steps 9, 10
- **Unique:** Owns monitoring and final reporting. Step 10 has "Generate Report via Claude".

### Prof. Vincent — Co-CEO
- **Role:** Co-CEO with executive authority over campaign approvals and overrides
- **Sidebar:** Dashboard, All Campaigns, All Steps, Overrides
- **Authority:** Can act on ALL steps (override any persona)
- **Unique:** Receives escalations. "Overrides" links to `/dashboard#escalations`.

### Prof. Thales — Co-CEO
- **Role:** Equal co-CEO with same authority as Vincent
- **Sidebar:** Dashboard, All Campaigns, All Steps, Overrides
- **Authority:** Can act on ALL steps (identical to Vincent)
- **Unique:** Actions attributed individually in audit log. Shared escalation queue with Vincent.

## Section 3: The 10 Workflow Steps

### Step 1: Briefing
- **Owner:** Merna | **Badge:** HUMAN_ONLY | **Calls Claude:** No
- **What runs:** `/start` form with structured fields
- **Outputs:** `step_outputs["1"]` — brief summary

### Step 2: Segmentation
- **Owner:** Merna | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **What runs:** Audience Segment Builder (k-means on 50K customers from macys.db)
- **Reads from:** Step 1 brief category (for recommendation, not filtering)
- **Outputs:** `step_outputs["2"]` — segment name, top_category, RFM metrics, loyalty_mix
- **Context banner:** Shows brief category from Step 1

### Step 3: SKU Selection
- **Owner:** Merna | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **What runs:** SKU Recommender (2,000 SKUs from macys.db sku_catalog) + check_pricing_conflicts Python helper
- **Reads from:** Step 2 segment top_category
- **Outputs:** `step_outputs["3"]` — approved_skus, pricing_check result
- **UI:** Per-SKU toggle selection, MAP violations block lock-in

### Step 4: Creative Production
- **Owner:** Abdullah | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **What runs:** DAM Asset Finder (5,000 assets with category boost) + find_dam_assets Python helper
- **Reads from:** Step 3 SKUs, category
- **Outputs:** `step_outputs["4"]` — approved_assets, find_dam_assets_result

### Step 5: Layout Assembly
- **Owner:** Abdullah | **Badge:** HUMAN_PLUS_SKILL | **Calls Claude:** Yes (pre-fetch, fallback if unavailable)
- **What runs:** Layout Copy Generator LLM skill
- **Reads from:** Steps 2-4 (segment, SKUs, assets, category)
- **Outputs:** `step_outputs["5"]` — placements with tagline/body/cta/visual_direction
- **UI:** Visual ad-style mockups using real DAM photos with copy overlaid. "Show raw copy" toggle for text view.

### Step 6a: Compliance Pre Check
- **Owner:** Merna | **Badge:** HUMAN_PLUS_SKILL | **Calls Claude:** Yes (agentic — Claude calls check_pricing_conflicts MCP tool mid-reasoning)
- **Reads from:** Actual copy from Step 5, real SKU IDs from Step 3
- **Outputs:** Evidence `["6a"]` — 3 findings with status/reason/cited_doc, recommended_action, agentic_trace
- **UI:** Action row at bottom: Evidence (side panel), Full View →, Review. Cache pattern: fires once, replays from cache on revisit.
- **Review page:** "Accept Findings" button (not "Approve") — locks substep, does not advance campaign

### Step 6b: Approval Brief Generator
- **Owner:** Merna (proxy for VP) | **Badge:** HUMAN_PLUS_SKILL | **Calls Claude:** Yes (agentic)
- **Reads from:** Compliance result, copy, SKUs, segment
- **Outputs:** Evidence `["6b"]` — 5-field brief, agentic_trace
- **Review page:** "Accept Brief" button

### Step 6c: Revision Router
- **Owner:** Receiving team member | **Calls Claude:** Yes (pre-fetch)
- **Fires when:** VP selects "Revise" and enters a comment
- **Outputs:** change_type, owner, urgency, one_line_summary

### Step 7: Localization
- **Owner:** Shankar | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **What runs:** Localization Generator (template expansion) + generate_locale_variants Python helper
- **Reads from:** Copy from Step 5, SKUs from Step 3
- **Outputs:** `step_outputs["7"]` — variant_count, selected_variant_ids, locale_variant_results
- **UI:** Per-variant toggle selection with Select all/Deselect all. Region headers show selection counts.

### Step 8: Activation
- **Owner:** Merna | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **Reads from:** Step 7 locale variants
- **Outputs:** `step_outputs["8"]` — channels, locale_variant_count

### Step 9: Monitoring
- **Owner:** Anna | **Badge:** HUMAN_PLUS_AUTOMATION | **Calls Claude:** No
- **What runs:** Campaign Performance Analyzer (attribution + forecast from macys.db)
- **Reads from:** Steps 2-3 (segment, SKUs)
- **Outputs:** `step_outputs["9"]` — totals, top_channel, top_segment

### Step 10: Reporting
- **Owner:** Anna | **Badge:** HUMAN_PLUS_SKILL | **Calls Claude:** Yes (pre-fetch, fallback if unavailable)
- **What runs:** Report Generator LLM skill from full audit trail
- **Reads from:** ALL step_outputs 2-9
- **UI:** "Generate Report via Claude" button
- **Outputs:** `step_outputs["10"]` — summary, upstream_steps_used

## Section 4: The 5 LLM Skills

| Skill | Step | Mode | Model | RAG Docs | MCP Tools |
|---|---|---|---|---|---|
| Layout Copy Generator | 5 | Pre-fetch | claude-sonnet-4-6 | Brand voice guidelines | None |
| Compliance Pre Check | 6a | Agentic | claude-sonnet-4-6 | 4 docs (brand, legal, pricing, compliance) | check_pricing_conflicts |
| Approval Brief Generator | 6b | Agentic | claude-sonnet-4-6 | Campaign retro benchmarks | check_pricing_conflicts (optional) |
| Revision Router | 6c | Pre-fetch | claude-sonnet-4-6 | None | None |
| Report Generator | 10 | Pre-fetch | claude-sonnet-4-6 | Campaign retro benchmarks | None |

All skills have deterministic fallbacks if the API is unavailable. Agentic skills capture reasoning traces in the Evidence panel.

## Section 5: The 3 MCP Tools

3 tools are registered via MCP: `check_pricing_conflicts`, `find_dam_assets`, and `generate_locale_variants`. `check_pricing_conflicts` is invoked agentically by Claude during the Step 6 compliance skill. `find_dam_assets` and `generate_locale_variants` are MCP-registered but called as deterministic Python helpers by the automations at Steps 4 and 7.

### check_pricing_conflicts
- **What:** Validates SKUs against MAP-enforced brand list (14 brands) and discount floor
- **Fires at:** Step 3 (Python helper), Steps 6a/6b (agentically by Claude)
- **Integration:** Internal (queries macys.db sku_catalog)

### find_dam_assets
- **What:** DAM lookup by category and region with active rights filter
- **Fires at:** Step 4 (deterministic Python helper)
- **Integration:** Internal (queries macys.db dam_assets)

### generate_locale_variants
- **What:** Phrase-level transcreation to Spanish and Quebec French
- **Fires at:** Step 7 (deterministic Python helper)
- **Integration:** Internal (40+ phrase substitution table)

## Section 6: The 7 Automations

| Automation | Step | Input | Output |
|---|---|---|---|
| Audience Segment Builder | 2 | 50K customers from macys.db | 3 RFM segments |
| SKU Recommender | 3 | 2,000 SKUs from macys.db sku_catalog | Top 18 ranked, MAP exclusions |
| DAM Asset Finder | 4 | 5,000 assets with category boost | Top 12 ranked with quality flags |
| Localization Generator | 7 | Templates, 10 regions x 4 placements | Variant matrix with regional pricing |
| Activation Scheduler | 8 | Timezone + channel rules | Per-region send times |
| Campaign Performance Analyzer | 9 | macys.db campaign data | Attribution, forecast with 80% CI |

## Section 7: The 12 RAG Documents

| # | Doc ID | Title | Used By |
|---|---|---|---|
| 1 | BRAND-GL-2026-001 | Brand Guidelines | Compliance Pre Check, Layout Copy Generator |
| 2 | APPROVAL-POLICY-2026-001 | Approval Policy | Approval Brief Generator |
| 3 | LEGAL-DIS-2026-002 | Legal Disclaimer Requirements | Compliance Pre Check |
| 4 | PRICE-RULES-2026-001 | Pricing and Promotion Rules | Compliance Pre Check |
| 5 | DAM-POLICY-2026-001 | DAM Tagging Policy | DAM Asset Finder (context) |
| 6 | LOC-STYLE-2025-002 | Localization Style Guide | Localization Generator |
| 7 | RETRO-Q4-2025 | Q4 2025 Holiday Campaign Retrospective | Approval Brief Generator |
| 8 | RETRO-SP-2025-BTY | Spring 2025 Beauty Campaign Retrospective | Approval Brief Generator, Report Generator |
| 9 | TICKET-INC-2025-4471 | Past Approval Ticket (pricing fix) | Revision Router |
| 10 | TICKET-INC-2026-0212 | Clean Approval Cycle Reference | Revision Router |
| 11 | COMP-EX-2026-001 | Compliance Flag Examples | Compliance Pre Check |
| 12 | TEAM-FAQ-2026-001 | Internal Team FAQ | Cross-cutting |

All 12 indexed in HyQ FAISS vector store (381 entries: 78 chunks + 303 generated questions). Browsable at `/knowledge`.

## Section 8: Cascade Invalidation

### When a user clicks Rerun at Step 6a:
- Clears evidence and outputs for 6a, 6b, 6c, and Steps 7-10
- Compliance re-fires fresh with new RAG retrieval and agentic tool calls
- All downstream steps show as incomplete

### When a user clicks Edit at Step 5:
- Clears Steps 6, 6a, 6b, 6c, 7-10
- Edited copy becomes input for the next compliance check

### When a user resets the demo:
- All step_outputs, history, evidence, audit_log cleared
- Campaign returns to Step 1; brief remains

## Section 9: Pre-Seeded Demo Data

### Mother's Day Beauty Event (MDC-2026-MD-001) — Active
- **Current step:** 6 | **Completed:** Steps 1-5 pre-seeded
- Step 2: VIP Loyalists (9,590 customers, Beauty, 8.7% lift)
- Step 3: 3 SKUs locked (IDs: 18, 40, 42)
- Step 4: 12 DAM assets | Step 5: 4 layouts
- **Demo purpose:** Walk straight to Step 6 for agentic AI

### Spring Beauty Refresh (MDC-2025-SP-BTY) — Completed
- All 10 steps done | $682K revenue, 2.7x ROAS, 4,820 conversions
- **Demo purpose:** Show finished campaign with all outputs

### Summer Style (MDC-2026-SS-003) — Planned
- Steps 1-2 done, at Step 3 (SKU Selection)
- **Demo purpose:** Early-stage campaign waiting for user action

## Section 10: Key Demo Flows

### Flow 1: New Campaign Start to Finish
1. `/` → click "Merna" → "+ New" → fill brief at `/start`
2. **Step 2:** Build Segments → pick one → Approve
3. **Step 3:** Recommend SKUs → pricing helper runs → Lock in
4. Switch to **Abdullah** → **Step 4:** Run DAM Asset Finder → Lock in
5. **Step 5:** Generate Layout Copy (Claude, 5-15 sec) → see visual mockups with DAM photos → Approve
6. Switch to **Merna** → **Step 6a:** Compliance fires agentically (Claude calls check_pricing_conflicts)
7. **Step 6b:** Brief fires (~10 sec) → review 5-field VP brief
8. Final Approval → campaign advances
9. Switch to **Shankar** → **Step 7:** Run Localization → toggle variants → Lock in
10. **Merna** → **Step 8:** Activate Campaign
11. **Anna** → **Step 9:** Run Performance Analyzer → Lock in
12. **Step 10:** Generate Report via Claude → Send to Leadership

### Flow 2: Agentic Compliance + Evidence Deep Dive
1. Select Mother's Day Beauty (pre-seeded at Step 6)
2. **Step 6a fires automatically** — watch Claude reason and call tools
3. Click **Evidence** button at bottom of compliance card → side panel opens
4. See: RAG docs, agentic trace (Claude's reasoning → tool calls → results)
5. Click **Full View →** for `/evidence` page
6. Navigate to **Step 6b** → brief fires
7. If compliance failure: click **Reject** → enter reason → audit log entry
8. Click **Rerun** → cascade clears downstream → compliance re-fires fresh

### Flow 3: CEO Escalation Handling
1. As **Merna** at Step 6a → click **Escalate** → enter reason
2. Switch to **Prof. Vincent** → click **Overrides** in sidebar → see escalation
3. Navigate into campaign → take action (Approve/Edit/Reject)
4. Audit log records: "Prof. Vincent approved escalated Step 6a"
5. Switch to **Prof. Thales** → same dashboard, same queue (shared state)
6. Navigate to `/impact` → per-campaign savings update in real time

## Section 11: Technical Architecture

### Honest Component Tally
- **5 LLM Skills** (2 agentic, 3 pre-fetch) — all verified calling Claude via TritonAI
- **7 Deterministic Automations** — no LLM, pure Python
- **3 MCP Tools** — check_pricing_conflicts (agentic), find_dam_assets and generate_locale_variants (MCP-registered Python helpers)
- **12 RAG Documents** — HyQ FAISS index (381 entries)
- **6 Personas** — 4 team + 2 co-CEOs

### Key Performance Optimizations
- **Cache pattern:** Agentic skills fire once per campaign, replay from evidence store on revisit
- **Polling guard:** useRef prevents 5-second poll from re-firing skills
- **Loading flash fix:** useState initializes from cache to avoid skeleton flicker
- **Model routing:** All skills use claude-sonnet-4-6 via TritonAI

### UI Labels (Honest)
- Steps 2-4, 7-9: **Automation** badge (deterministic)
- Steps 5, 10: **Skill** badge (LLM, pre-fetch)
- Steps 6a, 6b: **Agentic Skill** badge (Claude calls MCP tools)
- Step 3 pricing check: "Pricing helper" (not MCP)
- Step 4 DAM lookup: "Python helper" (not MCP)
- Step 7 transcreation: "Python helper" (not MCP)

---

*5 LLM skills · 7 automations · 3 MCP tools · 12 RAG docs · 6 personas · 3 campaigns*
