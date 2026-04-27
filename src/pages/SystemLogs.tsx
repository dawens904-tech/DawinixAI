import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Terminal, RefreshCw, Circle, Trash2, Filter,
  Zap, MessageSquare, Code, Image, Radio, Users, AlertTriangle, Info
} from "lucide-react";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, { text: string; dot: string; bg: string }> = {
  success: { text: "text-primary", dot: "bg-primary", bg: "bg-primary/5" },
  error:   { text: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/5" },
  warning: { text: "text-yellow-400", dot: "bg-yellow-400", bg: "bg-yellow-400/5" },
  info:    { text: "text-neon-blue", dot: "bg-neon-blue", bg: "bg-neon-blue/5" },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  webhook:   <Zap className="w-3 h-3" />,
  message:   <MessageSquare className="w-3 h-3" />,
  command:   <Code className="w-3 h-3" />,
  error:     <AlertTriangle className="w-3 h-3" />,
  broadcast: <Radio className="w-3 h-3" />,
  invite:    <Users className="w-3 h-3" />,
  image:     <Image className="w-3 h-3" />,
  config:    <Info className="w-3 h-3" />,
};

const TYPE_FILTERS = ["all", "webhook", "message", "command", "error", "broadcast", "invite", "image", "config"] as const;
const SEV_FILTERS = ["all", "success", "info", "warning", "error"] as const;

type TypeFilter = typeof TYPE_FILTERS[number];
type SevFilter = typeof SEV_FILTERS[number];

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    let query = supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (sevFilter !== "all") query = query.eq("severity", sevFilter);

    const { data, error } = await query;
    if (!error && data) {
      setLogs(data as LogEntry[]);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [typeFilter, sevFilter]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = async () => {
    const { error } = await supabase.from("system_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (!error) {
      setLogs([]);
      toast.success("All logs cleared");
    } else {
      toast.error("Failed to clear logs");
    }
  };

  const counts = {
    total: logs.length,
    errors: logs.filter((l) => l.severity === "error").length,
    warnings: logs.filter((l) => l.severity === "warning").length,
    success: logs.filter((l) => l.severity === "success").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">System Logs</h2>
            <p className="text-xs text-muted-foreground">Live webhook & AI events — auto-refresh every 5s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary bg-primary/10 px-2.5 py-1.5 rounded-full border border-primary/20">
            <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
            {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Logs", value: counts.total, color: "text-foreground", bg: "bg-card" },
          { label: "Success", value: counts.success, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
          { label: "Warnings", value: counts.warnings, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/20" },
          { label: "Errors", value: counts.errors, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-3 flex items-center gap-3", bg, !bg.includes("border-") && "border-border")}>
            <p className={cn("text-xl font-bold", color)}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Type filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-all border",
                typeFilter === t
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:border-primary/20"
              )}
            >
              {TYPE_ICONS[t] ?? null}
              {t}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto flex items-center gap-1.5 flex-wrap">
          {SEV_FILTERS.map((s) => {
            const style = SEVERITY_STYLES[s];
            return (
              <button
                key={s}
                onClick={() => setSevFilter(s)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-all border",
                  sevFilter === s
                    ? cn("border", style?.bg ?? "bg-card", style?.text ?? "text-foreground", "border-current/30")
                    : "bg-card text-muted-foreground border-border hover:border-primary/20"
                )}
              >
                {style && <div className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />}
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-scroll toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-[11px] text-muted-foreground">Auto-scroll to latest</span>
        </label>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Terminal Log Panel */}
      <div className="flex-1 rounded-2xl bg-dark-900 border border-border overflow-hidden flex flex-col min-h-[400px]">
        {/* Terminal header bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-dark-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-primary/60" />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground ml-2">dawinix-ai — system-logs</span>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-primary">
            <span className="animate-pulse">●</span>
            LIVE
          </div>
        </div>

        {/* Log entries */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px] scrollbar-thin"
        >
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Terminal className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-muted-foreground text-xs">No logs found — send a WhatsApp message to generate events</p>
            </div>
          ) : (
            logs.map((log) => {
              const style = SEVERITY_STYLES[log.severity] ?? SEVERITY_STYLES.info;
              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group",
                    style.bg
                  )}
                >
                  {/* Dot */}
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", style.dot)} />

                  {/* Timestamp */}
                  <span className="text-muted-foreground shrink-0 w-[72px]">
                    {new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false })}
                  </span>

                  {/* Type badge */}
                  <span className={cn(
                    "shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider",
                    style.text, style.bg
                  )}>
                    {TYPE_ICONS[log.type] ?? <Circle className="w-3 h-3" />}
                    {log.type}
                  </span>

                  {/* Severity */}
                  <span className={cn("shrink-0 text-[9px] uppercase font-bold w-[44px]", style.text)}>
                    [{log.severity}]
                  </span>

                  {/* Message */}
                  <span className={cn("flex-1 break-all leading-relaxed", style.text)}>
                    {log.message}
                  </span>

                  {/* Metadata toggle */}
                  {log.metadata && (
                    <details className="ml-1 shrink-0">
                      <summary className="text-[9px] text-muted-foreground cursor-pointer hover:text-foreground list-none group-hover:opacity-100 opacity-0 transition-opacity">
                        [meta]
                      </summary>
                      <pre className="text-[9px] text-muted-foreground mt-1 bg-black/30 rounded p-2 max-w-xs overflow-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
