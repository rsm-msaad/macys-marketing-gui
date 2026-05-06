// Typed fetch wrappers for the FastAPI backend.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
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
}

// ----- Personas -----
export type Persona = {
  id: string;
  title: string;
  name: string;
  initial: string;
  color: string;
  tagline: string;
};

export async function fetchPersonas(): Promise<Persona[]> {
  return request<Persona[]>("/personas");
}

// ----- Workflow -----
export type WorkflowStep = {
  number: number;
  name: string;
  owner: string;
  owner_persona_id: string;
  label: "HUMAN_ONLY" | "HUMAN_PLUS_AI" | "FULLY_AUTOMATED";
  status: "pending" | "active" | "complete" | "blocked";
  my_step: boolean;
};

export async function fetchWorkflow(personaId: string): Promise<{ persona_id: string; steps: WorkflowStep[] }> {
  return request(`/workflow/${personaId}`);
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
