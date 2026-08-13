export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export type DateRange = { start: number; end: number };

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  custom: "Custom Range",
};

export function resolvePresetRange(preset: DateRangePreset, now = Date.now()): DateRange {
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      return { start: startOfDay(now - 86400000), end: endOfDay(now - 86400000) };
    case "thisWeek": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = (day + 6) % 7;
      const monday = startOfDay(d.getTime() - diff * 86400000);
      return { start: monday, end: endOfDay(monday + 6 * 86400000) };
    }
    case "thisMonth": {
      const d = new Date(now);
      const first = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "lastMonth": {
      const d = new Date(now);
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
      const last = new Date(d.getFullYear(), d.getMonth(), 0).getTime();
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "custom":
    default:
      return { start: 0, end: Number.MAX_SAFE_INTEGER };
  }
}

export function rangeFromCustom(startStr: string, endStr: string): DateRange {
  const start = startStr ? startOfDay(new Date(startStr).getTime()) : 0;
  const end = endStr ? endOfDay(new Date(endStr).getTime()) : Number.MAX_SAFE_INTEGER;
  return { start, end };
}
