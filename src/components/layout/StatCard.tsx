import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

const tones = {
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
};

export function StatCard({ icon: Icon, label, value, tone = "primary", onClick, subtitle }: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: keyof typeof tones;
  onClick?: () => void;
  subtitle?: string;
}) {
  const t = tones[tone];
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`bg-card border border-border border-l-[3px] ${t.border} rounded-xl p-4 shadow-sm text-left transition-all ${interactive ? "hover:shadow-md hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums truncate">{value}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
        </div>
        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {interactive && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <span className={t.text}>View all</span>
          <ChevronRight className="size-3" />
        </div>
      )}
    </button>
  );
}
