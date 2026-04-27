import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area
} from "recharts";
import {
  TrendingUp, MessageSquare, Code, Image, Zap, RefreshCw,
  Users, Clock, Users2, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface GroupStat {
  phone: string;
  name: string;
  messages: number;
}

interface GroupAnalytics {
  activeGroups: number;
  groupMessages: number;
  dmMessages: number;
  perGroup: GroupStat[];
  topMembers: { phone: string; name: string | null; count: number }[];
}

// A phone is considered a group JID if it contains "-" (WhatsApp group IDs look like 1234567890-1234567890@g.us)
// or if the conversations table has a phone that doesn't look like a standard E.164 number (too long / has @)
function isGroupPhone(phone: string) {
  return phone.includes("-") || phone.includes("@g") || phone.length > 15;
}

export default function Analytics() {
  const [kpi, setKpi] = useState<KPI>({ total: 0, aiCmds: 0, codeCmds: 0, imageCmds: 0, avgResponseMs: 0, totalUsers: 0 });
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourData[]>([]);
  const [commandStats, setCommandStats] = useState<CommandStat[]>([]);
  const [langStats, setLangStats] = useState<LangStat[]>([]);
  const [groupAnalytics, setGroupAnalytics] = useState<GroupAnalytics>({
    activeGroups: 0,
    groupMessages: 0,
    dmMessages: 0,
    perGroup: [],
    topMembers: [],
  });
  const [activeTab, setActiveTab] = useState<"overview" | "groups">("overview");
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
    const plainText = Math.max(0, (total ?? 0) - (aiCmds ?? 0) - (codeCmds ?? 0) - (imageCmds ?? 0));
    if (plainText > 0) cmdData.push({ name: "text", value: plainText, color: "#6b7280" });
    setCommandStats(cmdData);

    // ── Language distribution ────────────────────────────────────────────
    const { data: langData } = await supabase.from("whatsapp_users").select("language");
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

    // ── Group Analytics ──────────────────────────────────────────────────
    const { data: allConvs } = await supabase
      .from("conversations")
      .select("phone, user_name, message_count")
      .order("message_count", { ascending: false });

    const groupConvs = (allConvs ?? []).filter((c: { phone: string }) => isGroupPhone(c.phone));
    const dmConvs = (allConvs ?? []).filter((c: { phone: string }) => !isGroupPhone(c.phone));

    const groupMsgTotal = groupConvs.reduce(
      (sum: number, c: { message_count: number }) => sum + (c.message_count ?? 0), 0
    );
    const dmMsgTotal = dmConvs.reduce(
      (sum: number, c: { message_count: number }) => sum + (c.message_count ?? 0), 0
    );

    const perGroup: GroupStat[] = groupConvs.slice(0, 8).map(
      (c: { phone: string; user_name: string | null; message_count: number }) => ({
        phone: c.phone,
        name: c.user_name ?? c.phone.slice(0, 12),
        messages: c.message_count ?? 0,
      })
    );

    // Top group members: messages sent in group conversations
    const groupPhones = groupConvs.map((c: { phone: string }) => c.phone);
    let topMembers: { phone: string; name: string | null; count: number }[] = [];

    if (groupPhones.length > 0) {
      const { data: groupMsgs } = await supabase
        .from("messages")
        .select("phone")
        .eq("role", "user")
        .in("phone", groupPhones)
        .limit(500);

      const memberMap: Record<string, number> = {};
      for (const m of groupMsgs ?? []) {
        const p = m.phone as string;
        memberMap[p] = (memberMap[p] ?? 0) + 1;
      }

      topMembers = Object.entries(memberMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([phone, count]) => ({ phone, name: null, count }));
    }

    setGroupAnalytics({
      activeGroups: groupConvs.length,
      groupMessages: groupMsgTotal,
      dmMessages: dmMsgTotal,
      perGroup,
      topMembers,
    });

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totalCmds = commandStats.reduce((a, b) => a + b.value, 0) || 1;
  const chartDays = dailyData.slice(-14);

  const dmVsGroupData = [
    { name: "Direct Messages", value: groupAnalytics.dmMessages, color: "#00ff88" },
    { name: "Group Messages", value: groupAnalytics.groupMessages, color: "#00ccff" },
  ];
  const totalDmGroup = (groupAnalytics.dmMessages + groupAnalytics.groupMessages) || 1;

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
          { label: "AI Commands", value: kpi.aiCmds.toLocaleString(), icon: <Zap className="w-4 h-4" />, color: "text-[#00ccff]" },
          { label: "Code Generated", value: kpi.codeCmds.toLocaleString(), icon: <Code className="w-4 h-4" />, color: "text-primary" },
          { label: "Images Created", value: kpi.imageCmds.toLocaleString(), icon: <Image className="w-4 h-4" />, color: "text-[#aa88ff]" },
          { label: "Total Users", value: kpi.totalUsers.toLocaleString(), icon: <Users className="w-4 h-4" />, color: "text-primary" },
          {
            label: "Avg Response",
            value: kpi.avgResponseMs > 0 ? `${(kpi.avgResponseMs / 1000).toFixed(1)}s` : "—",
            icon: <Clock className="w-4 h-4" />,
            color: "text-[#00ccff]",
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

      {/* Tabs: Overview / Groups */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl border border-border w-fit">
        {[
          { id: "overview", label: "Overview", icon: TrendingUp },
          { id: "groups", label: "Group Analytics", icon: Users2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as "overview" | "groups")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              activeTab === id
                ? "bg-card text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          {/* Hourly volume + daily messages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
        </>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          {/* Group KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Active Groups",
                value: groupAnalytics.activeGroups,
                icon: <Users2 className="w-4 h-4" />,
                color: "text-[#00ccff]",
                bg: "bg-[#00ccff]/10",
              },
              {
                label: "Group Messages",
                value: groupAnalytics.groupMessages,
                icon: <MessageSquare className="w-4 h-4" />,
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                label: "DM Messages",
                value: groupAnalytics.dmMessages,
                icon: <Globe className="w-4 h-4" />,
                color: "text-[#aa88ff]",
                bg: "bg-[#aa88ff]/10",
              },
              {
                label: "Group Share",
                value: groupAnalytics.groupMessages + groupAnalytics.dmMessages > 0
                  ? `${Math.round((groupAnalytics.groupMessages / totalDmGroup) * 100)}%`
                  : "0%",
                icon: <TrendingUp className="w-4 h-4" />,
                color: "text-[#00ccff]",
                bg: "bg-[#00ccff]/10",
              },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className="rounded-2xl bg-card border border-border p-4">
                <div className={cn("p-2 rounded-lg mb-3 w-fit", bg, color)}>{icon}</div>
                {loading ? (
                  <div className="h-6 bg-secondary rounded animate-pulse w-16 mb-1" />
                ) : (
                  <p className="text-xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* DM vs Group ratio + Messages per group */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DM vs Group pie */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">DM vs Group Message Ratio</h3>
              <p className="text-xs text-muted-foreground mb-3">All-time message distribution</p>
              {loading ? (
                <div className="h-[180px] bg-secondary/30 rounded-xl animate-pulse" />
              ) : dmVsGroupData.every(d => d.value === 0) ? (
                <div className="h-[180px] flex items-center justify-center flex-col gap-2">
                  <Users2 className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No group conversations yet</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={dmVsGroupData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                        {dmVsGroupData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 justify-center mt-2">
                    {dmVsGroupData.map(({ name, value, color }) => (
                      <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                        <span>{name}</span>
                        <span className="font-mono text-foreground ml-1">
                          {Math.round((value / totalDmGroup) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Messages per group bar chart */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Messages Per Group</h3>
              <p className="text-xs text-muted-foreground mb-4">Top 8 most active groups</p>
              {loading ? (
                <div className="h-[180px] bg-secondary/30 rounded-xl animate-pulse" />
              ) : groupAnalytics.perGroup.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center flex-col gap-2">
                  <Users2 className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No group conversations detected</p>
                  <p className="text-[10px] text-muted-foreground text-center max-w-[180px]">
                    Add the bot to a WhatsApp group to see group analytics here
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={groupAnalytics.perGroup} layout="vertical" barGap={2}>
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                    />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="messages" fill="#00ccff" opacity={0.85} radius={[0, 3, 3, 0]} name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top group members */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Most Active Group Members</h3>
            <p className="text-xs text-muted-foreground mb-4">Users who sent the most messages in group chats</p>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary/30 rounded-xl animate-pulse" />)}
              </div>
            ) : groupAnalytics.topMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No group member data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupAnalytics.topMembers.map((member, i) => {
                  const maxCount = groupAnalytics.topMembers[0]?.count || 1;
                  const pct = Math.round((member.count / maxCount) * 100);
                  return (
                    <div key={member.phone} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-foreground truncate">+{member.phone}</span>
                          <span className="text-[10px] font-mono text-primary ml-2 shrink-0">{member.count} msgs</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#00ccff] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
