# Time, Cost, and Quality Estimates: Macy's Marketing AI Coworker

## Overview

M1 documented that a typical Macy's promotional campaign takes 6 to 8 weeks end-to-end, with the majority of time spent on manual coordination rather than creative work. This document estimates how AI-supported automation changes those numbers. All estimates use M1's documented baselines and apply ranges where confidence is lower. M1 also noted that "up to 40% of retail promotions fail to deliver a positive ROI, often due to poor execution and timing rather than poor strategy," so time savings matter only if quality holds. The quality measures at the end of this document evaluate whether the AI coworker improves outcomes, not just throughput.

## Assumptions

All numbers in this document use the following assumptions:

- **Hourly labor cost:** $75/hour fully loaded (salary + benefits + overhead) for a mid-level marketing or design role at Macy's. This is a class-context estimate based on public sources for retail marketing roles in NYC and major metro markets; actual costs vary by role and geography.
- **A "case"** is one promotional campaign moving through the full 10-step workflow.
- **"Current time"** uses the per-step durations documented in M1 Process Documentation (pages 6-15).
- **"AI-supported time"** uses M1 User Stories projections where available, and our own reasoning for steps not covered in user stories.
- **Time savings assume** the AI cascade works as designed and human review captures errors before they propagate downstream (the mitigation strategy documented in `failure_cases.md`).
- **Confidence levels:** High = M1 documented both current and projected durations. Medium = M1 documented current, we estimated AI-supported. Low = significant uncertainty in either direction.

## Per-Step Time Estimates

| Step | Current Time per Campaign | AI-Supported Time per Campaign | Why Time Changes | Confidence |
|---|---|---|---|---|
| **1. Briefing** | 3 to 5 business days | 2 to 4 hours | The /start screen forces a structured brief in one session with required fields and a 200-character minimum description. Eliminates the back-and-forth email and Slack clarification cycles that M1 documented as the primary bottleneck at Step 1. | Medium |
| **2. Segmentation** | 2 to 3 business days | 2 to 4 hours | The Audience Segment Builder automation runs k-means clustering on 50,000 customers instantly. The analyst reviews 3 segments and selects one, rather than manually pulling CSV exports and running offline analysis. M1 user stories projected this exact reduction. | High |
| **3. SKU Selection** | 3 to 5 business days | 4 to 6 hours | The SKU Recommender automation scores 2,000 SKUs using a weighted formula (vendor commitment 30%, margin 25%, inventory 25%, seasonality 20%). MAP-protected SKUs are auto-excluded. The merchandiser reviews a ranked list with red badges on MAP conflicts rather than cross-referencing spreadsheets manually. | Medium |
| **4. Creative Production** | 5 to 10 business days | 1 to 2 business days | The DAM Asset Finder automation reduces per-asset search time from 15-30 minutes (M1 documented) to seconds. The `find_dam_assets` MCP tool handles relevance scoring and rights filtering. The designer focuses on creative direction and art selection rather than metadata hunting across Xinet WebNative. | High |
| **5. Layout Assembly** | 5 to 7 business days | 1 to 2 business days | The Layout Copy Generator skill drafts initial tagline, body copy, CTA, and visual direction for 4 placements (web banner, email, mobile, in-store signage). The production artist refines AI-drafted copy rather than starting from a blank page. Character limits are enforced per placement. | Medium |
| **6. Final Approval (6a + 6b + 6c)** | 3 to 7 business days (often 10+ with revision rounds) | 2 to 4 hours | The Compliance Pre Check skill runs in under 3 minutes against 4 RAG documents and the `check_pricing_conflicts` MCP tool. The Approval Brief Generator auto-drafts a VP-ready brief. The Revision Router classifies and assigns revision comments instantly. M1 documented 2 to 4 revision rounds per campaign; AI pre-checking reduces this to 1 round in most cases by catching issues before the VP sees the brief. | Medium |
| **7. Localization** | 5 to 8 business days | 1 to 2 hours | The Localization Generator automation creates up to 40 variants across 10 regions and 4 placements automatically. The `generate_locale_variants` MCP tool handles transcreation to Spanish and Quebec French. The production artist spot-checks 4 to 6 variants instead of manually producing all 40 to 50 files that M1 documented as the production bottleneck. | High |
| **8. Activation** | 1 to 3 business days | 2 to 4 hours | The Activation Scheduler automation computes timezone-aware send times and frequency caps. The media coordinator reviews and confirms instead of building the per-channel schedule from scratch. | Low |
| **9. Monitoring** | Ongoing + 1 to 2 days for consolidated report | Ongoing + 2 to 4 hours for AI-drafted analysis | The Campaign Performance Analyzer automation computes daily KPIs, last-touch attribution, and a linear regression forecast with an 80% confidence interval. The analyst layers strategic insight on top of pre-computed numbers rather than pulling data from 4 to 5 separate platform dashboards. | Medium |
| **10. Reporting** | 1 to 2 weeks post-campaign | 1 to 2 business days | The report generator drafts an executive summary from the full audit trail (all 10 steps, every Approve/Edit/Reject/Rerun/Escalate action). The Campaign Manager finalizes and adds qualitative learnings. M1 documented that post-campaign reports were often delayed or incomplete because reconstructing the decision trail was manual. | Low |

## Summary Table

| Metric | Current Process | AI-Supported Process | Expected Change |
|---|---|---|---|
| Total time per campaign (end-to-end) | 6 to 8 weeks (30 to 40 business days) | 1 to 2 weeks (5 to 10 business days) | 70-80% reduction |
| Human review time | Embedded throughout, hard to isolate | 4 to 8 hours of explicit review across all gates | More concentrated, more visible |
| Number of manual data handoffs | M1 documented "every single transfer is manual" across all 10 steps | 0 between AI skills and automations; ~5 human approval gates | Near-elimination of manual handoffs |
| Revision rounds at Step 6 | 2 to 4 rounds per campaign | 1 round in most cases (AI pre-check catches issues earlier) | 50-75% reduction |
| Rework risk | High — compliance defects, MAP violations, and brief inconsistencies frequently trigger mid-flight corrections or post-launch rework | Low — Compliance Pre Check and structured brief validation catch most defects before the VP review gate | Substantial reduction; remaining risk covered in `failure_cases.md` |
| Localization variants per campaign | 40 to 50 manually created files | 40 to 50 auto-generated, 4 to 6 spot-checked | Same output, ~95% less labor |
| Stakeholder wait time for VP approval | 2 to 3 days after submission | Same day or next day (brief is pre-drafted, compliance pre-checked) | Faster decision cycle |

## Cost Reasoning

Elapsed calendar days and labor hours are separate measures. Elapsed days include waiting, handoffs, and coordination overhead. Labor hours count only actual hands-on work. Dollar savings are computed from labor hours, not elapsed days.

```
Labor savings per campaign = (baseline labor hours - AI labor hours) * hourly rate
```

**Labor hours per campaign (current):** Across all 10 steps, the campaign team (campaign manager, designer, production artist, analyst, legal reviewer) spends approximately 154 hands-on labor hours per campaign. This is less than the elapsed calendar time (30-40 business days) because much of the elapsed time is waiting for handoffs, approvals, and coordination rather than active work. At $75/hour fully loaded, total labor cost per campaign: approximately $11,550.

**Labor hours per campaign (AI-supported):** With AI automations and skills handling data gathering, drafting, and computation, the team spends approximately 34 hands-on labor hours per campaign — concentrated on review, judgment, and strategic decisions at the 5 approval gates. At $75/hour, total labor cost: approximately $2,550. Estimated savings per campaign: approximately $9,000 (range: $7,500 to $10,500). At 65 to 100 distinct campaigns per year (see breakdown below), annual labor savings range from approximately $585,000 to $900,000. This is a class-context estimate based on reasoned assumptions, not a guaranteed projection.

**Costs not yet netted:** These savings are gross labor savings before subtracting: (1) AI API costs ($0.50 to $2.00 per campaign run for 5 LLM skills via TritonAI/Claude; 7 deterministic automations at negligible compute cost), and (2) estimated rework from Pattern 4 agentic over-flagging (~1-2h on an estimated ~30% of campaigns — estimated from limited testing (2 runs), not a measured production rate — where the compliance skill flags clean copy for unnecessary revision). Net savings after these costs are approximately 90-95% of gross savings.

### Where Does the 65 to 100 Campaigns per Year Estimate Come From?

| Campaign Source | Annual Count | Notes |
|---|---:|---|
| Weekly promotional campaigns | ~52 | Macy's documented weekly promo slot running through the year |
| Major event-driven campaigns | 10-15 | Mother's Day, Father's Day, Back to School, Black Friday, Christmas, Valentine's Day, and similar tentpole events that may fall outside the weekly slot |
| Brand-specific launches | 5-10 | New product launches, exclusive collections, vendor co-op events outside the weekly cadence (e.g., Lancome Spring launch, Coach Capsule Collection) |
| **Total distinct campaigns** | **65-100** | Each unique campaign counted once, regardless of overlapping classifications |

A single Macy's campaign can be classified multiple ways simultaneously. The Mother's Day Beauty Event, for example, is a weekly campaign slot, a seasonal Spring campaign, a vendor co-op campaign (Lancome and Estee Lauder share funding), an event-driven campaign (Mother's Day), and a Star Rewards loyalty campaign. We count each distinct campaign once. This range is a reasoned estimate from Macy's documented operations, public reporting, and industry norms. Actual volume would require internal data to confirm.

## Quality Estimates

Time savings are necessary but not sufficient. If AI saves time at the cost of quality, it accelerates the delivery of bad campaigns rather than good ones. These quality measures evaluate whether the AI coworker improves outcomes, not just throughput.

### Quality Measure 1: Compliance Defect Rate

**Current:** Ad-hoc human compliance review at Step 6 with no automated cross-check against the brand guidelines (BRAND-GL-2026-001), legal disclaimers (LEGAL-DIS-2026-002), or pricing rules (PRICE-RULES-2026-001). Defects such as banned words, missing disclaimers, and MAP violations sometimes ship to production and are caught post-launch, triggering mid-flight corrections or vendor co-op funding clawbacks.

**AI-supported:** Every campaign runs through the Compliance Pre Check skill, which scans copy against 4 RAG documents using HyQ retrieval (8/8 correct retrievals on our benchmark) and calls the `check_pricing_conflicts` MCP tool to validate SKU discounts against MAP-enforced brands. Estimated 50-70% reduction in compliance defects reaching launch, based on the assumption that systematic automated checking outperforms ad-hoc review for a defined, document-based ruleset. The remaining 30-50% represents defects that require human judgment beyond what the RAG corpus covers (Failure Cases 1-3 in `failure_cases.md`).

### Quality Measure 2: Brief Consistency Across Campaigns

**Current:** M1 documented "inconsistent brief formats across campaign types." Briefs vary by campaign manager and campaign type, with different structures, different levels of detail, and different assumptions about what downstream teams need. Cross-campaign analysis is difficult because there is no common schema.

**AI-supported:** The /start screen enforces structured fields (Category, Channels, Budget, Launch Date, minimum 200-character description) with validation. Three "Load Example" presets demonstrate the expected level of specificity. All briefs follow the same shape, making cross-campaign comparison possible for the first time. Estimated 80%+ improvement in brief structural consistency, measured by the ability to compare any two campaigns' briefs field-by-field.

### Quality Measure 3: Audit Traceability

**Current:** Revision decisions, approvals, and edits happen in email threads, Slack messages, and file naming conventions ("final," "final2," "final_v3" as M1 documented). Reconstructing why a decision was made after the campaign ends requires hunting through fragmented, ephemeral sources. Estimated traceability: roughly 40% of consequential decisions have a recoverable audit trail.

**AI-supported:** Every Review action (Approve, Edit, Reject, Rerun, Escalate) is logged with timestamp, persona identity, and reason. The Evidence screen captures what RAG documents, MCP tool calls, and prior step outputs informed each AI output. The audit log persists to disk and is available indefinitely. Estimated traceability: roughly 95% of consequential decisions have a complete, timestamped, persona-attributed audit trail. The 5% gap represents informal side-channel decisions (Slack, hallway conversations) that the system cannot capture.

### Quality Measure 4: Data Freshness Gap

**Current:** M1 documented a "2 to 3 week data freshness gap" at Step 2 because segmentation uses CSV exports from the Star Rewards loyalty database that lag the source. By the time the segmentation reaches Step 6, the underlying customer data may be a month old.

**AI-supported:** The Audience Segment Builder automation reads directly from `macys.db` (simulated in M3; in production it would connect to the Star Rewards loyalty database via API per M1's data requirements document). Data freshness gap closes from 2 to 3 weeks to near-zero. This eliminates one of M1's most concrete pain points and directly improves segment targeting accuracy.

## Face Validity Check

### 1. Direction

The AI-supported process reduces time at the coordination-heavy steps (Steps 2-5, 7) where M1 documented the worst manual friction, while preserving or increasing human review time at the judgment-heavy steps (Steps 6a, 6b, 8, 10). This is exactly the pattern expected from a well-designed AI augmentation: maximum savings on mechanical work, minimal cuts on strategic judgment. If the direction were reversed — huge savings on judgment steps, small savings on coordination — that would be a red flag.

### 2. Magnitude

The 70-80% end-to-end reduction sits at the high end of the 30-70% range reported in industry benchmarks for AI-assisted marketing operations. The high end is defensible because we automate not just one workflow segment but the entire 10-step process end-to-end. M1's own user story projections for individual steps (segmentation: ~95% reduction, localization: ~97% reduction) exceed our overall estimate. Our 70-80% is actually more conservative than summing M1's per-step projections because we account for steps with modest improvements (briefing, activation, monitoring).

### 3. Evidence Alignment

Every AI output is paired with an evidence record showing retrieved RAG passages, MCP tool inputs/outputs, and prior step references via the Evidence side panel. Reviewers can verify whether the AI's conclusion is supported by its sources in seconds rather than minutes. The confidence indicator is derived heuristically and can mislead (Failure Case 4), but the Evidence pill provides the factual check that the confidence label cannot.

### 4. Practical Constraints

The design preserves human authority at all consequential gates (Steps 6a, 6b, 8, 10), respects Macy's compliance requirements by flagging pricing and brand violations before they reach customers, does not eliminate any role (it shifts task mix toward higher-value work), and acknowledges that production deployment requires data integration work documented in M1. The time savings will not materialize until those integrations are built.

### Face Validity Anchors

**Anchor 1: Industry benchmarks.** Public reporting on AI-supported marketing automation suggests 30-70% time savings on creative production cycles when AI handles initial drafts and humans refine. Our estimate sits at the high end because we automate the full 10-step process, not just creative production.

**Anchor 2: M1 user stories.** M1's own user stories projected per-step reductions that individually exceed our overall estimate (segmentation: 2-3 days to 2-4 hours, creative production: 10-17 days to 2-4 hours, localization: 5-8 days to 1-2 hours). We are organizing M1's projections into the M4 format, not inventing new numbers.

## Limitations

These estimates assume:

- The AI system performs as designed, and the failure modes documented in `failure_cases.md` materialize at acceptable rates with the mitigations in place.
- Human reviewers fulfill their role at the review gates rather than rubber-stamping (the mitigation for Failure Case 7 depends on Review screen design and organizational culture, not technology alone).
- Data sources are real and live. The M3 implementation uses simulated data (50K synthetic customers, 2,000 SKUs, 5K DAM assets); M1 specified the real APIs and databases for production deployment.
- Macy's organizational change management is sufficient to actually adopt the new workflow. This is a non-technical risk that no amount of AI engineering can eliminate. The best system in the world delivers zero value if the team does not use it.
- AI API costs remain stable. If LLM pricing increases significantly, the cost savings narrow, though they would need to increase by orders of magnitude to offset the labor savings estimated here.
