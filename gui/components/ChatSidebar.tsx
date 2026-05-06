"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

import { postChat, type ChatReply } from "@/lib/api";
import { SUGGESTED_PROMPTS } from "@/lib/scripted-chat";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

export function ChatSidebar({
  personaId,
  onAction,
}: {
  personaId: string;
  onAction: (action: string, data: Record<string, unknown> | null) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text:
        "Hi. Ask me anything about this campaign or pick a suggested prompt below to get started.",
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
  }, [messages]);

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { id: m.length, role: "user", text }]);
    setInput("");
    try {
      const reply: ChatReply = await postChat(personaId, text);
      setMessages((m) => [
        ...m,
        { id: m.length, role: "assistant", text: reply.response },
      ]);
      if (reply.action) {
        onAction(reply.action, reply.data ?? null);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setMessages((m) => [
        ...m,
        { id: m.length, role: "assistant", text: `(error: ${msg})` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = SUGGESTED_PROMPTS[personaId] ?? [];

  return (
    <aside className="flex h-full w-full flex-col border-l border-charcoal/10 bg-white">
      <header className="flex items-center gap-2 border-b border-charcoal/10 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-charcoal">Claude</div>
          <div className="text-[10px] text-charcoal/55">Marketing co-worker (scripted)</div>
        </div>
      </header>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug shadow-sm ${
                m.role === "user"
                  ? "bg-teal-600 text-white"
                  : "bg-cream text-charcoal"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-cream px-3 py-2 text-sm text-charcoal/60">
              thinking…
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-charcoal/10 px-3 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
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
          placeholder="Ask Claude…"
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
