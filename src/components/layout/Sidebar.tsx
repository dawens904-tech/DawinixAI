import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MessageSquare, Users, Settings,
  BarChart3, BookOpen, X, Zap, Circle, Terminal, FlaskConical, Wrench, Send, Radio
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const MAIN_NAV = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Conversations", path: "/conversations", icon: MessageSquare },
  { label: "Users", path: "/users", icon: Users },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
];

const TOOLS_NAV = [
  { label: "Bot Config", path: "/config", icon: Settings },
  { label: "Command Builder", path: "/commands", icon: Wrench },
  { label: "Send Message", path: "/send", icon: Send },
  { label: "Broadcast", path: "/broadcast", icon: Radio },
  { label: "Simulator", path: "/simulator", icon: FlaskConical },
  { label: "System Logs", path: "/logs", icon: Terminal },
  { label: "Setup Guide", path: "/setup", icon: BookOpen },
];

function NavItem({ label, path, icon: Icon, onClose }: { label: string; path: string; icon: React.ElementType; onClose: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === path;
  return (
    <NavLink
      to={path}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary/10 text-primary border border-primary/20 glow-green"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "")} />
      {label}
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-50 h-full flex flex-col transition-transform duration-300",
          "bg-dark-800 border-r border-border",
          "w-[260px] shrink-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-green">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-gradient leading-none">Dawinix AI</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">WhatsApp Bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bot Status */}
        <div className="mx-4 mt-4 mb-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2.5">
            <Circle className="w-2.5 h-2.5 fill-primary text-primary pulse-dot" />
            <div>
              <p className="text-xs font-semibold text-primary">Bot Online</p>
              <p className="text-[10px] text-muted-foreground font-mono">Webhook Active</p>
            </div>
            <div className="ml-auto text-[10px] font-mono text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
              99.8%
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 mt-1">
            Dashboard
          </p>
          {MAIN_NAV.map((item) => (
            <NavItem key={item.path} {...item} onClose={onClose} />
          ))}

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 mt-3">
            Tools
          </p>
          {TOOLS_NAV.map((item) => (
            <NavItem key={item.path} {...item} onClose={onClose} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">D</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Admin Panel</p>
              <p className="text-[10px] text-muted-foreground">v2.0.0 · Dawinix AI</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
