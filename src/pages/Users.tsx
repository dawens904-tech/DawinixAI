import { useState } from "react";
import { MOCK_USERS } from "@/constants/mockData";
import type { WhatsAppUser } from "@/types";
import { formatRelativeTime, formatDate, maskPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, Users, ShieldOff, Shield, Brain, Gauge } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES = {
  active: "bg-primary/10 text-primary border border-primary/20",
  idle: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
  blocked: "bg-destructive/10 text-destructive border border-destructive/20",
};

const LANG_LABELS: Record<string, string> = { en: "🇺🇸 EN", fr: "🇫🇷 FR", ht: "🇭🇹 HT" };

function RateLimitBar({ value, max = 50 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct > 50 ? "#00ff88" : pct > 20 ? "#facc15" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{value}/{max}</span>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<WhatsAppUser[]>(MOCK_USERS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "idle" | "blocked">("all");

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    const matchFilter = filter === "all" || u.status === filter;
    return matchSearch && matchFilter;
  });

  const toggleBlock = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const next = u.status === "blocked" ? "idle" : "blocked";
        toast.success(next === "blocked" ? `User ${u.name} blocked` : `User ${u.name} unblocked`);
        return { ...u, status: next };
      })
    );
  };

  const toggleMemory = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        toast.success(`Memory ${u.memoryEnabled ? "disabled" : "enabled"} for ${u.name}`);
        return { ...u, memoryEnabled: !u.memoryEnabled };
      })
    );
  };

  const counts = {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    idle: users.filter((u) => u.status === "idle").length,
    blocked: users.filter((u) => u.status === "blocked").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground">{users.length} registered WhatsApp users</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "idle", "blocked"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all",
                filter === s
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border hover:border-border/80"
              )}
            >
              {s} <span className="ml-1 opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Phone", "Status", "Messages", "Commands", "Language", "Rate Limit", "Memory", "Last Seen", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <p className="text-xs font-semibold text-foreground whitespace-nowrap">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Since {formatDate(user.firstSeen)}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{maskPhone(user.phone)}</span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap", STATUS_STYLES[user.status])}>
                      {user.status}
                    </span>
                  </td>
                  {/* Messages */}
                  <td className="px-4 py-3 text-xs text-foreground">{user.totalMessages}</td>
                  {/* Commands */}
                  <td className="px-4 py-3 text-xs text-foreground">{user.commandsUsed}</td>
                  {/* Language */}
                  <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">{LANG_LABELS[user.language]}</td>
                  {/* Rate Limit */}
                  <td className="px-4 py-3 min-w-[120px]">
                    <RateLimitBar value={user.rateLimit} />
                  </td>
                  {/* Memory */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMemory(user.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border",
                        user.memoryEnabled
                          ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20"
                          : "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      <Brain className="w-3 h-3" />
                      {user.memoryEnabled ? "On" : "Off"}
                    </button>
                  </td>
                  {/* Last Seen */}
                  <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap font-mono">
                    {formatRelativeTime(user.lastSeen)}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBlock(user.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                        user.status === "blocked"
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                          : "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                      )}
                    >
                      {user.status === "blocked" ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                      {user.status === "blocked" ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: <Users className="w-4 h-4" /> },
          { label: "Active Now", value: counts.active, icon: <Gauge className="w-4 h-4 text-primary" /> },
          { label: "Memory Enabled", value: users.filter((u) => u.memoryEnabled).length, icon: <Brain className="w-4 h-4 text-neon-blue" /> },
          { label: "Blocked", value: counts.blocked, icon: <ShieldOff className="w-4 h-4 text-destructive" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">{icon}</div>
            <div>
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
