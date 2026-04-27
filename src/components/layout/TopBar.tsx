import { Menu, Bell, RefreshCw, Wifi } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/conversations": "Live Conversations",
  "/users": "User Management",
  "/analytics": "Analytics",
  "/config": "Bot Configuration",
  "/commands": "Command Builder",
  "/simulator": "Webhook Simulator",
  "/logs": "System Logs",
  "/setup": "Setup Guide",
};

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const pageTitle = ROUTE_LABELS[location.pathname] ?? "Dawinix AI";

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <header className="h-14 flex items-center px-4 md:px-6 border-b border-border bg-dark-800/80 backdrop-blur-sm shrink-0 gap-4 sticky top-0 z-30">
      {/* Menu button (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:block w-px h-5 bg-border" />
        <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Right controls */}
      <div className="ml-auto flex items-center gap-2">
        {/* Webhook indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary">
          <Wifi className="w-3 h-3" />
          Webhook Live
        </div>

        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4 transition-transform duration-700", refreshing && "animate-spin")} />
        </button>

        <button className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
      </div>
    </header>
  );
}
