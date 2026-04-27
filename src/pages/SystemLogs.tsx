import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Terminal, RefreshCw, Circle, Download, Trash2, Filter, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  info:    { color: "text-neon-blue",   bg: "bg-neon-blue/10",   dot: "bg-neon-blue",   label: "INFO" },
  success: { color: "text-primary",     bg: "bg-primary/10",     dot: "bg-primary",     label: "OK" },
  warning: { color: "text-yellow-400",  bg: "bg-yellow-400/10",  dot: "bg-yellow-400",  label: "WARN" },
  error:   { color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive",  label: "ERR" },
};

const TYPE_ICONS: Record<string, string> = {
  webhook: "⟵ ",
  message: "✉ ",
  command: "⌘ ",
  error:   "✗ ",
  ai:      "◈ ",
  config:  "⚙ ",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const fetchLogs = useCallback(async (showToast = false) => {
    const params = new URLSearchParams({ limit: "80" });
    if (filterSeverity !== "all") params.set("severity", filterSeverity);
    if (filterType !== "all") params.set("type", filterType);

    const { data, error } = await supabase.functions.invoke("get-system-logs", {
      body: null,
    });

    // Fall back to direct query since GET params don't work well with invoke
    const { data: logsData, error: logsError } = await (async () => {
      let q = supabase.from("system_logs").select("*").order("created_at", { ascending: false }).limit(80);
      if (filterSeverity !== "all") q = q.eq("severity", filterSeverity);
      if (filterType !== "all") q = q.eq("type", filterType);
      return q;
    })();

    if (!logsError && logsData) {
      setLogs(logsData as LogEntry[]);
    }
    setLastRefresh(new Date());
    setLoading(false);
    if (showToast) toast.success("Logs refreshed");
  }, [filterSeverity, filterType]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
      setCountdown(5);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Countdown timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 5 : c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleClearLogs = () => {
    toast.info("Log clearing available via database dashboard");
  };

  const handleExport = () => {
    const txt = logs.map((l) =>
      `[${l.created_at}] [${l.severity.toUpperCase()}] [${l.type}] ${l.message}`
    ).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dawinix-logs-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported");
  };

  const counts = {
    total: logs.length,
    error: logs.filter((l) => l.severity === "error").length,
    warning: logs.filter((l) => l.severity === "warning").length,
    success: logs.filter((l) => l.severity === "success").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">System Logs</h2>
            <p className="text-xs text-muted-foreground">Real-time webhook events, AI responses & error traces</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              autoRefresh
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Circle className={cn("w-2 h-2", autoRefresh ? "fill-primary text-primary pulse-dot" : "fill-muted-foreground text-muted-foreground")} />
            {autoRefresh ? `Auto ${countdown}s` : "Paused"}
          </button>

          <button
            onClick={() => fetchLogs(true)}
            className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>

          <button onClick={handleExport} className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Logs", value: counts.total, color: "text-foreground" },
          { label: "Errors", value: counts.error, color: "text-destructive" },
          { label: "Warnings", value: counts.warning, color: "text-yellow-400" },
          { label: "Success", value: counts.success, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-3 text-center">
            <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {["all", "info", "success", "warning", "error"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all capitalize",
                filterSeverity === sev
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {sev}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex gap-1.5 flex-wrap">
          {["all", "webhook", "message", "command", "error", "ai", "config"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                filterType === t
                  ? "bg-neon-blue/10 border-neon-blue/30 text-neon-blue"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal log panel */}
      <div className="rounded-2xl bg-dark-900 border border-border overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-dark-800 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
              <div className="w-3 h-3 rounded-full bg-primary/60" />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground ml-2">
              dawinix@system ~ logs
            </span>
          </div>
          <div className="flex items-center gap-3">
            {autoRefresh && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary">
                <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                LIVE
              </div>
            )}
            <span className="text-[10px] font-mono text-muted-foreground">
              Last: {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        </div>

        {/* Log entries */}
        <div className="h-[500px] overflow-y-auto scrollbar-thin p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Terminal className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-mono">No logs yet — send a test message via the Simulator</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {logs.map((log) => {
                const cfg = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.info;
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} className={cn("group transition-colors", isExpanded ? "bg-secondary/20" : "hover:bg-secondary/10")}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-left"
                    >
                      {/* Timestamp */}
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 w-[72px]">
                        {formatTime(log.created_at)}
                      </span>

                      {/* Severity badge */}
                      <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>

                      {/* Type badge */}
                      <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0 mt-0.5 capitalize">
                        {TYPE_ICONS[log.type] ?? ""}{log.type}
                      </span>

                      {/* Message */}
                      <span className={cn("text-[11px] font-mono flex-1 text-left leading-relaxed", cfg.color)}>
                        {log.message}
                      </span>

                      {/* Expand if metadata */}
                      {log.metadata && (
                        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 mt-0.5 transition-transform", isExpanded && "rotate-180")} />
                      )}
                    </button>

                    {/* Expanded metadata */}
                    {isExpanded && log.metadata && (
                      <div className="px-4 pb-3 ml-[120px]">
                        <pre className="text-[10px] font-mono text-muted-foreground bg-dark-800 rounded-lg p-3 overflow-x-auto scrollbar-thin border border-border/50">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-dark-800 flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">
            {logs.length} entries · {filterSeverity !== "all" ? filterSeverity : "all severities"} · {filterType !== "all" ? filterType : "all types"}
          </span>
          <span className="text-[10px] font-mono text-primary">
            {autoRefresh ? `↻ auto-refresh ${countdown}s` : "⏸ paused"}
          </span>
        </div>
      </div>
    </div>
  );
}
