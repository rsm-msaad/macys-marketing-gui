// AI API client for the 4 AI features.
//
// Calls the Render backend which runs TritonAI models. The first call after
// the server is idle takes 30 to 60 seconds (lazy model load), so we use a
// 90 second timeout.

const AI_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://macys-api-n6f3.onrender.com";

const AI_TIMEOUT_MS = 180_000;

async function aiRequest<T>(path: string, body: unknown): Promise<T> {
  // Retry up to twice on timeout or 503 (common during Render cold starts).
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(`${AI_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 503 && attempt < 2) {
        clearTimeout(timeoutId);
        // Server may be cold starting; wait and retry.
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      if (!res.ok) {
        let detail = "";
        try {
          const data = await res.json();
          // Backend returns detail as {error, detail} object or a string.
          if (typeof data.detail === "object" && data.detail !== null) {
            detail = data.detail.detail || data.detail.error || JSON.stringify(data.detail);
          } else {
            detail = data.detail || JSON.stringify(data);
          }
        } catch {
          detail = await res.text();
        }
        throw new Error(`AI API ${res.status}: ${detail}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (attempt < 2) {
          // Timeout; retry.
          continue;
        }
        throw new Error(
          "AI request timed out. The server may be cold starting. Please try again in a moment."
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("AI request failed after retries.");
}

// ----- Types -----

export type ComplianceCheckItem = {
  status: string;
  reason: string;
  cited_doc: string;
};

export type ComplianceResult = {
  brand_alignment: ComplianceCheckItem;
  disclaimers: ComplianceCheckItem;
  pricing_cross_check: ComplianceCheckItem;
  recommended_action: string;
  retrieved_docs: string[];
};

export type BriefResult = {
  campaign_goal: string;
  target_audience: string;
  expected_roi: string;
  risk_flags: string[];
  ai_recommendation: string;
  retrieved_docs: string[];
};

export type RouteRevisionResult = {
  change_type: string;
  owner: string;
  one_line_summary: string;
  urgency: string;
};

export type CascadeResult = {
  localized_variants: Array<{
    region: string;
    [key: string]: unknown;
  }>;
  activation_schedule: string;
};

// ----- Cached fallback for AI calls -----

let _aiCachedOutputs: Record<string, unknown> | null = null;

async function getAICachedOutputs(): Promise<Record<string, unknown>> {
  if (_aiCachedOutputs) return _aiCachedOutputs;
  try {
    const res = await fetch("/cached-outputs.json");
    if (res.ok) _aiCachedOutputs = await res.json();
  } catch {
    // Silent
  }
  return _aiCachedOutputs ?? {};
}

async function aiCallWithFallback<T>(
  path: string,
  body: unknown,
  cachedKey: string,
): Promise<T> {
  try {
    return await aiRequest<T>(path, body);
  } catch {
    const cached = await getAICachedOutputs();
    const fallback = cached[cachedKey];
    if (fallback) {
      console.debug(`[aiCallWithFallback] ${cachedKey}: using cached fallback`);
      return fallback as T;
    }
    throw new Error(`AI call failed and no cached fallback for ${cachedKey}`);
  }
}

// ----- API functions -----

export async function callCompliance(
  campaign: Record<string, unknown>
): Promise<ComplianceResult> {
  return aiCallWithFallback<ComplianceResult>("/api/ai/compliance", campaign, "step6a_compliance");
}

export async function callBrief(
  campaign: Record<string, unknown>
): Promise<BriefResult> {
  return aiCallWithFallback<BriefResult>("/api/ai/brief", campaign, "step6b_brief");
}

export async function callRouteRevision(
  revisionInput: Record<string, unknown>
): Promise<RouteRevisionResult> {
  return aiRequest<RouteRevisionResult>("/api/ai/route-revision", revisionInput);
}

export async function callCascade(
  approvalInput: Record<string, unknown>
): Promise<CascadeResult> {
  return aiRequest<CascadeResult>("/api/ai/cascade", approvalInput);
}

export function warmupAI(): void {
  fetch(`${AI_BASE}/api/ai/warmup`).catch(() => {});
}

export type ActivityEvent = {
  timestamp: string;
  skill_name: string;
  summary: string;
  retrieved_docs: string[];
  campaign_id: string | null;
};

export async function fetchActivity(
  campaignId?: string,
  limit: number = 10,
): Promise<{ events: ActivityEvent[]; count: number }> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (campaignId) params.set("campaign_id", campaignId);
  const res = await fetch(`${AI_BASE}/api/ai/activity?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
  return res.json();
}

export type AIChatResponse = {
  response: string;
  retrieved_docs: string[];
};

export async function callAIChat(
  message: string,
  campaignContext: Record<string, unknown>,
  chatHistory: Array<{ role: string; content: string }>
): Promise<AIChatResponse> {
  return aiRequest<AIChatResponse>("/api/ai/chat", {
    message,
    campaign_context: campaignContext,
    chat_history: chatHistory,
  });
}
