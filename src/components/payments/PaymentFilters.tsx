import { Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePreset, PRESET_LABELS, type DateRange } from "./paymentFilterUtils";

export function PaymentFilters({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomChange,
  search,
  onSearchChange,
  range,
}: {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (patch: { customStart?: string; customEnd?: string }) => void;
  search: string;
  onSearchChange: (value: string) => void;
  range: DateRange;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
      <div>
        <Label className="text-xs">Date filter</Label>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as DateRangePreset)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PRESET_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => onCustomChange({ customStart: e.target.value })}
              className="h-8 w-40"
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomChange({ customEnd: e.target.value })}
              className="h-8 w-40"
            />
          </div>
        </>
      )}

      <div className="lg:ml-auto flex-1 min-w-56">
        <Label className="text-xs">Search</Label>
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Invoice #, customer, method, reference"
            className="h-8 pl-8"
          />
        </div>
      </div>

      {preset !== "all" && (
        <div className="stat-card py-3 whitespace-nowrap">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Range</div>
          <div className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {new Date(range.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} –{" "}
            {new Date(range.end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      )}
    </div>
  );
}
