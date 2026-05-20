"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
      AI
    </span>
  );
}

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
    <aside className="flex h-full w-full flex-col border-l border-charcoal/10 bg-white">
      <header className="flex items-center gap-2 border-b border-charcoal/10 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold text-charcoal">Claude</div>
          <div className="text-[10px] text-charcoal/55">
            Marketing coworker powered by TritonAI
          </div>
        </div>
        <AIBadge />
      </header>

      <div
        ref={scrollRef}
        className="chat-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[85%]">
              <div
                className={`rounded-lg px-3 py-2 text-sm leading-snug shadow-sm ${
                  m.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-cream text-charcoal"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-charcoal prose-headings:font-serif prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-table:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.text
                )}
              </div>
              {m.docs && m.docs.length > 0 && (
                <div className="mt-1 px-1 text-[10px] font-mono text-charcoal/40">
                  Sources: {m.docs.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-cream px-3 py-2 text-sm text-charcoal/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
              Claude is thinking...
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-charcoal/10 px-3 py-2">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              disabled={busy}
              className="rounded-full border border-charcoal/15 bg-cream px-2.5 py-1 text-[11px] text-charcoal/80 hover:border-teal-600 hover:text-teal-600 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-charcoal/10 p-3"
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
          className="flex-1 rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {error && <p className="px-4 py-2 text-xs text-soft_red">{error}</p>}
    </aside>
  );
}
