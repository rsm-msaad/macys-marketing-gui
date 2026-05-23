# DEMO_GUIDE.md — Macy's AI Coworker

## Section 1: Routes and Pages

| Route | Page | Who navigates here |
|---|---|---|
| `/` | Landing page — persona selector with 2 co-CEOs and 4 team members | Everyone, first visit |
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
| `/segments` | 3 RFM customer segments with full profiles | Direct URL (removed from sidebar) |
| `/impact` | Per-campaign and portfolio impact analysis with animated numbers | TopBar nav pill |
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
- **Authority:** Steps 1, 2, 3, 6, 8 (proxy for Marketing Leadership, VP+Legal, Media Coordinator)
- **Unique:** Primary demo persona. Interacts with the most steps.

### Abdullah — Senior Designer
- **Role:** Searches the DAM, picks hero photos, owns the layout
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Steps 4, 5
- **Unique:** Reviews DAM asset shortlists and layout copy

### Shankar — Production Artist
- **Role:** Spins up regional variants for every placement
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Step 7
- **Unique:** Spot-checks localization variants side-by-side

### Anna — Marketing Analyst
- **Role:** Pulls the data, runs attribution, drafts the readout
- **Sidebar:** Dashboard, Campaigns, Knowledge Base, Analytics
- **Authority:** Steps 9, 10
- **Unique:** Owns monitoring and final reporting

### Prof. Vincent — Co-CEO
- **Role:** Executive authority over campaign approvals and overrides
- **Sidebar:** Dashboard, All Campaigns, All Steps, Overrides
- **Authority:** Can act on ALL steps (override any persona)
- **Unique:** Receives escalations. "Overrides" links to `/dashboard#escalations`

### Prof. Thales — Co-CEO
- **Role:** Equal co-CEO with same authority as Vincent
- **Sidebar:** Dashboard, All Campaigns, All Steps, Overrides
- **Authority:** Can act on ALL steps (identical to Vincent)
- **Unique:** Actions attributed individually in audit log

## Section 3: The 10 Workflow Steps

### Step 1: Briefing
- **Owner:** Merna (Campaign Manager)
- **What runs:** Human only — `/start` form with structured fields
- **Badge:** HUMAN_ONLY
- **Calls Claude:** No
- **Inputs:** None (first step)
- **Outputs:** `step_outputs["1"]` — brief summary
- **User interaction:** Fill form fields (name, category, budget, channels, description), click approve
- **Evidence:** None

### Step 2: Segmentation
- **Owner:** Merna
- **What runs:** Audience Segment Builder automation (k-means, k=3 on 50K customers)
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Brief text from Step 1 (for recommendation only; clustering is blind to brief)
- **Outputs:** `step_outputs["2"]` — segment name, customer_count, top_category, top_category_lift, RFM metrics, loyalty_mix, override_reason
- **User interaction:** Click "Build Segments", pick one of 3 segments, optional override comment, click "Approve"
- **Evidence:** None
- **Context banner:** Shows brief category from Step 1

### Step 3: SKU Selection
- **Owner:** Merna
- **What runs:** SKU Recommender automation (scores 2,000 SKUs from macys.db sku_catalog) + check_pricing_conflicts Python helper
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Segment top_category from `step_outputs["2"]`, brief category
- **Outputs:** `step_outputs["3"]` — approved_skus (string IDs), total_recommended, excluded_count, segment_used, segment_top_category, pricing_check result
- **User interaction:** Click "Recommend SKUs", toggle individual SKUs, click "Lock in N SKUs". Blocked if pricing helper finds MAP violations on selected SKUs.
- **Evidence:** Pricing helper result displayed inline
- **Context banner:** Shows segment name and top_category from Step 2

### Step 4: Creative Production
- **Owner:** Abdullah (Senior Designer)
- **What runs:** DAM Asset Finder automation (tag matching + category boost on 5,000 assets) + find_dam_assets Python helper for rights check
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Approved SKUs from `step_outputs["3"]`, category
- **Outputs:** `step_outputs["4"]` — approved_assets (IDs), approved_asset_count, category, find_dam_assets_result
- **User interaction:** Click "Run DAM Asset Finder", toggle assets, click "Lock in N assets"
- **Evidence:** find_dam_assets helper result displayed inline
- **Context banner:** Shows SKU count and category from Step 3

### Step 5: Layout Assembly
- **Owner:** Abdullah (Senior Designer)
- **What runs:** Layout Copy Generator LLM skill (Claude via TritonAI, falls back to deterministic)
- **Badge:** HUMAN_PLUS_SKILL
- **Calls Claude:** Yes (pre-fetch pattern, single call). Fallback to `helpers.generate_fallback()` if API unavailable.
- **RAG pre-fetched:** "brand voice guidelines and approved taglines for campaign copy"
- **Inputs:** Brief (name, objective, target_customer, promotional_offer), category from upstream
- **Outputs:** `step_outputs["5"]` — approved_layouts (placement names), placements (tagline, body, cta, visual_direction per placement), segment_used, sku_count, asset_count, category
- **User interaction:** Click "Generate Layout Copy", review 4 placement cards (web_banner, email, mobile, in_store_signage), click "Approve layouts"
- **Evidence:** generation_metadata.method shows "claude_via_skill_invoker" or "deterministic_fallback"
- **Context banner:** Shows segment, SKU count, asset count from Steps 2-4

### Step 6a: Compliance Pre Check
- **Owner:** Merna (Campaign Manager)
- **What runs:** Compliance Pre Check LLM skill (Claude via TritonAI, agentic mode)
- **Badge:** HUMAN_PLUS_SKILL
- **Calls Claude:** Yes (agentic — Claude decides when to call check_pricing_conflicts MCP tool mid-reasoning)
- **RAG pre-fetched:** 4 queries — banned words, legal disclaimers, MAP restrictions, compliance examples
- **MCP tools available to Claude:** check_pricing_conflicts, find_dam_assets, generate_locale_variants, send_campaign_summary
- **Inputs:** Actual campaign copy from `step_outputs["5"]` placements, real SKU IDs from `step_outputs["3"]`, segment from `step_outputs["2"]`
- **Outputs:** Evidence `["6a"]` — brand_alignment, disclaimers, pricing_cross_check (each with status/reason/cited_doc), recommended_action (proceed/revise), agentic_trace
- **User interaction:** Fires automatically. Shows 3 findings with confidence indicator. Reviewer selects Approve/Edit/Reject/Rerun/Escalate on Review screen.
- **Evidence:** Agentic trace showing Claude's reasoning, tool calls, and results. Visible via Evidence pill.

### Step 6b: Approval Brief Generator
- **Owner:** Merna (proxy for VP)
- **What runs:** Approval Brief Generator LLM skill (Claude via TritonAI, agentic mode)
- **Badge:** HUMAN_PLUS_SKILL
- **Calls Claude:** Yes (agentic — Claude may call check_pricing_conflicts to verify pricing flags)
- **RAG pre-fetched:** "{campaign.audience_segment} campaign retro performance benchmarks"
- **Inputs:** Compliance result from 6a, actual copy from Step 5, SKUs from Step 3, segment from Step 2
- **Outputs:** Evidence `["6b"]` — campaign_goal, target_audience, expected_roi, risk_flags, ai_recommendation, agentic_trace
- **User interaction:** Fires automatically after 6a completes. VP reviews 5-field brief. Edit mode turns fields into textareas. Same 5 Review actions.
- **Evidence:** Agentic trace. Shows prior step outputs referenced.

### Step 6c: Revision Router
- **Owner:** Receiving team member
- **What runs:** Revision Router LLM skill (Claude via TritonAI, pre-fetch mode)
- **Badge:** Part of Step 6
- **Calls Claude:** Yes (pre-fetch, single call)
- **Inputs:** VP revision comment, campaign context
- **Outputs:** revision_routing — change_type, owner, urgency, one_line_summary
- **User interaction:** Fires when VP selects "Revise" and enters a comment. Routes to the appropriate team member.

### Step 7: Localization
- **Owner:** Shankar (Production Artist)
- **What runs:** Localization Generator automation (template expansion, 10 regions x 4 placements) + generate_locale_variants Python helper for Spanish and Quebec French
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Copy from `step_outputs["5"]`, SKUs from `step_outputs["3"]`
- **Outputs:** `step_outputs["7"]` — variant_count, regions, skus_from_step3, copy_from_step5, locale_variant_results
- **User interaction:** Click "Run Localization Generator", review variants grouped by region, click "Lock in N translations"
- **Evidence:** generate_locale_variants helper results displayed inline
- **Context banner:** Shows SKU count from Step 3 and tagline from Step 5

### Step 8: Activation
- **Owner:** Merna (proxy for Media Coordinator)
- **What runs:** Mock data display (channel deployment schedule from pre-seeded data)
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Locale variants from `step_outputs["7"]`
- **Outputs:** `step_outputs["8"]` — channels, locale_variant_count, locale_regions
- **User interaction:** Review 5 channel cards, click "Activate Campaign"
- **Context banner:** Shows variant count and regions from Step 7

### Step 9: Monitoring
- **Owner:** Anna (Marketing Analyst)
- **What runs:** Campaign Performance Analyzer automation (last-touch attribution + linear regression forecast from macys.db)
- **Badge:** HUMAN_PLUS_AUTOMATION
- **Calls Claude:** No
- **Inputs:** Segment from `step_outputs["2"]`, SKUs from `step_outputs["3"]`
- **Outputs:** `step_outputs["9"]` — top_channel, top_segment, totals (revenue, spend, conversions, roas), segment_used, sku_count
- **User interaction:** Click "Run Performance Analyzer", review KPI cards, attribution tables, forecast with 80% CI, click "Lock in Performance Analysis"
- **Context banner:** Shows segment and SKU count from Steps 2-3

### Step 10: Reporting
- **Owner:** Anna (Marketing Analyst)
- **What runs:** Report Generator LLM skill (Claude via TritonAI, pre-fetch). Frontend also has `buildSummaryFromUpstream()` as initial draft.
- **Badge:** HUMAN_PLUS_SKILL
- **Calls Claude:** Yes (pre-fetch, single call). Click "Generate Report via Claude" button. Fallback produces stub if API unavailable.
- **RAG pre-fetched:** "campaign retro performance benchmarks"
- **Inputs:** ALL step_outputs from Steps 2-9, audit log, brief
- **Outputs:** `step_outputs["10"]` — summary, upstream_steps_used
- **User interaction:** Edit the draft in textarea, optionally click "Generate Report via Claude" for AI version, optionally click "Send to Team via Email" (fires send_campaign_summary MCP tool via Gmail), click "Send to Leadership"
- **Evidence:** generation_metadata.method shows which path ran
- **Context banner:** Shows count of upstream steps available (N of 8)

## Section 4: The 5 LLM Skills

### Layout Copy Generator
- **SKILL.md:** `ai_engine/skills/layout-copy-generator/SKILL.md`
- **Mode:** Pre-fetch (single Claude call)
- **RAG docs:** Brand voice guidelines (BRAND-GL-2026-001)
- **MCP tools:** None
- **Output:** Placements dict with tagline, body, cta, visual_direction per placement (web_banner, email, mobile, in_store_signage)
- **UI display:** 4 placement cards at Step 5
- **Fallback:** `helpers.generate_fallback()` if Claude unavailable

### Compliance Pre Check
- **SKILL.md:** `ai_engine/skills/compliance-pre-check/SKILL.md`
- **Mode:** Agentic (Claude decides when to call tools, max 5 iterations)
- **RAG docs:** BRAND-GL-2026-001, LEGAL-DIS-2026-002, PRICE-RULES-2026-001, COMP-EX-2026-001
- **MCP tools:** check_pricing_conflicts (Claude calls mid-reasoning)
- **Output:** brand_alignment, disclaimers, pricing_cross_check (each with status/reason/cited_doc), recommended_action, agentic_trace
- **UI display:** 3 finding cards with confidence badge at Step 6a. Agentic trace in Evidence panel.
- **Fallback:** Graceful "needs human review" placeholder if JSON parse fails

### Approval Brief Generator
- **SKILL.md:** `ai_engine/skills/approval-brief-generator/SKILL.md`
- **Mode:** Agentic (Claude may call check_pricing_conflicts)
- **RAG docs:** RETRO-SP-2025-BTY, RETRO-Q4-2025 (template-filled query)
- **MCP tools:** check_pricing_conflicts (optional, for pricing flag verification)
- **Output:** campaign_goal, target_audience, expected_roi, risk_flags, ai_recommendation, agentic_trace
- **UI display:** 5-field brief card at Step 6b with edit mode and Evidence pill

### Revision Router
- **SKILL.md:** `ai_engine/skills/revision-router/SKILL.md`
- **Mode:** Pre-fetch (single Claude call)
- **RAG docs:** None pre-fetched (RAG queries list is empty)
- **MCP tools:** None
- **Output:** change_type, owner, urgency, one_line_summary
- **UI display:** Routing card at Step 6c showing classified comment and assigned owner

### Report Generator
- **SKILL.md:** `ai_engine/skills/report-generator/SKILL.md`
- **Mode:** Pre-fetch (single Claude call)
- **RAG docs:** Campaign retro benchmarks
- **MCP tools:** None (send_campaign_summary is triggered separately by user)
- **Output:** executive_summary (markdown), key_metrics, recommendations, risks_and_concerns
- **UI display:** Editable textarea at Step 10 with "Generate Report via Claude" button
- **Fallback:** Stub report if Claude unavailable

## Section 5: The 2 MCP Tools

### check_pricing_conflicts
- **What:** Validates SKUs against MAP-enforced brand list (14 brands) and discount floor
- **Where it fires:**
  - Step 3 — called as Python helper by SKU Recommender (deterministic)
  - Step 6a — called agentically by Claude during Compliance Pre Check
  - Step 6b — optionally called by Claude during Approval Brief
- **Input:** `{ sku_ids: string[], proposed_discount_pct: number }`
- **Output:** `{ status: "pass"|"warn"|"fail", conflicts: [{sku_id, brand, issue, severity}], checked_count }`
- **Integration:** Internal (queries macys.db sku_catalog)

### send_campaign_summary
- **What:** Sends campaign report via Gmail SMTP using App Password
- **Where it fires:** Step 10 — triggered by user clicking "Send to Team via Email"
- **Input:** `{ recipients: string[], campaign_name: string, subject: string, summary_body: string }`
- **Output:** `{ status: "sent"|"error", recipients_count, message_id, error }`
- **Integration:** External (Gmail SMTP, requires GMAIL_USER + GMAIL_APP_PASSWORD env vars)

## Section 6: The 6 Automations

### Audience Segment Builder
- **What:** k-means clustering (k=3, random_state=42) on RFM features across 50,000 customers
- **Where:** Step 2
- **Input:** Brief description string (used for recommendation only, not filtering)
- **Output:** 3 segments with name, definition, customer_count, RFM averages, top_category, loyalty_mix

### SKU Recommender
- **What:** Deterministic scoring of 2,000 SKUs from macys.db sku_catalog (inventory 25%, margin 25%, vendor 30%, seasonality 20%)
- **Where:** Step 3
- **Input:** Category, discount_pct, campaign_period, season, segment_top_category
- **Output:** Recommended SKUs (top 18) with scores, excluded SKUs (MAP violations)

### DAM Asset Finder
- **What:** Tag-based relevance scoring across 5,000 DAM assets with category boost and rights filtering
- **Where:** Step 4
- **Input:** Brief text, category, max_results
- **Output:** Ranked assets with relevance_score, quality_flag, tags, resolution

### Localization Generator
- **What:** Template expansion across 10 regions x 4 placements with regional pricing and phrase substitution
- **Where:** Step 7
- **Input:** Brief, master SKU IDs, regions, placements
- **Output:** Variant matrix with copy_headline, copy_subhead, cta_text, regional_price per variant

### Activation Scheduler
- **What:** Timezone-aware send time computation with frequency caps
- **Where:** Step 8
- **Input:** Region, estimated_spend, launch_date
- **Output:** Per-region schedule with email send times, social windows, display caps

### Campaign Performance Analyzer
- **What:** Last-touch attribution + linear regression forecast with 80% CI from macys.db campaign data
- **Where:** Step 9
- **Input:** Campaign ID, forecast_days
- **Output:** Totals (revenue, spend, conversions, ROAS), attribution by channel/segment, forecast with confidence intervals

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

All 12 indexed in HyQ FAISS vector store (381 entries: 78 chunks + 303 generated questions).

## Section 8: Cascade Invalidation

### When a user clicks Rerun at Step 6a:
1. `invalidate_downstream_steps("MDC-2026-MD-001", "6a")` is called
2. Clears `step_outputs["6a"]`, `step_outputs["6b"]`, `step_outputs["6c"]` (all substeps after 6a)
3. Clears `step_outputs["7"]` through `step_outputs["10"]` (all main steps after 6)
4. Clears evidence for all those step IDs, plus cache keys `6a_output`, `6b_output`
5. The compliance skill re-fires with fresh RAG retrieval and agentic tool calls
6. All downstream steps show as incomplete — user must walk through them again

### When a user clicks Edit at Step 5:
1. `invalidate_downstream_steps("MDC-2026-MD-001", "5")` is called
2. Clears `step_outputs["6"]`, `step_outputs["6a"]`, `step_outputs["6b"]`, `step_outputs["6c"]`, and Steps 7-10
3. The edited copy at Step 5 becomes the new input for Step 6a compliance check
4. All downstream results are stale and must be regenerated

### When a user resets the demo:
1. `reset()` is called, which replaces the campaign state with `_fresh_state()`
2. All step_outputs, history, evidence, audit_log, escalations are cleared
3. Campaign returns to Step 1 with zero completed steps
4. The brief remains (it's stored separately in `_BRIEFS`)

## Section 9: Pre-Seeded Demo Data

### Mother's Day Beauty Event (MDC-2026-MD-001) — Active
- **Current step:** 6 (Final Approval)
- **Completed:** Steps 1-5 pre-seeded
- **Pre-seeded outputs:**
  - Step 1: Brief approved
  - Step 2: VIP Loyalists segment (9,590 customers, Beauty category, 8.7% lift)
  - Step 3: 3 SKUs locked (IDs: 18, 40, 42), segment_top_category=Beauty
  - Step 4: 12 DAM assets approved
  - Step 5: 4 layouts approved (web_banner, email, mobile, in_store_signage)
- **Demo purpose:** Walk straight to Step 6 to see agentic AI in action

### Spring Beauty Refresh (MDC-2025-SP-BTY) — Completed
- **Current step:** 11 (past last = complete)
- **Completed:** All 10 steps
- **Key results:** $682K revenue, 2.7x ROAS, $250K spend, 4,820 conversions
- **Demo purpose:** Show a finished campaign with all outputs populated. Historical record.

### Summer Style (MDC-2026-SS-003) — Planned
- **Current step:** 3 (SKU Selection)
- **Completed:** Steps 1-2
- **Pre-seeded outputs:**
  - Step 1: Brief filed (Women/Men 22-40, $400K budget, July 1 launch)
  - Step 2: 2 segments (Summer Resort Shoppers, Vacation-Ready Loyalists)
- **Demo purpose:** Show a campaign in early stages, waiting for user action

## Section 10: Key Demo Flows

### Flow 1: New Campaign Start to Finish

**Goal:** Show the full 10-step workflow with real AI calls.

1. Navigate to `/` → click "Merna" (Campaign Manager)
2. Click "+ New" in sidebar → fill brief at `/start` (name: "Fall Fashion Preview", category: Apparel, budget: $300K)
3. **Step 2:** Click "Build Segments" → 3 segments appear → select one → "Approve"
4. **Step 3:** Click "Recommend SKUs" → 18 Apparel SKUs scored → pricing helper runs → "Lock in SKUs"
5. Switch persona to Abdullah (Senior Designer) via dropdown
6. **Step 4:** Click "Run DAM Asset Finder" → 12 assets ranked → "Lock in assets"
7. **Step 5:** Click "Generate Layout Copy" → Claude generates copy (5-15 sec) → "Approve layouts"
8. Switch back to Merna
9. **Step 6a:** Compliance fires automatically (agentic — watch Claude reason and call tools)
10. **Step 6b:** Brief fires automatically → review the 5-field VP brief
11. Click "Final Approval" → campaign advances
12. Switch to Shankar (Production Artist)
13. **Step 7:** Click "Run Localization Generator" → 40+ variants → "Lock in translations"
14. Switch to Merna → **Step 8:** Click "Activate Campaign"
15. Switch to Anna (Marketing Analyst)
16. **Step 9:** Click "Run Performance Analyzer" → KPIs, attribution, forecast → "Lock in"
17. **Step 10:** Click "Generate Report via Claude" → AI summary → optionally "Send to Team via Email" → "Send to Leadership"

### Flow 2: Agentic Compliance + Evidence Deep Dive

**Goal:** Show Claude making real-time tool-calling decisions with full evidence transparency.

1. Navigate to `/` → click "Merna"
2. Select "Mother's Day Beauty Event" (pre-seeded at Step 6)
3. **Step 6a fires automatically.** Watch:
   - "Claude is analyzing..." loading state
   - Compliance findings appear with pass/warn/fail badges
   - Confidence indicator (High/Medium/Low)
4. Click the **"Evidence" pill** on the compliance card
5. In the Evidence side panel, show:
   - RAG Documents Retrieved (4 docs with relevance ratings)
   - **Agentic Trace** section — Claude's reasoning before each tool call, the tool input/output, Claude's conclusion
6. Click **"Open full evidence view"** → `/evidence` page with step tabs
7. Navigate to Step 6b — Brief fires automatically
8. Click Evidence on the brief card — show how it references Step 6a's compliance output
9. If there's a compliance failure, click **"Reject"** → enter reason → show audit log entry
10. Click **"Rerun"** → watch cascade invalidation clear downstream → compliance re-fires fresh

### Flow 3: CEO Escalation Handling

**Goal:** Show executive oversight with dual co-CEOs.

1. Navigate to `/` → click "Merna"
2. At Step 6a, after compliance fires, click **"Escalate"** → enter reason: "Need CEO guidance on MAP pricing interpretation"
3. Switch persona to **Prof. Vincent** (Co-CEO) via dropdown
4. Click **"Overrides"** in the CEO sidebar → scrolls to escalation queue on Dashboard
5. See the escalation: "Mother's Day Beauty Event — Need CEO guidance on MAP pricing interpretation"
6. Navigate into the campaign → Step 6a shows the escalated state
7. Vincent can: **Approve** (override the AI), **Edit** (modify the finding), **Reject** (send back with specific instructions)
8. Take an action → audit log records: "Prof. Vincent approved escalated Step 6a at [timestamp]"
9. Switch to **Prof. Thales** → show same dashboard, same escalation queue (shared state)
10. Show that both CEOs see the action Vincent just took in the audit trail
11. Navigate to `/impact` → show the per-campaign hours saved updating in real time

---

*5 LLM skills (2 agentic, 3 pre-fetch) · 6 deterministic automations · 2 MCP tools · 12 RAG documents · 6 personas · 3 demo campaigns*
