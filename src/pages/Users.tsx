import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Search, Users, ShieldOff, Shield, Brain, Gauge,
  RefreshCw, Circle, Edit3, Check, X
} from "lucide-react";
import { toast } from "sonner";

interface WAUser {
  id: string;
  phone: string;
  name: string | null;
  language: string;
  status: string;
  memory_enabled: boolean;
  rate_limit: number;
  commands_used: number;
  total_messages: number;
  first_seen: string;
  last_seen: string;
  invite_sent: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary border border-primary/20",
  idle: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
  blocked: "bg-destructive/10 text-destructive border border-destructive/20",
};

const LANG_LABELS: Record<string, string> = { en: "🇺🇸 EN", fr: "🇫🇷 FR", ht: "🇭🇹 HT" };

function safeDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatRelativeTime(val: string | null | undefined): string {
  const d = safeDate(val);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(val: string | null | undefined): string {
  const d = safeDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
}

function RateLimitBar({ value, max = 50 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct > 60 ? "#00ff88" : pct > 30 ? "#facc15" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{value}/{max}</span>
    </div>
  );
}

function Avatar({ name, phone }: { name: string | null; phone: string }) {
  const letter = name ? name.charAt(0).toUpperCase() : phone.slice(-2);
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-primary">{letter}</span>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<WAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [editRateId, setEditRateId] = useState<string | null>(null);
  const [editRateVal, setEditRateVal] = useState("");

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_users")
      .select("*")
      .order("last_seen", { ascending: false });
    if (!error && data) setUsers(data as WAUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 15000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleBlock = async (user: WAUser) => {
    const newStatus = user.status === "blocked" ? "active" : "blocked";
    const { error } = await supabase.from("whatsapp_users").update({ status: newStatus }).eq("id", user.id);
    if (!error) {
      toast.success(newStatus === "blocked" ? `Blocked ${user.name ?? user.phone}` : `Unblocked ${user.name ?? user.phone}`);
      fetchUsers();
    }
    await supabase.from("conversations").update({ is_blocked: newStatus === "blocked" }).eq("phone", user.phone);
  };

  const handleMemory = async (user: WAUser) => {
    const { error } = await supabase.from("whatsapp_users").update({ memory_enabled: !user.memory_enabled }).eq("id", user.id);
    if (!error) {
      toast.success(`Memory ${user.memory_enabled ? "disabled" : "enabled"} for ${user.name ?? user.phone}`);
      fetchUsers();
    }
  };

  const handleSaveRate = async (user: WAUser) => {
    const val = parseInt(editRateVal);
    if (isNaN(val) || val < 1 || val > 500) {
      toast.error("Rate limit must be between 1 and 500");
      return;
    }
    const { error } = await supabase.from("whatsapp_users").update({ rate_limit: val }).eq("id", user.id);
    if (!error) {
      toast.success(`Rate limit updated to ${val} for ${user.name ?? user.phone}`);
      fetchUsers();
    }
    setEditRateId(null);
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);
    const matchFilter =
      filter === "all" ||
      (filter === "active" && u.status === "active") ||
      (filter === "blocked" && u.status === "blocked");
    return matchSearch && matchFilter;
  });

  const counts = {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    blocked: users.filter((u) => u.status === "blocked").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground">Real-time WhatsApp user data — auto-refresh every 15s</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary bg-primary/10 px-2.5 py-1.5 rounded-full border border-primary/20">
          <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
          Live · {users.length} users
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: <Users className="w-4 h-4" />, color: "text-foreground" },
          { label: "Active", value: counts.active, icon: <Gauge className="w-4 h-4 text-primary" />, color: "text-primary" },
          { label: "Memory On", value: users.filter((u) => u.memory_enabled).length, icon: <Brain className="w-4 h-4 text-neon-blue" />, color: "text-neon-blue" },
          { label: "Blocked", value: counts.blocked, icon: <ShieldOff className="w-4 h-4 text-destructive" />, color: "text-destructive" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">{icon}</div>
            <div>
              {loading ? (
                <div className="h-6 w-8 bg-secondary rounded animate-pulse mb-0.5" />
              ) : (
                <p className={cn("text-lg font-bold", color)}>{value}</p>
              )}
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
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
          {(["all", "active", "blocked"] as const).map((s) => (
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
        <button
          onClick={fetchUsers}
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Phone", "Status", "Messages", "Commands", "Language", "Rate Limit", "Memory", "Invite", "Last Seen", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-secondary rounded animate-pulse" style={{ width: j === 0 ? 120 : 60 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">
                      {search ? "No users match your search" : "No users yet — send a WhatsApp message to start"}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className={cn("hover:bg-secondary/30 transition-colors", user.status === "blocked" && "opacity-60")}>
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} phone={user.phone} />
                        <div>
                          <p className="text-xs font-semibold text-foreground whitespace-nowrap">{user.name ?? user.phone}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Since {formatDate(user.first_seen)}
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
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap", STATUS_STYLES[user.status] ?? STATUS_STYLES.idle)}>
                        {user.status}
                      </span>
                    </td>
                    {/* Messages */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground font-mono">{user.total_messages}</span>
                    </td>
                    {/* Commands */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground font-mono">{user.commands_used}</span>
                    </td>
                    {/* Language */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {LANG_LABELS[user.language] ?? user.language?.toUpperCase() ?? "EN"}
                      </span>
                    </td>
                    {/* Rate Limit */}
                    <td className="px-4 py-3 min-w-[140px]">
                      {editRateId === user.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editRateVal}
                            onChange={(e) => setEditRateVal(e.target.value)}
                            className="w-14 px-2 py-1 rounded-lg bg-dark-900 border border-primary/40 text-xs text-foreground focus:outline-none"
                            type="number"
                            min={1}
                            max={500}
                            autoFocus
                          />
                          <button onClick={() => handleSaveRate(user)} className="p-1 rounded text-primary hover:bg-primary/10">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditRateId(null)} className="p-1 rounded text-muted-foreground hover:bg-secondary">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <RateLimitBar value={user.rate_limit} />
                          <button
                            onClick={() => { setEditRateId(user.id); setEditRateVal(String(user.rate_limit)); }}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    {/* Memory */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleMemory(user)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border",
                          user.memory_enabled
                            ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20 hover:bg-neon-blue/20"
                            : "bg-secondary text-muted-foreground border-border hover:border-border/70"
                        )}
                      >
                        <Brain className="w-3 h-3" />
                        {user.memory_enabled ? "On" : "Off"}
                      </button>
                    </td>
                    {/* Invite */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border",
                        user.invite_sent
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-muted-foreground border-border"
                      )}>
                        {user.invite_sent ? "Sent" : "—"}
                      </span>
                    </td>
                    {/* Last Seen */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap font-mono">
                        {formatRelativeTime(user.last_seen)}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleBlock(user)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border whitespace-nowrap",
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
