import { MOCK_ANALYTICS } from "@/constants/mockData";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, AreaChart, Area
} from "recharts";
import { TrendingUp, MessageSquare, Code, Image, Zap } from "lucide-react";

const COMMAND_PIE = [
  { name: "/ai", value: 239, color: "#00ccff" },
  { name: "/code", value: 150, color: "#00ff88" },
  { name: "/image", value: 87, color: "#aa88ff" },
  { name: "text", value: 60, color: "#6b7280" },
];

const LANG_DATA = [
  { name: "English", value: 62, color: "#00ff88" },
  { name: "Haitian Creole", value: 24, color: "#00ccff" },
  { name: "French", value: 14, color: "#aa88ff" },
];

const RESPONSE_DATA = [
  { date: "Apr 21", avg: 1.4 },
  { date: "Apr 22", avg: 1.1 },
  { date: "Apr 23", avg: 1.6 },
  { date: "Apr 24", avg: 0.9 },
  { date: "Apr 25", avg: 1.2 },
  { date: "Apr 26", avg: 1.0 },
  { date: "Apr 27", avg: 1.2 },
];

const TOOLTIP_STYLE = {
  contentStyle: { background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 },
  cursor: { fill: "rgba(0,255,136,0.05)" },
};

export default function Analytics() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground">Analytics</h2>
        <p className="text-xs text-muted-foreground">Performance metrics for the last 7 days</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Messages", value: "536", change: "+22%", icon: <MessageSquare className="w-4 h-4" />, color: "text-primary" },
          { label: "AI Commands", value: "239", change: "+18%", icon: <Zap className="w-4 h-4" />, color: "text-neon-blue" },
          { label: "Code Generated", value: "150", change: "+31%", icon: <Code className="w-4 h-4" />, color: "text-primary" },
          { label: "Images Created", value: "87", change: "+45%", icon: <Image className="w-4 h-4" />, color: "text-neon-purple" },
        ].map(({ label, value, change, icon, color }) => (
          <div key={label} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-lg bg-secondary ${color}`}>{icon}</div>
              <div className="flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                <TrendingUp className="w-3 h-3" />{change}
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Message Volume + Active Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Daily Message Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">Messages broken down by command type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_ANALYTICS} barGap={3}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="aiCommands" stackId="a" fill="#00ccff" opacity={0.85} name="/ai" />
              <Bar dataKey="codeCommands" stackId="a" fill="#00ff88" opacity={0.85} name="/code" />
              <Bar dataKey="imageCommands" stackId="a" fill="#aa88ff" opacity={0.85} name="/image" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Active Users Per Day</h3>
          <p className="text-xs text-muted-foreground mb-4">Unique WhatsApp users sending messages</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MOCK_ANALYTICS}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="activeUsers" stroke="#00ff88" fill="url(#userGrad)" strokeWidth={2} name="Users" dot={{ fill: "#00ff88", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Command Distribution */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Command Distribution</h3>
          <p className="text-xs text-muted-foreground mb-3">What users use most</p>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={COMMAND_PIE} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {COMMAND_PIE.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {COMMAND_PIE.map(({ name, value, color }) => (
              <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                <span>{name}</span>
                <span className="ml-auto font-mono text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Language Distribution */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Language Distribution</h3>
          <p className="text-xs text-muted-foreground mb-3">User languages detected</p>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={LANG_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {LANG_DATA.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {LANG_DATA.map(({ name, value, color }) => (
              <div key={name} className="flex items-center gap-2 text-[11px]">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                <span className="text-muted-foreground">{name}</span>
                <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
                </div>
                <span className="font-mono text-foreground">{value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Response Time */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Avg Response Time</h3>
          <p className="text-xs text-muted-foreground mb-3">Seconds per bot response</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={RESPONSE_DATA}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} domain={[0, 3]} />
              <Tooltip contentStyle={{ background: "#080d18", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="avg" stroke="#00ff88" strokeWidth={2} dot={{ fill: "#00ff88", r: 3 }} name="Seconds" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-[11px] text-muted-foreground">Peak: 1.6s</span>
            <span className="text-[11px] text-primary font-semibold">Avg: 1.2s</span>
            <span className="text-[11px] text-muted-foreground">Best: 0.9s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
