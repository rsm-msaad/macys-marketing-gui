// AI API client for the 4 AI features.
//
// Calls the Render backend which runs TritonAI models. The first call after
// the server is idle takes 30 to 60 seconds (lazy model load), so we use a
// 90 second timeout.

const AI_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://macys-api-n6f3.onrender.com";

const AI_TIMEOUT_MS = 90_000;

async function aiRequest<T>(path: string, body: unknown): Promise<T> {
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
    if (!res.ok) {
      let detail = "";
      try {
        const data = await res.json();
        detail = data.detail || JSON.stringify(data);
      } catch {
        detail = await res.text();
      }
      throw new Error(`AI API ${res.status}: ${detail}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(
        "AI request timed out. The server may be cold starting. Please try again in a moment."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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

// ----- API functions -----

export async function callCompliance(
  campaign: Record<string, unknown>
): Promise<ComplianceResult> {
  return aiRequest<ComplianceResult>("/api/ai/compliance", campaign);
}

export async function callBrief(
  campaign: Record<string, unknown>
): Promise<BriefResult> {
  return aiRequest<BriefResult>("/api/ai/brief", campaign);
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
