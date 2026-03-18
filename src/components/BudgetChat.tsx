import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface EstimateSummary {
  totalItems: number;
  totalHours: number;
  totalMaterial: number;
  codedCount: number;
  uncoded: number;
  systemBreakdown: Record<string, { hours: number; material: number; items: number; laborCode?: string }>;
  categoryBreakdown: Record<string, { hours: number; items: number }>;
}

interface BudgetChatProps {
  projectName: string;
  estimateSummary: EstimateSummary | null;
}

function buildProjectContext(summary: EstimateSummary | null, projectName: string): string {
  if (!summary) return "No estimate data loaded yet.";

  const codePct = summary.totalItems > 0
    ? Math.round((summary.codedCount / summary.totalItems) * 100)
    : 0;

  const systemLines = Object.entries(summary.systemBreakdown)
    .sort((a, b) => b[1].hours - a[1].hours)
    .map(([sys, d]) =>
      `  - ${sys}: ${d.items} items, ${d.hours.toFixed(1)} hrs, $${d.material.toLocaleString()}${d.laborCode ? ` → ${d.laborCode}` : " → UNMAPPED"}`
    )
    .join("\n");

  const categoryLines = Object.entries(summary.categoryBreakdown)
    .sort((a, b) => b[1].hours - a[1].hours)
    .map(([cat, d]) => `  - ${cat}: ${d.items} items, ${d.hours.toFixed(1)} hrs`)
    .join("\n");

  return `Project: ${projectName}
Total Items: ${summary.totalItems.toLocaleString()}
Total Field Hours: ${summary.totalHours.toFixed(1)}
Total Material Cost: $${summary.totalMaterial.toLocaleString()}
Cost Code Coverage: ${codePct}% (${summary.codedCount} coded, ${summary.uncoded} uncoded)

Systems (by hours):
${systemLines}

Categories (by hours):
${categoryLines}`;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/budget-chat`;

async function streamChat({
  messages,
  projectContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  projectContext: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, projectContext }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(body.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone();
}

const SUGGESTIONS = [
  "What are the top 3 systems by hours?",
  "Which systems are unmapped?",
  "What's the total material cost?",
  "Summarize the budget",
];

export function BudgetChat({ projectName, estimateSummary }: BudgetChatProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm your budget assistant for **${projectName}**. Ask me anything about the estimate — hours by system, cost code coverage, material costs, or anything else.`,
      }]);
    }
  }, [open, projectName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";

    const conversationHistory = allMessages.filter(
      (m, i) => !(m.role === "assistant" && i === 0)
    );

    try {
      await streamChat({
        messages: conversationHistory,
        projectContext: buildProjectContext(estimateSummary, projectName),
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          const current = assistantSoFar;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
            }
            return [...prev, { role: "assistant", content: current }];
          });
        },
        onDone: () => setLoading(false),
        onError: (err) => {
          setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err}` }]);
          setLoading(false);
        },
      });
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Something went wrong. Please try again." }]);
      setLoading(false);
    }
  }, [input, loading, messages, estimateSummary, projectName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all ${open ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <MessageCircle className="h-5 w-5" />
        Ask AI
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[400px] max-h-[600px] flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in">

          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3">
            <div className="flex items-center gap-2 text-primary-foreground">
              <Bot className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">Budget AI</div>
                <div className="text-xs opacity-80 truncate max-w-[240px]">{projectName}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
            <div className="p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs rounded-full border border-border bg-muted/50 px-2.5 py-1 text-foreground hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about hours, costs, cost codes…"
              disabled={loading}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <Button size="icon" onClick={() => sendMessage()} disabled={loading || !input.trim()} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
