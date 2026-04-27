import { MessageSquare, Users, Zap, Image, Terminal, TrendingUp, Circle } from "lucide-react";
import StatCard from "@/components/features/StatCard";
import ActivityFeed from "@/components/features/ActivityFeed";
import { MOCK_ACTIVITY, MOCK_CONVERSATIONS, MOCK_ANALYTICS } from "@/constants/mockData";
import { formatRelativeTime } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import heroBanner from "@/assets/hero-banner.jpg";

const STATS = [
  { label: "Total Messages Today", value: "73", change: "+18%", positive: true, icon: <MessageSquare className="w-5 h-5" />, accent: true },
  { label: "Active Users", value: "10", change: "+25%", positive: true, icon: <Users className="w-5 h-5" /> },
  { label: "AI Commands Used", value: "31", change: "+12%", positive: true, icon: <Zap className="w-5 h-5" /> },
  { label: "Images Generated", value: "12", change: "+40%", positive: true, icon: <Image className="w-5 h-5" /> },
  { label: "Code Requests", value: "19", change: "-5%", positive: false, icon: <Terminal className="w-5 h-5" /> },
  { label: "Avg Response Time", value: "1.2s", change: "-8%", positive: true, icon: <TrendingUp className="w-5 h-5" /> },
];

export default function Overview() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 md:h-56">
        <img
          src={heroBanner}
          alt="Dawinix AI Dashboard"
          className="w-full h-full object-cover"
        />
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
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Message Volume Chart */}
        <div className="lg:col-span-3 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Message Volume</h3>
              <p className="text-xs text-muted-foreground">Last 7 days activity</p>
            </div>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              536 total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_ANALYTICS} barGap={4}>
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
            <button
              onClick={() => navigate("/conversations")}
              className="text-[11px] text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {MOCK_CONVERSATIONS.slice(0, 4).map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate("/conversations")}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <img src={conv.avatar} alt={conv.userName} className="w-8 h-8 rounded-full object-cover" />
                  {conv.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground truncate">{conv.userName}</p>
                    <p className="text-[10px] text-muted-foreground ml-1 shrink-0">{formatRelativeTime(conv.lastMessageTime)}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{conv.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">System Activity Log</h3>
            <p className="text-xs text-muted-foreground">Real-time webhook & bot events</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono">
            <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
            Live
          </div>
        </div>
        <ActivityFeed logs={MOCK_ACTIVITY} />
      </div>
    </div>
  );
}
