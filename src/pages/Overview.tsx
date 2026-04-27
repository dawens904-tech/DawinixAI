import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Users, Zap, Image, Terminal, TrendingUp, Circle, RefreshCw } from "lucide-react";
import StatCard from "@/components/features/StatCard";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import heroBanner from "@/assets/hero-banner.jpg";

interface Stats {
  totalMessages: number;
  activeUsersToday: number;
  aiCommandsUsed: number;
  imagesGenerated: number;
  codeRequests: number;
  avgResponseMs: number;
}

interface RecentConv {
  id: string;
  phone: string;
  user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
}

interface LogEntry {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: string;
}

interface DayData {
  date: string;
  messages: number;
  aiCommands: number;
  imageCommands: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  success: "text-primary",
  error: "text-destructive",
  info: "text-neon-blue",
  warning: "text-yellow-400",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  webhook: <Zap className="w-3 h-3" />,
  message: <MessageSquare className="w-3 h-3" />,
  command: <Terminal className="w-3 h-3" />,
  error: <Terminal className="w-3 h-3 text-destructive" />,
  invite: <Users className="w-3 h-3 text-neon-purple" />,
};

function getInitials(name: string | null, phone: string) {
  if (name) return name.charAt(0).toUpperCase();
  return phone.slice(-2);
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    activeUsersToday: 0,
    aiCommandsUsed: 0,
    imagesGenerated: 0,
    codeRequests: 0,
    avgResponseMs: 0,
  });
  const [recentConvs, setRecentConvs] = useState<RecentConv[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Total messages
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    // Messages today
    const { count: msgToday } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);

    // Active users today (unique phones that sent messages today)
    const { data: activeUsersData } = await supabase
      .from("messages")
      .select("phone")
      .eq("role", "user")
      .gte("created_at", `${today}T00:00:00Z`);
    const activeUsers = new Set((activeUsersData ?? []).map((m: { phone: string }) => m.phone)).size;

    // AI commands today
    const { count: aiCmds } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .like("command", "/ai%")
      .gte("created_at", `${today}T00:00:00Z`);

    // Image commands (all time tracked in logs)
    const { count: imgCmds } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("command", "/image");

    // Code requests today
    const { count: codeCmds } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .like("command", "/code%")
      .gte("created_at", `${today}T00:00:00Z`);

    // Avg response time from logs
    const { data: responseLogs } = await supabase
      .from("system_logs")
      .select("message")
      .eq("type", "message")
      .eq("severity", "success")
      .gte("created_at", `${today}T00:00:00Z`)
      .limit(20);

    let avgMs = 0;
    if (responseLogs && responseLogs.length > 0) {
      const times: number[] = [];
      for (const log of responseLogs) {
        const match = (log.message as string).match(/in (\d+)ms/);
        if (match) times.push(parseInt(match[1]));
      }
      if (times.length > 0) avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }

    setStats({
      totalMessages: totalMessages ?? 0,
      activeUsersToday: activeUsers,
      aiCommandsUsed: aiCmds ?? 0,
      imagesGenerated: imgCmds ?? 0,
      codeRequests: codeCmds ?? 0,
      avgResponseMs: avgMs,
    });

    // Recent conversations
    const { data: convData } = await supabase
      .from("conversations")
      .select("id, phone, user_name, last_message, last_message_at, message_count")
      .order("last_message_at", { ascending: false })
      .limit(5);
    setRecentConvs(convData ?? []);

    // Recent logs
    const { data: logData } = await supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);
    setLogs(logData ?? []);

    // Chart: last 7 days
    const days = getLast7Days();
    const dayDataArr: DayData[] = [];
    for (const day of days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      const { count: dayMsgs } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "user")
        .gte("created_at", `${day}T00:00:00Z`)
        .lt("created_at", `${nextDayStr}T00:00:00Z`);

      const { count: dayAi } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "user")
        .like("command", "/ai%")
        .gte("created_at", `${day}T00:00:00Z`)
        .lt("created_at", `${nextDayStr}T00:00:00Z`);

      const { count: dayImg } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "user")
        .eq("command", "/image")
        .gte("created_at", `${day}T00:00:00Z`)
        .lt("created_at", `${nextDayStr}T00:00:00Z`);

      dayDataArr.push({
        date: day.slice(5), // MM-DD
        messages: dayMsgs ?? 0,
        aiCommands: dayAi ?? 0,
        imageCommands: dayImg ?? 0,
      });
    }
    setChartData(dayDataArr);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const STAT_CARDS = [
    {
      label: "Total Messages",
      value: stats.totalMessages.toLocaleString(),
      change: `Today: ${stats.totalMessages}`,
      positive: true,
      icon: <MessageSquare className="w-5 h-5" />,
      accent: true,
    },
    {
      label: "Active Users Today",
      value: stats.activeUsersToday.toString(),
      change: "Unique senders",
      positive: true,
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "AI Commands Today",
      value: stats.aiCommandsUsed.toString(),
      change: "/ai usage",
      positive: true,
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: "Images Generated",
      value: stats.imagesGenerated.toString(),
      change: "/image total",
      positive: true,
      icon: <Image className="w-5 h-5" />,
    },
    {
      label: "Code Requests Today",
      value: stats.codeRequests.toString(),
      change: "/code usage",
      positive: true,
      icon: <Terminal className="w-5 h-5" />,
    },
    {
      label: "Avg Response",
      value: stats.avgResponseMs > 0 ? `${(stats.avgResponseMs / 1000).toFixed(1)}s` : "—",
      change: "AI latency",
      positive: true,
      icon: <TrendingUp className="w-5 h-5" />,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-56">
        <img src={heroBanner} alt="Dawinix AI Dashboard" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900/90 via-dark-900/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6 md:px-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Circle className="w-2.5 h-2.5 fill-primary text-primary pulse-dot" />
              <span className="text-xs text-primary font-mono font-semibold">SYSTEM ONLINE · WEBHOOK ACTIVE</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gradient mb-1">Dawinix AI</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              WhatsApp Chatbot Command Center — AI-powered conversations, code generation & image creation.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate("/conversations")}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Live Conversations
              </button>
              <button
                onClick={() => navigate("/setup")}
                className="px-4 py-2 rounded-xl bg-white/10 text-foreground text-xs font-semibold hover:bg-white/20 transition-colors border border-white/10"
              >
                Setup Guide
              </button>
            </div>
          </div>
        </div>
        {/* Auto-refresh badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-mono text-primary bg-dark-900/80 px-2 py-1 rounded-full border border-primary/20">
          <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "10s" }} />
          Live · {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAT_CARDS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Message Volume</h3>
              <p className="text-xs text-muted-foreground">Last 7 days — real database data</p>
            </div>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {stats.totalMessages} total
            </span>
          </div>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }}
                  cursor={{ fill: "rgba(0,255,136,0.05)" }}
                />
                <Bar dataKey="messages" fill="#00ff88" opacity={0.8} radius={[4, 4, 0, 0]} name="Messages" />
                <Bar dataKey="aiCommands" fill="#00ccff" opacity={0.7} radius={[4, 4, 0, 0]} name="/ai" />
                <Bar dataKey="imageCommands" fill="#aa88ff" opacity={0.7} radius={[4, 4, 0, 0]} name="/image" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-3">
            {[{ color: "#00ff88", label: "Messages" }, { color: "#00ccff", label: "/ai" }, { color: "#aa88ff", label: "/image" }].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Chats</h3>
            <button onClick={() => navigate("/conversations")} className="text-[11px] text-primary hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-secondary/50 animate-pulse" />
              ))
            ) : recentConvs.length === 0 ? (
              <div className="text-center py-6">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              recentConvs.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate("/conversations")}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {getInitials(conv.user_name, conv.phone)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {conv.user_name ?? conv.phone}
                      </p>
                      <p className="text-[10px] text-muted-foreground ml-1 shrink-0">
                        {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : "—"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{conv.last_message ?? "No messages"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Activity Log */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">System Activity Log</h3>
            <p className="text-xs text-muted-foreground">Real webhook & bot events — auto-refresh every 10s</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono">
            <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
            Live
          </div>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-secondary/50 animate-pulse" />
            ))
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No activity yet — send a WhatsApp message to start</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-secondary/30 transition-colors">
                <span className={`shrink-0 mt-0.5 ${SEVERITY_COLOR[log.severity] ?? "text-muted-foreground"}`}>
                  {TYPE_ICON[log.type] ?? <Circle className="w-3 h-3" />}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false })}
                </span>
                <span className={`text-[11px] flex-1 ${SEVERITY_COLOR[log.severity] ?? "text-foreground"}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
