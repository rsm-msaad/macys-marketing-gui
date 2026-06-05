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

// ----- Cached fallback outputs (real captured data, bundled client-side) -----

let _cachedOutputs: Record<string, unknown> | null = null;

async function getCachedOutputs(): Promise<Record<string, unknown>> {
  if (_cachedOutputs) return _cachedOutputs;
  try {
    const res = await fetch("/cached-outputs.json");
    if (res.ok) _cachedOutputs = await res.json();
  } catch {
    // Silent — fallback not available
  }
  return _cachedOutputs ?? {};
}

/**
 * Race a real API call against a timeout. If the live call fails or times
 * out, silently return the cached real output (captured from a previous
 * successful run). The caller sees the same shape either way.
 */
export async function callWithFallback<T>(
  endpoint: string,
  body: unknown,
  cachedKey: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000 } = opts;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      console.debug(`[callWithFallback] ${cachedKey}: live response`);
      return data as T;
    }
    throw new Error(`${res.status}`);
  } catch {
    // Silent fallback to cached real output
    const cached = await getCachedOutputs();
    const fallback = cached[cachedKey];
    if (fallback) {
      console.debug(`[callWithFallback] ${cachedKey}: using cached fallback`);
      return fallback as T;
    }
    throw new Error(`API call failed and no cached fallback for ${cachedKey}`);
  }
}

// ----- Cached panel fallbacks (GET endpoints for sidebar pages) -----

let _cachedPanels: Record<string, unknown> | null = null;

async function getCachedPanels(): Promise<Record<string, unknown>> {
  if (_cachedPanels) return _cachedPanels;
  try {
    const res = await fetch("/cached-panels.json");
    if (res.ok) _cachedPanels = await res.json();
  } catch {
    // Silent
  }
  return _cachedPanels ?? {};
}

/**
 * Fetch a GET endpoint with a timeout, falling back silently to cached
 * panel data if the backend is asleep or slow.
 */
export async function fetchWithFallback<T>(
  path: string,
  cachedKey: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000 } = opts;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      console.debug(`[fetchWithFallback] ${cachedKey}: live response`);
      return data as T;
    }
    throw new Error(`${res.status}`);
  } catch {
    const cached = await getCachedPanels();
    const fallback = cached[cachedKey];
    if (fallback) {
      console.debug(`[fetchWithFallback] ${cachedKey}: using cached fallback`);
      return fallback as T;
    }
    throw new Error(`GET ${path} failed and no cached fallback for ${cachedKey}`);
  }
}

/**
 * GET endpoint with 10s timeout, falling back to cached-outputs.json.
 * Used for pages that need skill-shaped output data (impact, review).
 */
export async function getWithOutputFallback<T>(
  path: string,
  cachedKey: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000 } = opts;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) return (await res.json()) as T;
    throw new Error(`${res.status}`);
  } catch {
    const cached = await getCachedOutputs();
    const fallback = cached[cachedKey];
    if (fallback) return fallback as T;
    throw new Error(`GET ${path} failed and no cached fallback for ${cachedKey}`);
  }
}

/**
 * Wraps request() with a 10s timeout and panel fallback.
 * For fetches where request() is currently used but we want graceful degradation.
 */
export async function requestWithFallback<T>(
  path: string,
  cachedKey: string,
  init?: RequestInit,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000 } = opts;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) return (await res.json()) as T;
    throw new Error(`${res.status}`);
  } catch {
    const cached = await getCachedPanels();
    const fallback = cached[cachedKey];
    if (fallback) return fallback as T;
    throw new Error(`${path} failed and no cached fallback for ${cachedKey}`);
  }
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
  return fetchWithFallback<Campaign[]>("/campaigns", "campaigns_list");
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
  return callWithFallback<SkuRecommendResult>(
    "/skills/sku-recommend",
    {
      category,
      discount_pct: discountPct,
      campaign_period: campaignPeriod,
      season,
      max_results: maxResults,
      segment_top_category: segmentTopCategory ?? null,
    },
    "step3_sku_recommend",
  );
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
  segment_name?: string;
  segment_customer_count?: number;
  segment_avg_monetary?: number;
}): Promise<LayoutCopyResult> {
  return callWithFallback<LayoutCopyResult>(
    "/skills/generate-layout-copy",
    brief,
    "step5_layout_copy",
  );
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
  display_name?: string;
  descriptor?: string;
  definition: string;
  customer_count: number;
  avg_recency_days: number;
  avg_frequency: number;
  avg_monetary: number;
  top_category: string | null;
  top_category_lift: number;
  loyalty_mix: Record<string, number>;
  response_likelihood: number;
  estimated_value: number;
  value_formula: string;
  response_method: string;
};

export type SegmentResult = {
  ok: boolean;
  brief: string;
  n_clusters?: number;
  segments: Segment[];
  total_clustered: number;
  recommended_segment?: string | null;
  recommendation_reason?: string;
  brief_suggestion?: string | null;
  naming_source?: "skill" | "fallback";
};

export async function runSegment(brief: string, nClusters = 3, opts: { timeoutMs?: number } = {}): Promise<SegmentResult> {
  return callWithFallback<SegmentResult>(
    "/skills/segment",
    { brief, n_clusters: nClusters },
    "step2_segment",
    opts,
  );
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

export async function runDam(brief: string, maxResults = 12, category?: string): Promise<DamResult> {
  return callWithFallback<DamResult>(
    "/skills/dam-search",
    { brief, max_results: maxResults, category: category ?? null },
    "step4_dam_search",
  );
}

// Agentic DAM curation skill
export type CuratedAsset = {
  asset_id: string;
  filename: string;
  tags: string[];
  region_rights: string;
  rationale: string;
};

export type DamCurateResult = {
  ok: boolean;
  result: {
    curated_assets?: CuratedAsset[];
    visual_direction?: string;
    search_summary?: string;
    total_curated?: number;
    _agentic_trace?: Array<Record<string, unknown>>;
    _agentic_iterations?: number;
    _agentic_tool_calls?: number;
  };
};

export async function runDamCurate(
  campaignId: string,
  brief: string,
  category: string,
  segmentName?: string,
  skuCount?: number,
  regions?: string[],
): Promise<DamCurateResult> {
  return request<DamCurateResult>("/skills/dam-curate", {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaignId,
      brief,
      category,
      segment_name: segmentName ?? null,
      sku_count: skuCount ?? 0,
      regions: regions ?? ["NY", "CA", "FL", "TX"],
    }),
  });
}

// MCP tool: find_dam_assets
export type FindDamAssetsResult = {
  ok: boolean;
  mcp_tool: string;
  status: "pass" | "empty";
  assets: Array<{ asset_id: string; filename: string; tag_list: string; region_rights: string }>;
  result_count: number;
  input: { category: string; region: string; max_results: number };
};

export async function runFindDamAssets(
  category: string,
  region: string,
  maxResults = 5,
): Promise<FindDamAssetsResult> {
  return request<FindDamAssetsResult>("/skills/find-dam-assets", {
    method: "POST",
    body: JSON.stringify({ category, region, max_results: maxResults }),
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

// Agentic localization strategy skill
export type LocaleVariantResult = {
  target_language: string;
  original_copy: string;
  translated_copy: string;
  quality_assessment: string;
  cultural_notes: string;
  applied_phrases: number;
  unmatched_words: number;
};

export type LocalizeStrategyResult = {
  ok: boolean;
  result: {
    locale_variants?: LocaleVariantResult[];
    strategy_summary?: string;
    locales_processed?: number;
    total_tool_calls?: number;
    _agentic_trace?: Array<Record<string, unknown>>;
    _agentic_iterations?: number;
    _agentic_tool_calls?: number;
  };
};

export async function runLocalizeStrategy(
  campaignId: string,
  copy: string,
  brief: string,
  category: string,
  channels?: string[],
  regions?: string[],
): Promise<LocalizeStrategyResult> {
  return request<LocalizeStrategyResult>("/skills/localize-strategy", {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaignId,
      copy,
      brief,
      category,
      channels: channels ?? ["email", "web", "mobile"],
      regions: regions ?? ["NY", "CA", "FL", "TX", "PR", "QC"],
    }),
  });
}

export async function runLocalize(brief: string, skuIds: number[]): Promise<LocalizeResult> {
  return callWithFallback<LocalizeResult>(
    "/skills/localize",
    { brief, sku_ids: skuIds },
    "step7_localize",
  );
}

// MCP tool: generate_locale_variants
export type GenerateLocaleResult = {
  ok: boolean;
  mcp_tool: string;
  status: string;
  original_copy: string;
  translated_copy: string;
  target_language: string;
  applied_phrases: number;
  unmatched_words: number;
  input: { copy: string; target_language: string };
};

export async function runGenerateLocaleVariants(
  copy: string,
  targetLanguage: string,
  regionalPricing?: Record<string, unknown>,
): Promise<GenerateLocaleResult> {
  return request<GenerateLocaleResult>("/skills/generate-locale-variants", {
    method: "POST",
    body: JSON.stringify({
      source_copy: copy,
      target_language: targetLanguage,
      regional_pricing: regionalPricing ?? null,
    }),
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
  return callWithFallback<AnalyzeResult>(
    "/skills/analyze",
    { campaign_id: campaignId, forecast_days: forecastDays },
    "step9_analyze",
  );
}

// Activation Scheduler (deterministic automation)
export type RegionSchedule = {
  region: string;
  timezone: string;
  email_send_utc: string;
  paid_social_window_local: string;
  display_frequency_cap: number;
  signage_window_local: string;
};

export type ActivateResult = {
  ok: boolean;
  schedule: {
    schedule_by_region: RegionSchedule[];
    human_confirmation_required: boolean;
    retrieved_docs: string[];
  };
  generation_metadata: {
    skill: string;
    method: string;
    duration_ms: number;
  };
};

export async function runActivate(
  regions: string[],
  estimatedSpend: number,
  launchDate: string,
): Promise<ActivateResult> {
  return callWithFallback<ActivateResult>(
    "/skills/activate",
    { regions, estimated_spend: estimatedSpend, launch_date: launchDate },
    "step8_activate",
  );
}

// Report Generator skill
export type GenerateReportResult = {
  ok: boolean;
  report: {
    executive_summary: string;
    key_metrics: Record<string, unknown>;
    recommendations: string[];
    risks_and_concerns: string[];
    retrieved_docs: string[];
  };
  generation_metadata: {
    skill: string;
    method: string;
    duration_ms: number;
  };
};

export async function runGenerateReport(
  campaignId: string,
  campaignName: string,
  stepOutputs: Record<string, unknown>,
  auditLog: Array<Record<string, unknown>>,
  category?: string,
  segmentName?: string,
): Promise<GenerateReportResult> {
  return callWithFallback<GenerateReportResult>(
    "/skills/generate-report",
    {
      campaign_id: campaignId,
      campaign_name: campaignName,
      step_outputs: stepOutputs,
      audit_log: auditLog,
      category: category ?? "Beauty",
      segment_name: segmentName ?? null,
    },
    "step10_report",
  );
}

