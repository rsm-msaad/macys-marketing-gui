/**
 * Evidence data model for the M4 Evidence screen.
 *
 * Each AI-driven step produces an evidence record that includes
 * RAG documents used, MCP tools called, data sources, prior step
 * outputs, and assumptions.
 */

export type RagDocEvidence = {
  doc_id: string;
  title: string;
  section: string;
  relevance: "high" | "medium" | "low";
  passage: string;
};

export type McpToolEvidence = {
  tool_name: string;
  inputs: Record<string, unknown>;
  output_summary: string;
  status: "success" | "warning" | "failure";
};

export type DataSourceEvidence = {
  name: string;
  description: string;
  rows?: string;
};

export type PriorOutputEvidence = {
  step: number;
  step_name: string;
  field: string;
  summary: string;
};

export type StepEvidence = {
  step: number;
  step_name: string;
  skill_name: string;
  skill_type: "skill" | "automation";
  triggered_by: string;
  rag_docs: RagDocEvidence[];
  mcp_tools: McpToolEvidence[];
  data_sources: DataSourceEvidence[];
  prior_outputs: PriorOutputEvidence[];
  assumptions: string[];
};

/** RAG document metadata for the "View full document" modal. */
export const RAG_DOC_META: Record<string, { title: string; description: string }> = {
  "BRAND-GL-2026-001": { title: "Brand Guidelines", description: "Banned words, approved taglines, and campaign copy rules" },
  "APPROVAL-POLICY-2026-001": { title: "Approval Policy", description: "Campaign approval workflow and authorization rules" },
  "LEGAL-DIS-2026-002": { title: "Legal Disclaimer Requirements", description: "Required disclaimers for percent-off pricing and Star Rewards" },
  "PRICE-RULES-2026-001": { title: "Pricing and Promotion Rules", description: "MAP minimums, brand exclusions, stacking ceiling" },
  "DAM-POLICY-2026-001": { title: "DAM Tagging Policy", description: "Digital asset tagging standards and rights policies" },
  "LOC-STYLE-2025-002": { title: "Localization Style Guide", description: "Spanish/French localization rules, holiday calendar" },
  "RETRO-Q4-2025": { title: "Q4 2025 Holiday Retro", description: "Q4 2025 Holiday campaign retrospective with ROAS benchmarks" },
  "RETRO-SP-2025-BTY": { title: "Spring 2025 Beauty Retro", description: "Spring 2025 Beauty campaign retrospective" },
  "TICKET-INC-2025-4471": { title: "Revision Ticket INC-4471", description: "Past revision: pricing language fix, MAP brand clearance" },
  "TICKET-INC-2026-0212": { title: "Approval Ticket INC-0212", description: "Clean approval cycle reference for benchmarking" },
  "COMP-EX-2026-001": { title: "Compliance Flag Examples", description: "Compliance flag examples by category (Beauty, Home)" },
  "TEAM-FAQ-2026-001": { title: "Internal Team FAQ", description: "Internal team FAQ and runbook references" },
};

/** Pre-built evidence for each AI step of the demo campaign. */
export function getStepEvidence(step: string): StepEvidence | null {
  return STEP_EVIDENCE[step] ?? null;
}

const STEP_EVIDENCE: Record<string, StepEvidence> = {
  "6a": {
    step: 6,
    step_name: "Compliance Pre Check",
    skill_name: "compliance-pre-check",
    skill_type: "skill",
    triggered_by: "Merna (Campaign Manager)",
    rag_docs: [
      { doc_id: "BRAND-GL-2026-001", title: "Brand Guidelines", section: "Banned Words and Approved Taglines", relevance: "high", passage: "The following words are banned from all campaign copy: blowout, liquidation, clearance, fire sale, going out of business, everything must go, doorbuster, lowest price ever." },
      { doc_id: "LEGAL-DIS-2026-002", title: "Legal Disclaimer Requirements", section: "Percent-Off Claims", relevance: "high", passage: "Any 'up to X percent off' claim must include the minimum discount available, formatted as 'starting at Y percent off'. FTC representative pricing guidance requires that the advertised range accurately reflects what is available." },
      { doc_id: "PRICE-RULES-2026-001", title: "Pricing Rules", section: "MAP Enforcement", relevance: "high", passage: "MAP-enforced brands (Levi's, Coach, Lancome, Estee Lauder, Clinique, La Mer, Dior Beauty, Tag Heuer) cannot be discounted below their negotiated MAP floor without written Merchandising approval." },
      { doc_id: "COMP-EX-2026-001", title: "Compliance Flag Examples", section: "Beauty Category Flags", relevance: "medium", passage: "Common Beauty compliance flags: unauthorized prestige brand discounts, missing Star Rewards disclaimer, percent-symbol format instead of written-out 'percent off'." },
    ],
    mcp_tools: [
      { tool_name: "check_pricing_conflicts", inputs: { sku_ids: ["Ruby Woo Lipstick", "Advanced Night Repair Serum 50ml"], proposed_discount_pct: 15 }, output_summary: "2 SKUs not found in product catalog. Cannot verify MAP compliance.", status: "warning" },
    ],
    data_sources: [
      { name: "RAG Knowledge Base", description: "12 proprietary Macy's documents indexed with FAISS", rows: "78 chunks (naive) / 381 entries (HyQ)" },
      { name: "Product Catalog", description: "SKU catalog for MAP validation via MCP tool", rows: "61 SKUs" },
    ],
    prior_outputs: [],
    assumptions: [
      "Assumes English copy for compliance scanning",
      "Pricing rules current as of January 2026",
      "SKU names must match catalog exactly for MAP validation",
      "Banned word list is maintained by Brand Council and updated quarterly",
    ],
  },
  "6b": {
    step: 6,
    step_name: "Approval Brief Generator",
    skill_name: "approval-brief-generator",
    skill_type: "skill",
    triggered_by: "System (auto-fires after compliance)",
    rag_docs: [
      { doc_id: "RETRO-SP-2025-BTY", title: "Spring 2025 Beauty Retro", section: "Performance Benchmarks", relevance: "high", passage: "Spring 2025 Beauty achieved paid social ROAS of 4.2x and email open rate of 32% for Beauty Loyalists segment. Total revenue $682K on $250K spend." },
      { doc_id: "RETRO-Q4-2025", title: "Q4 2025 Holiday Retro", section: "Cross-Channel Attribution", relevance: "medium", passage: "Holiday 2025 saw email drive 38% of total revenue with 4.6x ROAS. Paid social underperformed at 2.1x ROAS. In-store signage contributed 12% of foot traffic." },
    ],
    mcp_tools: [],
    data_sources: [
      { name: "RAG Knowledge Base", description: "Campaign retrospective documents for ROI benchmarking" },
    ],
    prior_outputs: [
      { step: 6, step_name: "Compliance Pre Check", field: "compliance_check", summary: "All 3 findings (brand alignment, disclaimers, pricing) and recommended action" },
    ],
    assumptions: [
      "ROI benchmarks from prior campaigns may not directly transfer to this campaign's audience and timing",
      "Brief is drafted for VP review, not final customer-facing content",
      "Compliance findings are taken as given (not re-verified)",
    ],
  },
  "6c": {
    step: 6,
    step_name: "Revision Router",
    skill_name: "revision-router",
    skill_type: "skill",
    triggered_by: "VP (triggered when VP clicks Revise)",
    rag_docs: [],
    mcp_tools: [],
    data_sources: [],
    prior_outputs: [
      { step: 6, step_name: "Compliance Pre Check", field: "compliance_check", summary: "Compliance findings inform the change type classification" },
      { step: 6, step_name: "Approval Brief", field: "approval_brief", summary: "Brief risk flags inform urgency assessment" },
    ],
    assumptions: [
      "VP revision comment is in English",
      "Owner mapping is fixed: copy->Merna, imagery->Abdullah, pricing->Anna, localization->Shankar",
      "Urgency threshold: >$500K spend AND <=5 business days = high",
      "Comment must map to exactly one change type (no multi-category revisions)",
    ],
  },
};
