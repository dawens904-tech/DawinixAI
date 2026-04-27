import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area
} from "recharts";
import { TrendingUp, MessageSquare, Code, Image, Zap, RefreshCw, Users, Clock } from "lucide-react";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#080d18",
    border: "1px solid rgba(0,255,136,0.2)",
    borderRadius: 8,
    fontSize: 11,
  },
  cursor: { fill: "rgba(0,255,136,0.05)" },
};

function getLast30Days() {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getLast24Hours() {
  const hours: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date();
    d.setHours(d.getHours() - i, 0, 0, 0);
    hours.push(d.toISOString());
  }
  return hours;
}

interface DayData {
  date: string;
  messages: number;
  aiCmds: number;
  codeCmds: number;
  imageCmds: number;
  users: number;
}

interface HourData {
  hour: string;
  messages: number;
}

interface CommandStat {
  name: string;
  value: number;
  color: string;
}

interface LangStat {
  name: string;
  value: number;
  color: string;
}

interface KPI {
  total: number;
  aiCmds: number;
  codeCmds: number;
  imageCmds: number;
  avgResponseMs: number;
  totalUsers: number;
}

export default function Analytics() {
  const [kpi, setKpi] = useState<KPI>({ total: 0, aiCmds: 0, codeCmds: 0, imageCmds: 0, avgResponseMs: 0, totalUsers: 0 });
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourData[]>([]);
  const [commandStats, setCommandStats] = useState<CommandStat[]>([]);
  const [langStats, setLangStats] = useState<LangStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    // ── KPIs ────────────────────────────────────────────────────────────
    const [
      { count: total },
      { count: aiCmds },
      { count: codeCmds },
      { count: imageCmds },
      { count: totalUsers },
    ] = await Promise.all([
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").like("command", "/ai%"),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").like("command", "/code%"),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").eq("command", "/image"),
      supabase.from("whatsapp_users").select("*", { count: "exact", head: true }),
    ]);

    // Avg response time from logs
    const { data: responseLogs } = await supabase
      .from("system_logs")
      .select("message")
      .eq("type", "message")
      .eq("severity", "success")
      .limit(50);

    let avgMs = 0;
    if (responseLogs && responseLogs.length > 0) {
      const times: number[] = [];
      for (const log of responseLogs) {
        const match = (log.message as string).match(/in (\d+)ms/);
        if (match) times.push(parseInt(match[1]));
      }
      if (times.length > 0) avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }

    setKpi({
      total: total ?? 0,
      aiCmds: aiCmds ?? 0,
      codeCmds: codeCmds ?? 0,
      imageCmds: imageCmds ?? 0,
      avgResponseMs: avgMs,
      totalUsers: totalUsers ?? 0,
    });

    // ── Daily data (last 30 days) ────────────────────────────────────────
    const days = getLast30Days();
    const dailyArr: DayData[] = [];
    for (const day of days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      const [
        { count: dayMsgs },
        { count: dayAi },
        { count: dayCode },
        { count: dayImg },
        { data: dayUsers },
      ] = await Promise.all([
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user")
          .gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${nextDayStr}T00:00:00Z`),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").like("command", "/ai%")
          .gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${nextDayStr}T00:00:00Z`),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").like("command", "/code%")
          .gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${nextDayStr}T00:00:00Z`),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("role", "user").eq("command", "/image")
          .gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${nextDayStr}T00:00:00Z`),
        supabase.from("messages").select("phone").eq("role", "user")
          .gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${nextDayStr}T00:00:00Z`),
      ]);

      const uniqueUsers = new Set((dayUsers ?? []).map((m: { phone: string }) => m.phone)).size;
      dailyArr.push({
        date: day.slice(5),
        messages: dayMsgs ?? 0,
        aiCmds: dayAi ?? 0,
        codeCmds: dayCode ?? 0,
        imageCmds: dayImg ?? 0,
        users: uniqueUsers,
      });
    }
    setDailyData(dailyArr);

    // ── Hourly data (last 24h) ───────────────────────────────────────────
    const hours = getLast24Hours();
    const hourlyArr: HourData[] = [];
    for (let i = 0; i < hours.length; i++) {
      const start = hours[i];
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      const { count: hMsgs } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "user")
        .gte("created_at", start)
        .lt("created_at", end.toISOString());
      hourlyArr.push({
        hour: new Date(start).getHours().toString().padStart(2, "0") + "h",
        messages: hMsgs ?? 0,
      });
    }
    setHourlyData(hourlyArr);

    // ── Command distribution ─────────────────────────────────────────────
    const cmdData: CommandStat[] = [
      { name: "/ai", value: aiCmds ?? 0, color: "#00ccff" },
      { name: "/code", value: codeCmds ?? 0, color: "#00ff88" },
      { name: "/image", value: imageCmds ?? 0, color: "#aa88ff" },
    ];
    // Plain text = total - all commands
    const plainText = Math.max(0, (total ?? 0) - (aiCmds ?? 0) - (codeCmds ?? 0) - (imageCmds ?? 0));
    if (plainText > 0) cmdData.push({ name: "text", value: plainText, color: "#6b7280" });
    setCommandStats(cmdData);

    // ── Language distribution ────────────────────────────────────────────
    const { data: langData } = await supabase
      .from("whatsapp_users")
      .select("language");
    const langMap: Record<string, number> = {};
    for (const u of langData ?? []) {
      const lang = (u.language as string) || "en";
      langMap[lang] = (langMap[lang] ?? 0) + 1;
    }
    const LANG_COLORS: Record<string, string> = { en: "#00ff88", fr: "#aa88ff", ht: "#00ccff" };
    const LANG_NAMES: Record<string, string> = { en: "English", fr: "French", ht: "Haitian Creole" };
    const totalLangUsers = Object.values(langMap).reduce((a, b) => a + b, 0) || 1;
    setLangStats(
      Object.entries(langMap).map(([lang, count]) => ({
        name: LANG_NAMES[lang] ?? lang.toUpperCase(),
        value: Math.round((count / totalLangUsers) * 100),
        color: LANG_COLORS[lang] ?? "#6b7280",
      }))
    );

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totalCmds = commandStats.reduce((a, b) => a + b.value, 0) || 1;

  // Show only last 14 days on daily chart for readability
  const chartDays = dailyData.slice(-14);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Analytics</h2>
          <p className="text-xs text-muted-foreground">Real database metrics — auto-refresh every 30s</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary bg-primary/10 px-2.5 py-1.5 rounded-full border border-primary/20">
          <RefreshCw className="w-3 h-3" style={{ animation: "spin 30s linear infinite" }} />
          {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Messages", value: kpi.total.toLocaleString(), icon: <MessageSquare className="w-4 h-4" />, color: "text-primary" },
          { label: "AI Commands", value: kpi.aiCmds.toLocaleString(), icon: <Zap className="w-4 h-4" />, color: "text-neon-blue" },
          { label: "Code Generated", value: kpi.codeCmds.toLocaleString(), icon: <Code className="w-4 h-4" />, color: "text-primary" },
          { label: "Images Created", value: kpi.imageCmds.toLocaleString(), icon: <Image className="w-4 h-4" />, color: "text-neon-purple" },
          { label: "Total Users", value: kpi.totalUsers.toLocaleString(), icon: <Users className="w-4 h-4" />, color: "text-primary" },
          {
            label: "Avg Response",
            value: kpi.avgResponseMs > 0 ? `${(kpi.avgResponseMs / 1000).toFixed(1)}s` : "—",
            icon: <Clock className="w-4 h-4" />,
            color: "text-neon-blue",
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-2xl bg-card border border-border p-4">
            <div className={cn("p-2 rounded-lg bg-secondary mb-3 w-fit", color)}>{icon}</div>
            {loading ? (
              <div className="h-6 bg-secondary rounded animate-pulse w-16 mb-1" />
            ) : (
              <p className="text-xl font-bold text-foreground">{value}</p>
            )}
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Hourly volume + daily messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly (last 24h) */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Hourly Message Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 24 hours</p>
          {loading ? (
            <div className="h-[200px] bg-secondary/30 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData} barGap={2}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false}
                  interval={Math.floor(hourlyData.length / 6)} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="messages" fill="#00ff88" opacity={0.8} radius={[3, 3, 0, 0]} name="Messages" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily user growth (30 days) */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Active Users Per Day</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 14 days — unique senders</p>
          {loading ? (
            <div className="h-[200px] bg-secondary/30 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartDays}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false}
                  interval={Math.floor(chartDays.length / 5)} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="users" stroke="#00ff88" fill="url(#userGrad)" strokeWidth={2}
                  name="Users" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Daily command breakdown */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Daily Message Breakdown</h3>
        <p className="text-xs text-muted-foreground mb-4">Last 14 days — by command type</p>
        {loading ? (
          <div className="h-[200px] bg-secondary/30 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartDays} barGap={2}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false}
                interval={Math.floor(chartDays.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="aiCmds" stackId="a" fill="#00ccff" opacity={0.85} name="/ai" />
              <Bar dataKey="codeCmds" stackId="a" fill="#00ff88" opacity={0.85} name="/code" />
              <Bar dataKey="imageCmds" stackId="a" fill="#aa88ff" opacity={0.85} name="/image" />
              <Bar dataKey="messages" stackId="b" fill="#374151" opacity={0.4} name="total" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-3">
          {[
            { color: "#00ccff", label: "/ai" },
            { color: "#00ff88", label: "/code" },
            { color: "#aa88ff", label: "/image" },
            { color: "#374151", label: "Total" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Command distribution */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Command Distribution</h3>
          <p className="text-xs text-muted-foreground mb-3">All-time command usage breakdown</p>
          {loading ? (
            <div className="h-[160px] bg-secondary/30 rounded-xl animate-pulse" />
          ) : commandStats.length === 0 || commandStats.every(s => s.value === 0) ? (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No data yet</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={commandStats} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {commandStats.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {commandStats.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                    <span>{name}</span>
                    <span className="ml-auto font-mono text-foreground">{value}</span>
                    <span className="text-[9px] opacity-60">({Math.round((value / totalCmds) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Language distribution */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Language Distribution</h3>
          <p className="text-xs text-muted-foreground mb-3">User language settings from database</p>
          {loading ? (
            <div className="h-[160px] bg-secondary/30 rounded-xl animate-pulse" />
          ) : langStats.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No users yet</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={langStats} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {langStats.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {langStats.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-2 text-[11px]">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                    <span className="text-muted-foreground">{name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
                    </div>
                    <span className="font-mono text-foreground">{value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper for cn (cn is imported above via @/lib/utils but used inline in KPI section)
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}
