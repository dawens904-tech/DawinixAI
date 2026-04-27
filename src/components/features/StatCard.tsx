import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  accent?: boolean;
}

export default function StatCard({ label, value, change, positive, icon, accent }: StatCardProps) {
  return (
    <div className={cn(
      "relative rounded-2xl p-5 border transition-all hover:scale-[1.01]",
      accent
        ? "bg-primary/5 border-primary/30 glow-green"
        : "bg-card border-border hover:border-border/80"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          accent ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
          positive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        )}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <div className={cn("text-2xl font-bold mb-1", accent ? "text-gradient" : "text-foreground")}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
