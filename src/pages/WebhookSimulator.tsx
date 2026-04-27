import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Send, Zap, CheckCircle, XCircle, Clock, Bot, ChevronRight, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface PipelineStep {
  step: string;
  status: string;
  detail: string;
  duration: number;
}

interface SimResult {
  reply: string;
  pipeline: PipelineStep[];
  totalDuration: number;
  aiModel: string;
}

interface Message {
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

const QUICK_MESSAGES = [
  { label: "/start", text: "/start" },
  { label: "/help", text: "/help" },
  { label: "/ai quantum computing", text: "/ai What is quantum computing in simple terms?" },
  { label: "/code Python sort", text: "/code Write a Python function to sort a list of objects by a key" },
  { label: "/image neon city", text: "/image A futuristic neon city at night with flying cars" },
  { label: "Plain text", text: "What can you do for me?" },
  { label: "French", text: "Explique-moi l'intelligence artificielle" },
  { label: "Kreyòl", text: "Bonjou! Ki jan ou rele?" },
];

export default function WebhookSimulator() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, result]);

  const runSimulation = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text) return;

    setInput("");
    setLoading(true);
    setResult(null);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date() }]);

    const { data, error } = await supabase.functions.invoke("send-test-message", {
      body: { message: text, phone: "simulator_user" },
    });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const textContent = await error.context?.text();
          errorMessage = textContent || error.message;
        } catch {
          errorMessage = error.message;
        }
      }
      toast.error(`Simulation failed: ${errorMessage}`);
      setMessages((prev) => [...prev, {
        role: "bot",
        content: `❌ Simulation error: ${errorMessage}`,
        timestamp: new Date(),
      }]);
      setLoading(false);
      return;
    }

    const simResult = data as SimResult;
    setResult(simResult);
    setMessages((prev) => [...prev, { role: "bot", content: simResult.reply, timestamp: new Date() }]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runSimulation();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-neon-blue/10 border border-neon-blue/20">
          <Zap className="w-5 h-5 text-neon-blue" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Webhook Simulator</h2>
          <p className="text-xs text-muted-foreground">Test the full bot pipeline: webhook → AI → response. All steps logged in real-time.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chat panel */}
        <div className="lg:col-span-3 flex flex-col rounded-2xl bg-card border border-border overflow-hidden" style={{ minHeight: 540 }}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-dark-800">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Dawinix AI</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                <span className="text-[10px] text-muted-foreground">Simulator Active</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-neon-blue bg-neon-blue/10 px-2 py-1 rounded-full border border-neon-blue/20">
              <Zap className="w-3 h-3" />Real AI
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-dark-900/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                <MessageSquare className="w-10 h-10 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type a message to simulate WhatsApp</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Use commands like /ai, /code, /help or plain text</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "bot" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    )}
                  >
                    {msg.content}
                    <p className={cn("text-[9px] mt-1 opacity-60", msg.role === "user" ? "text-right" : "")}>
                      {msg.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground font-mono">Processing through pipeline...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick messages */}
          <div className="px-3 py-2 border-t border-border bg-dark-800 flex gap-1.5 overflow-x-auto scrollbar-thin">
            {QUICK_MESSAGES.map(({ label, text }) => (
              <button
                key={label}
                onClick={() => runSimulation(text)}
                disabled={loading}
                className="shrink-0 px-2.5 py-1 rounded-full bg-secondary border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border bg-dark-800 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or /command..."
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => runSimulation()}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>

        {/* Pipeline panel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-dark-800">
              <h3 className="text-sm font-semibold text-foreground">Pipeline Trace</h3>
              <p className="text-[10px] text-muted-foreground">Full request lifecycle breakdown</p>
            </div>

            <div className="p-4 space-y-2">
              {!result && !loading && (
                <div className="text-center py-8">
                  <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Send a message to see the pipeline</p>
                </div>
              )}

              {loading && (
                <div className="space-y-2">
                  {["Webhook Receipt", "Message Parsing", "Command Router", "AI Processing", "Response Dispatch"].map((step, i) => (
                    <div key={step} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                      <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
                      <span className="text-xs text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {result && (
                <div className="space-y-2 slide-in">
                  {result.pipeline.map((step, i) => (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border",
                      step.status === "success" ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"
                    )}>
                      <div className="shrink-0 mt-0.5">
                        {step.status === "success"
                          ? <CheckCircle className="w-4 h-4 text-primary" />
                          : <XCircle className="w-4 h-4 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{step.step}</p>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{step.duration}ms</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-primary">Total Pipeline</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-primary">{result.totalDuration}ms</span>
                    </div>
                    {result.aiModel && result.aiModel !== "none" && (
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">Model: {result.aiModel}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-2xl bg-neon-blue/5 border border-neon-blue/20 p-4">
            <p className="text-xs font-semibold text-neon-blue mb-2">How it works</p>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 text-neon-blue shrink-0 mt-0.5" />Messages are processed through the real Edge Function pipeline</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 text-neon-blue shrink-0 mt-0.5" />AI responses use OnSpace AI (Gemini 3 Flash)</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 text-neon-blue shrink-0 mt-0.5" />All events are logged to the System Logs page</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 text-neon-blue shrink-0 mt-0.5" />Custom commands from Command Builder are matched here</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
