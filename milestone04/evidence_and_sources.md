# Evidence and Sources: How the AI Coworker Shows Its Work

## Overview

An AI coworker that just gives an answer is a black box. Our system is designed so every AI output can be traced back to the data, documents, and tools it relied on. M1's process analysis found that the manual workflow produced "files named 'final,' 'final2,' 'final_v3' with no version control," a symptom of decisions made without traceable evidence. Our M4 system inverts this pattern: every AI-generated compliance finding, approval brief, and revision routing is paired with a persistent evidence record that shows exactly what went in and what came out. The Evidence screen, the Evidence side panel, and the audit log are the runtime mechanisms that make this traceability real.

## What Data the AI Uses

The AI coworker draws on three structured data sources, each connected to specific workflow steps:

| Source | Records | Used By | Step |
|---|---|---|---|
| `macys.db` customers table | 50,000 synthetic customers with RFM features (recency, frequency, monetary value) | Audience Segment Builder automation | Step 2: Segmentation |
| `product_catalog.json` | 61 SKUs across 27 brands with inventory depth, margin, vendor commitment, MAP floor price | SKU Recommender automation, `check_pricing_conflicts` MCP tool | Step 3: SKU Selection, Step 6a: Compliance |
| `macys.db` dam_assets table | 5,000 DAM assets with tags, region rights, and category metadata | DAM Asset Finder automation, `find_dam_assets` MCP tool | Step 4: Creative Production |

The M1 design called for Macy's real Star Rewards loyalty database (nearly 30 million members), the Xinet WebNative DAM (100,000+ production images), and the Pricing Engine API. The M3 implementation simulates these with SQLite and JSON to make the system reproducible for the class context. The architecture is designed so swapping in real data sources requires changing only the data layer, not the skill or automation interfaces. The AI skills and MCP tools consume data through defined contracts, not direct database queries.

## What Documents the AI Uses

The AI retrieves context from 12 RAG documents stored in a FAISS vector index. Each document was chunked and embedded using a shared SentenceTransformer model. Two index variants exist: a naive FAISS index (78 chunks, keyword-level matching) and a HyQ index (381 entries including 303 synthetically generated questions, semantic-level matching). The system uses HyQ for production retrieval. On a benchmark of 8 test queries, HyQ retrieves the correct document in 8 of 8 cases versus 5 of 8 for naive.

| # | Doc ID | Title | Used By | Step |
|---|---|---|---|---|
| 1 | BRAND-GL-2026-001 | Brand Guidelines | Compliance Pre Check | 6a |
| 2 | APPROVAL-POLICY-2026-001 | Approval Policy | Approval Brief Generator | 6b |
| 3 | LEGAL-DIS-2026-002 | Legal Disclaimer Requirements | Compliance Pre Check | 6a |
| 4 | PRICE-RULES-2026-001 | Pricing and Promotion Rules | Compliance Pre Check | 6a |
| 5 | DAM-POLICY-2026-001 | DAM Tagging Policy | DAM Asset Finder context | 4 |
| 6 | LOC-STYLE-2025-002 | Localization Style Guide | Localization Generator, `generate_locale_variants` MCP tool | 7 |
| 7 | RETRO-Q4-2025 | Q4 2025 Holiday Campaign Retrospective | Approval Brief Generator | 6b |
| 8 | RETRO-SP-2025-BTY | Spring 2025 Beauty Campaign Retrospective | Approval Brief Generator | 6b |
| 9 | TICKET-INC-2025-4471 | Past Approval Ticket (revision routing example) | Revision Router | 6c |
| 10 | TICKET-INC-2026-0212 | Clean Approval Cycle Reference | Revision Router | 6c |
| 11 | COMP-EX-2026-001 | Compliance Flag Examples | Compliance Pre Check | 6a |
| 12 | TEAM-FAQ-2026-001 | Internal Team FAQ | Cross-cutting reference | All |

The RAG retrieval pipeline works as follows: the skill sends a natural-language query (e.g., "What are the brand alignment rules for beauty campaigns?"), the retriever embeds the query and searches the HyQ FAISS index, and the top-k passages are injected into the LLM prompt as grounding context. The skill's output includes the `retrieved_docs` field listing which document IDs were used, and this field is captured in the evidence record.

## What Tools and Functions the AI Uses

### MCP Tools

Three MCP tools wrap Python functions that connect AI skills to external data. Each tool is registered via FastMCP and invoked by the orchestrator's skill invoker during pre-fetch:

| Tool | Python Function | Used By | What It Returns |
|---|---|---|---|
| `check_pricing_conflicts` | MAP validation against a hardcoded brand list (Levi's, Coach, Lancome, Estee Lauder, Clinique, La Mer, Dior Beauty, Tag Heuer) | Compliance Pre Check | Pass/warn/fail per SKU with conflict details and the MAP floor price that was violated |
| `find_dam_assets` | DAM lookup with rights filtering and relevance scoring | DAM Asset Finder, Localization Generator | Ranked asset list with tags, rights status, and relevance scores |
| `generate_locale_variants` | Phrase substitution table with regional pricing and language mappings | Localization Generator | Translated copy per region with quality flags for manual review |

The Evidence screen shows every MCP tool call with its exact input parameters and output JSON, so the reviewer can verify what the tool was asked and what it returned. This is the primary mitigation for Failure Case 3 (MCP tool returns stale or incomplete data): the tool's output is not hidden behind the AI's summary, it is visible in full.

### Deterministic Automations

Seven automations handle workflow steps that require computation but not LLM judgment. These run deterministic Python functions, not language models:

| Automation | What It Computes | Step |
|---|---|---|
| Audience Segment Builder | K-means clustering (k=3) on RFM features from 50K customers | Step 2 |
| SKU Recommender | Multi-factor scoring: vendor commitment 30%, margin 25%, inventory 25%, seasonality 20% | Step 3 |
| DAM Asset Finder | Tag relevance ranking across 5,000 assets | Step 4 |
| Localization Generator | Template expansion across 10 regions x 4 placements (up to 40 variants) | Step 7 |
| Localization Generator v1 | Region and language mapping with phrase substitution | Step 7 |
| Activation Scheduler | Timezone-aware send time optimization with frequency caps | Step 8 |
| Campaign Performance Analyzer | Last-touch attribution and linear regression forecast with 80% confidence interval | Step 9 |

Because these are deterministic, their outputs are fully reproducible given the same inputs. The evidence for automation steps shows the input parameters and computed results, not LLM reasoning chains.

### LLM Skills

Four skills invoke Claude via the TritonAI API through the `ask()` helper in `utils/connect.py`. Each skill receives pre-fetched RAG context and MCP tool outputs, then produces structured JSON:

| Skill | Prompt Contract | Step |
|---|---|---|
| Compliance Pre Check | Scans copy against brand, legal, and pricing rules; returns 3 findings with pass/warn/fail | Step 6a |
| Approval Brief Generator | Writes VP-ready brief with goal, audience, ROI, risk flags, recommendation | Step 6b |
| Revision Router | Classifies VP revision comment into change type, owner, and urgency | Step 6c |
| Layout Copy Generator | Drafts tagline, body, CTA, and visual direction for 4 placements | Step 5 |

## How the User Sees the Evidence

The M4 UI provides two surfaces for inspecting evidence, designed so reviewers never need to trust the AI's output without seeing what it used.

### The Evidence Side Panel

Every AI output card in the workflow includes an "Evidence" pill button. Clicking it opens a slide-out panel (480 to 520 pixels on desktop, full-width on mobile) without navigating away from the current step. The panel displays 5 collapsible sections:

1. **RAG Documents Retrieved** — Document IDs, relevance ratings (high or medium), and the exact text passages the AI consumed. Each passage is expandable so the reviewer can read the full context, not just the sentence the AI cited.
2. **MCP Tool Calls** — The tool name, the input parameters sent (e.g., SKU IDs and proposed discount percentage), and the complete output JSON. Nothing is summarized away.
3. **Data Sources** — Which database tables or files were queried, with row counts and filters applied.
4. **Prior Step Outputs Referenced** — Shows the lineage of decisions. For Step 6b, this section shows that the Step 6a compliance result was consumed as input, making cascade dependencies visible (relevant to Failure Case 6 in our failure analysis).
5. **Assumptions and Limitations** — Statements the skill makes about what it assumed or what it could not verify, giving the reviewer explicit signals about where the AI's confidence is warranted and where it is not.

### The Full Evidence Screen

The dedicated Evidence screen at `/evidence` provides the same content with more room to inspect documents in depth. Step tabs (6a Compliance, 6b Brief, 6c Revision Router) let the reviewer navigate between steps to compare evidence across the cascade. A document viewer modal displays the full retrieved passage with the relevant section highlighted. The screen indicates whether the displayed evidence is "live captured" from this campaign run (green indicator) or static example evidence used as a fallback (amber indicator).

### Capture Once, Replay Forever

Evidence is captured at the moment of AI invocation and persisted to the backend via the `storeEvidence()` API call. The frontend fires this call as soon as the AI skill returns, storing the RAG documents retrieved, MCP tool inputs and outputs, prior step references, and a result summary. This evidence is then available indefinitely — re-reviewing a decision a week later shows the same evidence the AI actually used at decision time, not a reconstructed approximation. The audit log records every Review action (Approve, Edit, Reject, Rerun, Escalate) alongside the evidence that was available when the decision was made.

## What Happens If Evidence Is Missing, Weak, or Conflicting

### Missing Evidence

If a skill is invoked but no RAG documents match above the relevance threshold, the skill returns a low-confidence result and the Evidence panel shows an empty "RAG Documents Retrieved" section with an explanatory note. The confidence indicator drops to "Low," signaling to the reviewer that the AI lacked grounding context. The reviewer can then Reject the output on the Review screen and Escalate to CEO Vincent for guidance on whether to add new RAG documents to cover the gap. This is the designed recovery path: the system does not hide the absence of evidence behind a confident-sounding answer.

### Weak Evidence

The HyQ retrieval index (381 entries) significantly outperforms the naive FAISS index (78 chunks) — 8 of 8 correct retrievals versus 5 of 8 on our benchmark. But even HyQ can return low-relevance matches when the query falls outside the training distribution of the 12 documents. When retrieval scores fall below 0.5, the confidence indicator drops and the Evidence panel shows the low scores explicitly. The `/rag-compare` demo page lets reviewers compare naive versus HyQ retrieval side-by-side, building intuition for when the RAG system is confident and when it is reaching. The system uses HyQ for all production retrieval and falls back to naive only for the comparison demo.

### Conflicting Evidence

The most dangerous scenario is when two evidence sources disagree — for example, when the `check_pricing_conflicts` MCP tool returns PASS for an SKU but the BRAND-GL-2026-001 RAG document lists that SKU's brand as MAP-protected. This is Failure Case 3 from our failure analysis: the MCP tool uses a hardcoded brand list that may not reflect recent vendor negotiations, while the RAG document may contain a more current (or more stale) version of the same policy.

When the MCP tool result and the RAG document content disagree, both are visible in the Evidence panel. The compliance skill's deterministic helpers (banned-word scan, tagline list check) serve as a third signal. The reviewer sees all three inputs and must reconcile them before selecting a Review action. If the conflict cannot be resolved, the Escalate action routes the decision to CEO Vincent with the full evidence trail attached. The audit log preserves the conflict and the resolution for downstream accountability.

## Connection to the M4 Process

The evidence system is the runtime mechanism that makes the human review checkpoints documented in `human_review_plan.md` effective. Without evidence visibility, the 5 Review actions (Approve, Edit, Reject, Rerun, Escalate) would be uninformed guesses. The Evidence panel gives reviewers the factual basis to exercise judgment, and the audit log preserves their reasoning for downstream accountability. The failure modes documented in `failure_cases.md` — stale RAG retrieval, LLM hallucination, MCP data gaps, misleading confidence — are all detectable because the evidence is shown, not hidden. The combination of transparent evidence, human review gates, and persistent audit logging is what allows the AI coworker to augment the campaign team's judgment rather than replace it.
