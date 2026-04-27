import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Radio, Users, Send, CheckCircle, XCircle, Loader2,
  AlertTriangle, MessageSquare, ChevronRight, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
  errors?: { phone: string; error: string }[];
}

interface HistoryEntry {
  message: string;
  filter: string;
  result: BroadcastResult;
  timestamp: Date;
}

const TEMPLATES = [
  {
    label: "Announcement",
    text: "📢 *Announcement from Dawinix AI*\n\nWe have exciting news to share! Stay tuned for updates. 🚀\n\nType /help to see all available commands.",
  },
  {
    label: "Maintenance",
    text: "🔧 *Scheduled Maintenance*\n\nDawinix AI will be briefly unavailable for maintenance. We'll be back shortly.\n\nThank you for your patience! 🙏",
  },
  {
    label: "New Feature",
    text: "🆕 *New Feature Alert!*\n\nWe've just added something amazing to Dawinix AI!\n\nType /help to explore all new commands. 🎉",
  },
  {
    label: "Invite Reminder",
    text: "👋 *Share Dawinix AI!*\n\nEnjoy using the bot? Share it with friends!\n\nAnyone with access gets the same full AI features — chat, code, and image generation. 🤖✨",
  },
];

export default function Broadcast() {
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [userCount, setUserCount] = useState<{ active: number; all: number }>({ active: 0, all: 0 });
  const [charCount, setCharCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Count users
    Promise.all([
      supabase.from("whatsapp_users").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("whatsapp_users").select("*", { count: "exact", head: true }),
    ]).then(([activeRes, allRes]) => {
      setUserCount({ active: activeRes.count ?? 0, all: allRes.count ?? 0 });
    });
  }, []);

  const targetCount = filter === "active" ? userCount.active : userCount.all;

  const handleBroadcast = async () => {
    if (!message.trim()) { toast.error("Message cannot be empty"); return; }
    if (!confirmed) { toast.error("Please confirm the broadcast first"); return; }

    setSending(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke("broadcast-message", {
      body: { message: message.trim(), filter },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = await error.context?.text() || errMsg; } catch { /* noop */ }
      }
      toast.error(`Broadcast failed: ${errMsg}`);
      setSending(false);
      return;
    }

    const res = data as BroadcastResult;
    setResult(res);
    setHistory((prev) => [{ message, filter, result: res, timestamp: new Date() }, ...prev.slice(0, 9)]);
    toast.success(`Broadcast complete! ${res.sent}/${res.total} delivered`);
    setConfirmed(false);
    setSending(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-neon-purple/10 border border-neon-purple/20">
          <Radio className="w-5 h-5 text-neon-purple" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Broadcast Message</h2>
          <p className="text-xs text-muted-foreground">Send one message to all active WhatsApp users at once</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Compose */}
        <div className="lg:col-span-3 space-y-4">
          {/* Target filter */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-neon-purple" />
              Target Audience
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "active", label: "Active Users Only", count: userCount.active, desc: "Users with status = active" },
                { id: "all", label: "All Users", count: userCount.all, desc: "Every registered user" },
              ].map(({ id, label, count, desc }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id as typeof filter)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    filter === id
                      ? "bg-neon-purple/10 border-neon-purple/30"
                      : "bg-secondary border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      filter === id ? "border-neon-purple" : "border-muted-foreground"
                    )}>
                      {filter === id && <div className="w-2 h-2 rounded-full bg-neon-purple" />}
                    </div>
                    <span className={cn("text-xs font-semibold", filter === id ? "text-neon-purple" : "text-foreground")}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-6">{desc}</p>
                  <p className={cn("text-lg font-bold ml-6 mt-1", filter === id ? "text-neon-purple" : "text-foreground")}>
                    {count}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Message composer */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-neon-purple" />
                Message
              </h3>
              <span className={cn("text-[10px] font-mono", charCount > 4000 ? "text-destructive" : "text-muted-foreground")}>
                {charCount}/4096
              </span>
            </div>

            {/* Templates */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Templates</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map(({ label, text }) => (
                  <button
                    key={label}
                    onClick={() => { setMessage(text); setCharCount(text.length); }}
                    className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-neon-purple/30 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setCharCount(e.target.value.length); }}
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-purple/40 transition-colors resize-none leading-relaxed"
              placeholder="Type your broadcast message here...&#10;&#10;Supports WhatsApp formatting:&#10;*bold*, _italic_, ~strikethrough~, `code`"
            />

            {/* Preview */}
            {message && (
              <div className="rounded-xl bg-dark-900 border border-border p-3">
                <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Preview</p>
                <div className="bg-[#005C4B] rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                  <pre className="text-xs text-white whitespace-pre-wrap font-sans break-words leading-relaxed">{message}</pre>
                </div>
              </div>
            )}

            {/* Confirm checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-[#aa88ff]"
              />
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                I confirm I want to send this message to <strong className="text-neon-purple">{targetCount} users</strong> on WhatsApp. This action cannot be undone.
              </span>
            </label>

            {/* Warning */}
            <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/20 p-3 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Broadcast sends with 200ms delay between messages to respect WhatsApp rate limits. Large audiences may take several minutes to complete.
              </p>
            </div>

            <button
              onClick={handleBroadcast}
              disabled={sending || !message.trim() || !confirmed || targetCount === 0}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neon-purple/80 text-white text-sm font-semibold hover:bg-neon-purple disabled:opacity-40 transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              {sending ? `Broadcasting to ${targetCount} users...` : `Broadcast to ${targetCount} Users`}
            </button>
          </div>
        </div>

        {/* Results + History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Result card */}
          {(result || sending) && (
            <div className={cn(
              "rounded-2xl border p-5 space-y-3",
              sending
                ? "bg-secondary/50 border-border"
                : result && result.failed === 0
                ? "bg-primary/5 border-primary/20"
                : "bg-yellow-400/5 border-yellow-400/20"
            )}>
              {sending ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Broadcasting...</p>
                    <p className="text-xs text-muted-foreground">Sending to {targetCount} users with rate limiting</p>
                  </div>
                </div>
              ) : result && (
                <>
                  <div className="flex items-center gap-2">
                    {result.failed === 0
                      ? <CheckCircle className="w-5 h-5 text-primary" />
                      : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                    <p className="text-sm font-semibold text-foreground">Broadcast Complete</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Sent", value: result.sent, color: "text-primary" },
                      { label: "Failed", value: result.failed, color: "text-destructive" },
                      { label: "Total", value: result.total, color: "text-foreground" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-secondary">
                        <p className={cn("text-xl font-bold", color)}>{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Failed Numbers</p>
                      {result.errors.slice(0, 3).map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px]">
                          <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                          <span className="font-mono text-muted-foreground">{e.phone}: {e.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* History */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-dark-800">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                Broadcast History
              </h3>
            </div>
            <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <Radio className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No broadcasts yet</p>
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="p-3 rounded-xl bg-secondary border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Radio className="w-3 h-3 text-neon-purple" />
                        <span className="text-[10px] font-semibold text-foreground">
                          {h.result.sent}/{h.result.total} delivered
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {h.timestamp.toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{h.message}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground capitalize">{h.filter} users</span>
                      {h.result.failed > 0 && (
                        <span className="text-[9px] text-destructive ml-1">{h.result.failed} failed</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
