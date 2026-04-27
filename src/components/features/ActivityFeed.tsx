import type { ActivityLog } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MessageSquare, Terminal, AlertTriangle, Webhook, Settings, CheckCircle2 } from "lucide-react";

interface ActivityFeedProps {
  logs: ActivityLog[];
}

const TYPE_ICONS = {
  message: MessageSquare,
  command: Terminal,
  error: AlertTriangle,
  webhook: Webhook,
  config: Settings,
};

const SEVERITY_STYLES = {
  info: "text-neon-blue bg-neon-blue/10 border-neon-blue/20",
  success: "text-primary bg-primary/10 border-primary/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  error: "text-destructive bg-destructive/10 border-destructive/20",
};

export default function ActivityFeed({ logs }: ActivityFeedProps) {
  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const Icon = TYPE_ICONS[log.type] ?? CheckCircle2;
        return (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors"
          >
            <div className={cn("mt-0.5 p-1.5 rounded-lg border text-xs shrink-0", SEVERITY_STYLES[log.severity])}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">{log.message}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {formatRelativeTime(log.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
