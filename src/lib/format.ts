export function currency(n: number, symbol = "Rs. ") {
  const v = Number.isFinite(n) ? n : 0;
  return `${symbol}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function dateShort(ts?: number | string) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  in_production: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  delivered: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30",
  finished: "bg-sky-600/15 text-sky-700 dark:text-sky-400 border-sky-600/30",
  cancelled: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
