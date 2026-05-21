// Typed fetch wrappers for the FastAPI backend.
//
// API_BASE is read from NEXT_PUBLIC_API_URL at build time so the same code
// runs locally (default localhost:8000) and against the deployed Render
// backend on Vercel (set NEXT_PUBLIC_API_URL to the Render URL).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Render free tier sleeps after ~15 minutes of inactivity. The first request
// after sleep takes 30 to 90 seconds while the dyno spins up. Timeout is set
// to 120s to cover cold starts. Retries once on timeout or 503.
const REQUEST_TIMEOUT_MS = 120_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.status === 503 && attempt === 0) {
        clearTimeout(timeoutId);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (!res.ok) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data.detail || JSON.stringify(data);
        } catch {
          detail = await res.text();
        }
        throw new Error(`API ${res.status} ${res.statusText}: ${detail}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (attempt === 0) continue;
        throw new Error(
          `API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. ` +
            "If this is the first request after a quiet period, the Render free " +
            "tier dyno may still be cold starting. Try again in a few seconds."
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("API request failed after retries.");
}

// ----- Personas -----
export type Persona = {
  id: string;
  title: string;
  name: string;
  initial: string;
  color: string;
  tagline: string;
  avatar: string;
};

export type HeroImage = {
  image_url: string;
  alt: string;
  photographer: string;
  photographer_url: string;
};

export async function fetchHeroImage(
  category: string,
  audience: string,
): Promise<HeroImage> {
  return request<HeroImage>(
    `/api/images/hero?category=${encodeURIComponent(category)}&audience=${encodeURIComponent(audience)}`,
  );
}

export async function fetchPersonas(): Promise<Persona[]> {
  return request<Persona[]>("/personas");
}

// ----- Workflow -----
export type WorkflowStep = {
  number: number;
  name: string;
  owner: string;
  owner_persona_id: string;
  label: "HUMAN_ONLY" | "HUMAN_PLUS_AI" | "HUMAN_PLUS_AUTOMATION" | "HUMAN_PLUS_SKILL" | "FULLY_AUTOMATED";
  status: "pending" | "active" | "complete" | "blocked";
  my_step: boolean;
};

export async function fetchWorkflow(personaId: string, campaignId?: string): Promise<{ persona_id: string; steps: WorkflowStep[] }> {
  const qs = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : "";
  return request(`/workflow/${personaId}${qs}`);
}

// ----- Campaigns (pre seeded demo data) -----
export type Campaign = {
  id: string;
  name: string;
  status: "active" | "planned" | "completed";
  current_step: number;
  current_step_name: string;
  days_remaining: number;
  days_label: string;
  owner_role: string;
  color_indicator: "green" | "yellow" | "gray";
};

export async function fetchCampaigns(): Promise<Campaign[]> {
  return request<Campaign[]>("/campaigns");
}

// ----- Campaign live state (approval flow) -----
export type CampaignHistoryEntry = {
  step: number;
  step_name: string;
  action: string;
  ts: string;
  metadata: Record<string, unknown>;
};

export type RevisionEntry = {
  comment: string;
  requested_by_persona_id: string;
  requested_from_step: number;
  ts: string;
};

export type PendingRevision = {
  step_to_redo: number;
  resume_step: number;
  comment: string;
  requested_by_persona_id: string;
  requested_at: string;
  requested_from_step: number;
};

export type CampaignState = {
  current_step: number;
  completed_steps: number[];
  step_outputs: Record<string, unknown>;
  history: CampaignHistoryEntry[];
  is_complete: boolean;
  revisions: Record<string, RevisionEntry[]>;
  pending_revision: PendingRevision | null;
  evidence?: Record<string, unknown>;
};

export async function fetchCampaignState(campaignId: string): Promise<CampaignState> {
  return request<CampaignState>(`/campaigns/${encodeURIComponent(campaignId)}/state`);
}

export async function advanceCampaign(
  campaignId: string,
  step: number,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<CampaignState> {
  return request<CampaignState>(
    `/campaigns/${encodeURIComponent(campaignId)}/advance`,
    {
      method: "POST",
      body: JSON.stringify({ step, action, metadata: metadata ?? null }),
    },
  );
}

export async function resetCampaign(campaignId: string): Promise<CampaignState> {
  return request<CampaignState>(
    `/campaigns/${encodeURIComponent(campaignId)}/reset`,
    { method: "POST" },
  );
}

// ----- Campaign context (brief + mock data tables) -----

export type CampaignBrief = {
  campaign_id: string;
  name: string;
  sponsor: string;
  filed_days_before_launch: number;
  objective: string;
  target_customer: string;
  promotional_offer: string[];
  campaign_window: { soft_launch: string; peak: string; closeout: string };
  budget: Record<string, string>;
  success_metrics: Record<string, string>;
  constraints: string[];
};

export type SkuSuggestion = {
  sku_id: number;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  base_price: number;
  inventory_status: string;
  inventory_units: number;
  margin_pct: number;
  segment_match_score: number;
  reason: string;
};

// SKU Recommender types
export type RecommendedSku = {
  sku_id: string;
  brand: string;
  name: string;
  category: string;
  subcategory: string;
  msrp: number;
  margin_pct: number;
  inventory_level: number;
  map_protected: boolean;
  vendor_commitment: string;
  seasonal_tags: string[];
  score: number;
  score_pct: number;
  top_reason: string;
  excluded: boolean;
  excluded_reason: string | null;
};

export type ExcludedSku = {
  sku_id: string;
  name: string;
  brand: string;
  reason: string;
};

export type SkuRecommendResult = {
  ok: boolean;
  recommended_skus: RecommendedSku[];
  excluded_skus: ExcludedSku[];
  total_in_category: number;
  criteria_used: string;
};

export async function runSkuRecommend(
  category: string,
  discountPct: number,
  campaignPeriod: string,
  season: string,
  maxResults = 18,
  segmentTopCategory?: string,
): Promise<SkuRecommendResult> {
  return request<SkuRecommendResult>("/skills/sku-recommend", {
    method: "POST",
    body: JSON.stringify({
      category,
      discount_pct: discountPct,
      campaign_period: campaignPeriod,
      season,
      max_results: maxResults,
      segment_top_category: segmentTopCategory ?? null,
    }),
  });
}

// MCP tool: check_pricing_conflicts
export type PricingConflict = {
  sku_id: string;
  brand?: string;
  issue: string;
  severity: "fail" | "warn";
};

export type CheckPricingResult = {
  ok: boolean;
  mcp_tool: string;
  status: "pass" | "warn" | "fail";
  conflicts: PricingConflict[];
  checked_count: number;
  input: { sku_ids: string[]; proposed_discount_pct: number };
};

export async function runCheckPricing(
  skuIds: string[],
  proposedDiscountPct: number,
): Promise<CheckPricingResult> {
  return request<CheckPricingResult>("/skills/check-pricing", {
    method: "POST",
    body: JSON.stringify({
      sku_ids: skuIds,
      proposed_discount_pct: proposedDiscountPct,
    }),
  });
}

// Layout Copy Generator types
export type LayoutPlacement = {
  tagline: string;
  body: string;
  cta: string;
  visual_direction: string;
};

export type LayoutCopyResult = {
  ok: boolean;
  placements: Record<string, LayoutPlacement>;
  validation_errors: string[];
  generation_metadata: {
    skill: string;
    method: string;
    duration_ms: number;
  };
};

export async function runLayoutCopy(brief: {
  name: string;
  objective: string;
  target_customer: string;
  promotional_offer: string[];
  category: string;
}): Promise<LayoutCopyResult> {
  return request<LayoutCopyResult>("/skills/generate-layout-copy", {
    method: "POST",
    body: JSON.stringify(brief),
  });
}

export type LayoutPreview = {
  placement: string;
  dimensions: string;
  headline: string;
  subhead: string;
  cta: string;
  notes: string;
};

export type ApprovalCheckpoint = {
  name: string;
  reviewer: string;
  criteria: string;
  status: string;
  reviewed_at: string;
};

export type ChannelDeployment = {
  channel: string;
  deployment_time: string;
  audience: string;
  expected_volume: string;
  status: string;
};

export type CampaignContext = {
  campaign_brief: CampaignBrief;
  state: CampaignState;
  mock_data: {
    sku_suggestions: SkuSuggestion[];
    layout_previews: LayoutPreview[];
    approval_checkpoints: ApprovalCheckpoint[];
    channel_schedule: ChannelDeployment[];
    executive_summary_template: string;
  };
};

export async function fetchCampaignContext(campaignId: string): Promise<CampaignContext> {
  return request<CampaignContext>(`/campaigns/${encodeURIComponent(campaignId)}/context`);
}

export type CampaignBriefInput = {
  name: string;
  sponsor?: string;
  filed_days_before_launch?: number;
  objective?: string;
  target_customer?: string;
  promotional_offer?: string[];
  campaign_window?: Record<string, string>;
  budget?: Record<string, string>;
  success_metrics?: Record<string, string>;
  constraints?: string[];
  tagline?: string;
  discount_pct?: number;
  regions?: string[];
  skus?: string[];
};

export async function createCampaign(data: CampaignBriefInput): Promise<CampaignBrief> {
  return request<CampaignBrief>("/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCampaign(campaignId: string, data: CampaignBriefInput): Promise<CampaignBrief> {
  return request<CampaignBrief>(`/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ----- Review actions -----

export async function approveStep(campaignId: string, stepId: string, persona = "campaign-manager"): Promise<{ ok: boolean }> {
  return request(`/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}/approve`, {
    method: "POST", body: JSON.stringify({ persona }),
  });
}

export async function editStepOutput(campaignId: string, stepId: string, output: Record<string, unknown>, persona = "campaign-manager"): Promise<{ ok: boolean }> {
  return request(`/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}/output`, {
    method: "PATCH", body: JSON.stringify({ persona, output }),
  });
}

export async function rejectStep(campaignId: string, stepId: string, reason: string, persona = "campaign-manager"): Promise<{ ok: boolean }> {
  return request(`/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}/reject`, {
    method: "POST", body: JSON.stringify({ persona, reason }),
  });
}

export async function escalateStep(campaignId: string, stepId: string, reason = "", persona = "campaign-manager"): Promise<{ ok: boolean }> {
  return request(`/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}/escalate`, {
    method: "POST", body: JSON.stringify({ persona, reason }),
  });
}

export async function fetchAuditLog(campaignId: string): Promise<Array<Record<string, unknown>>> {
  return request(`/campaigns/${encodeURIComponent(campaignId)}/audit-log`);
}

export async function fetchEscalations(): Promise<Array<Record<string, unknown>>> {
  return request("/escalations");
}

// ----- Evidence capture -----

export async function fetchEvidence(campaignId: string, stepId: string): Promise<Record<string, unknown> | null> {
  try {
    return await request<Record<string, unknown>>(`/campaigns/${encodeURIComponent(campaignId)}/evidence/${encodeURIComponent(stepId)}`);
  } catch {
    return null; // 404 = not captured yet
  }
}

export async function storeEvidence(campaignId: string, stepId: string, evidence: Record<string, unknown>): Promise<void> {
  await request(`/campaigns/${encodeURIComponent(campaignId)}/evidence/${encodeURIComponent(stepId)}`, {
    method: "POST",
    body: JSON.stringify(evidence),
  });
}

export async function advanceCampaignWithOutput(
  campaignId: string,
  step: number,
  action: string,
  stepOutput?: Record<string, unknown>,
): Promise<CampaignState> {
  return request<CampaignState>(
    `/campaigns/${encodeURIComponent(campaignId)}/advance`,
    {
      method: "POST",
      body: JSON.stringify({
        step,
        action,
        step_output: stepOutput ?? null,
      }),
    },
  );
}

export async function requestRevisions(
  campaignId: string,
  fromStep: number,
  sendBackToStep: number,
  comment: string,
  requestedByPersonaId: string,
): Promise<CampaignState> {
  return request<CampaignState>(
    `/campaigns/${encodeURIComponent(campaignId)}/request-revisions`,
    {
      method: "POST",
      body: JSON.stringify({
        step: fromStep,
        send_back_to_step: sendBackToStep,
        comment,
        requested_by_persona_id: requestedByPersonaId,
      }),
    },
  );
}

export async function resubmitStep(
  campaignId: string,
  step: number,
): Promise<CampaignState> {
  return request<CampaignState>(
    `/campaigns/${encodeURIComponent(campaignId)}/resubmit/${step}`,
    { method: "POST" },
  );
}

// ----- Chat -----
export type ChatReply = {
  response: string;
  action: string | null;
  data: Record<string, unknown> | null;
};

export async function postChat(personaId: string, message: string): Promise<ChatReply> {
  return request<ChatReply>("/chat", {
    method: "POST",
    body: JSON.stringify({ persona_id: personaId, message }),
  });
}

// ----- Skills -----
export type Segment = {
  name: string;
  definition: string;
  customer_count: number;
  avg_recency_days: number;
  avg_frequency: number;
  avg_monetary: number;
  top_category: string | null;
  top_category_lift: number;
  loyalty_mix: Record<string, number>;
};

export type SegmentResult = {
  ok: boolean;
  brief: string;
  segments: Segment[];
  total_clustered: number;
};

export async function runSegment(brief: string): Promise<SegmentResult> {
  return request<SegmentResult>("/skills/segment", {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
}

export type DamAsset = {
  rank: number;
  asset_id: number;
  filename: string;
  asset_type: string;
  tags: string[];
  resolution: string;
  usage_rights: string;
  relevance_score: number;
  quality_flag: string;
};

export type DamStats = {
  total_searched: number;
  filtered_out: { degraded: number; expired_rights: number; low_resolution: number };
  filtered_total: number;
  kept: number;
  returned: number;
  avg_relevance: number;
};

export type DamResult = {
  ok: boolean;
  brief: string;
  max_results: number;
  results: DamAsset[];
  stats: DamStats;
};

export async function runDam(brief: string, maxResults = 12): Promise<DamResult> {
  return request<DamResult>("/skills/dam-search", {
    method: "POST",
    body: JSON.stringify({ brief, max_results: maxResults }),
  });
}

export type Variant = {
  variant_id: string;
  region: string;
  placement: string;
  sku_id: number;
  sku_name: string;
  regional_price: number;
  master_price: number;
  price_difference_pct: number;
  inventory_status: string;
  inventory_units: number;
  copy_headline: string;
  copy_subhead: string;
  cta_text: string;
  placement_dimensions: string;
  master_image_reference: string;
  generated_at: string;
  price_flag?: string;
};

export type LocalizeStats = {
  total_variants: number;
  regions: number;
  placements: number;
  skus: number;
  by_region: Record<string, number>;
  by_placement: Record<string, number>;
  inventory_alerts: Array<{ sku_id: number; sku_name: string; region: string; status: string; units: number }>;
  price_alerts: Array<{ sku_id: number; sku_name: string; region: string; regional_price: number; master_price: number; pct_diff: number }>;
  avg_price_diff_pct: number;
};

export type LocalizeResult = {
  ok: boolean;
  brief: string;
  sku_ids: number[];
  variants: Variant[];
  stats: LocalizeStats;
};

export async function runLocalize(brief: string, skuIds: number[]): Promise<LocalizeResult> {
  return request<LocalizeResult>("/skills/localize", {
    method: "POST",
    body: JSON.stringify({ brief, sku_ids: skuIds }),
  });
}

export type ChannelAttribution = {
  channel: string;
  revenue: number;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cac: number;
  rank: number;
};

export type SegmentAttribution = {
  segment: string;
  conversions: number;
  revenue: number;
  customer_base: number;
  conversion_rate: number;
  lift_vs_avg: number;
};

export type SkuAttribution = { sku_id: number; name: string; revenue: number; units: number };

export type ForecastBlock = {
  predicted: number;
  lower_bound: number;
  upper_bound: number;
  trend_direction: "up" | "down" | "flat";
};

export type Analysis = {
  campaign_id: number;
  campaign_name: string;
  campaign_status: string;
  campaign_window: { start: string; end: string; days: number };
  totals: { revenue: number; spend: number; conversions: number; roas: number };
  attribution: {
    by_channel: ChannelAttribution[];
    by_segment: SegmentAttribution[];
    by_sku_revenue: SkuAttribution[];
    by_sku_units: SkuAttribution[];
    top_channel: string | null;
    worst_channel: string | null;
    top_segment: string | null;
  };
  forecast: {
    horizon_days: number;
    history_days: number;
    forecast_status: "success" | "insufficient_data";
    revenue: ForecastBlock | null;
    conversions: ForecastBlock | null;
    roas: ForecastBlock | null;
    message?: string;
  };
  summary: string;
  generated_at: string;
};

export type AnalyzeResult = {
  ok: boolean;
  analysis: Analysis;
};

export async function runAnalyze(campaignId: number, forecastDays = 14): Promise<AnalyzeResult> {
  return request<AnalyzeResult>("/skills/analyze", {
    method: "POST",
    body: JSON.stringify({ campaign_id: campaignId, forecast_days: forecastDays }),
  });
}
