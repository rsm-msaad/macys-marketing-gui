"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { callAIChat, type AIChatResponse } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";

const SUGGESTED_PROMPTS = [
  "Is the copy compliant with brand guidelines?",
  "What did the last beauty campaign teach us about ROI?",
  "Are any of these SKUs MAP enforced?",
  "What disclaimers does this offer need?",
];

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  docs?: string[];
};

export function ChatSidebar({
  context,
  onAction,
}: {
  context: CampaignContext | null;
  onAction: (action: string, data: Record<string, unknown> | null) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi! Ask me anything about this campaign or pick a suggested prompt below to get started.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  function buildCampaignPayload(): Record<string, unknown> {
    if (!context) {
      return {
        campaign_id: "",
        title: "",
        audience_segment: "",
        copy: "",
        skus: [],
        discount_pct: 0,
        regions: [],
      };
    }
    return {
      campaign_id: context.campaign_brief.campaign_id,
      title: context.campaign_brief.name,
      audience_segment: context.campaign_brief.target_customer,
      copy: context.campaign_brief.objective,
      skus: context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5),
      discount_pct: 15,
      regions: ["NY", "CA", "FL", "TX"],
    };
  }

  function chatHistoryForAPI(): Array<{ role: string; content: string }> {
    return messages
      .filter((m) => m.id > 0)
      .map((m) => ({ role: m.role, content: m.text }));
  }

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    const userMsg: Message = { id: messages.length, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    try {
      const reply: AIChatResponse = await callAIChat(
        text,
        buildCampaignPayload(),
        chatHistoryForAPI()
      );
      setMessages((m) => [
        ...m,
        {
          id: m.length,
          role: "assistant",
          text: reply.response,
          docs: reply.retrieved_docs,
        },
      ]);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setMessages((m) => [
        ...m,
        {
          id: m.length,
          role: "assistant",
          text: "Claude is temporarily unavailable. Try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-charcoal/[0.06] bg-white">
      <header className="flex items-center gap-3 border-b border-charcoal/[0.06] px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-subtle">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold text-charcoal">Claude</div>
          <div className="text-[10px] text-stone">
            Marketing coworker powered by TritonAI
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: "#D4A8431A", color: "#B8922E" }}
        >
          AI
        </span>
      </header>

      <div
        ref={scrollRef}
        className="chat-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[85%]">
              <div
                className={`rounded-panel px-4 py-3 text-[13px] leading-relaxed shadow-subtle ${
                  m.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-cream text-charcoal"
                }`}
              >
                <span className={m.role === "assistant" ? "ai-accent" : ""}>
                  {m.text}
                </span>
              </div>
              {m.docs && m.docs.length > 0 && (
                <div className="mt-1.5 px-1 font-mono text-[10px] text-stone/40">
                  Sources: {m.docs.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-panel bg-cream px-4 py-3 text-[13px] text-stone">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
              Claude is thinking...
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t border-charcoal/[0.06] px-4 py-3">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              disabled={busy}
              className="rounded-full border border-charcoal/10 bg-cream px-3 py-1.5 text-[11px] text-charcoal/70 transition-colors hover:border-teal-600 hover:text-teal-600 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-charcoal/[0.06] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Claude..."
          disabled={busy}
          className="flex-1 rounded-card border border-charcoal/10 bg-white px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="flex items-center gap-1 rounded-card bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {error && <p className="px-5 py-2 text-xs text-rose">{error}</p>}
    </aside>
  );
}
