import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface DateFieldProps {
  label: string;
  value: number;
  onChange: (timestamp: number) => void;
  /** Optional default mode (defaults to "auto") */
  defaultMode?: "auto" | "manual";
  /** Optional className for the wrapper */
  className?: string;
}

function toInputDate(ts: number) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromInputDate(str: string) {
  return new Date(`${str}T12:00:00`).getTime();
}

export function DateField({
  label,
  value,
  onChange,
  defaultMode = "auto",
  className = "",
}: DateFieldProps) {
  const [mode, setMode] = useState<"auto" | "manual">(defaultMode);
  const todayInput = toInputDate(Date.now());

  // When switching to auto, set the value to today's date
  useEffect(() => {
    if (mode === "auto") {
      onChange(Date.now());
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputValue = mode === "auto" ? todayInput : toInputDate(value);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] leading-none cursor-pointer select-none ${
              mode === "auto" ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
            onClick={() => setMode("auto")}
          >
            Auto
          </span>
          <Switch
            checked={mode === "manual"}
            onCheckedChange={(checked) => setMode(checked ? "manual" : "auto")}
            className="scale-75 data-[state=checked]:bg-primary"
          />
          <span
            className={`text-[10px] leading-none cursor-pointer select-none ${
              mode === "manual" ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
            onClick={() => setMode("manual")}
          >
            Manual
          </span>
        </div>
      </div>
      <Input
        type="date"
        value={inputValue}
        disabled={mode === "auto"}
        onChange={(e) => {
          if (mode === "manual") {
            onChange(fromInputDate(e.target.value));
          }
        }}
        className={`h-8 ${mode === "auto" ? "opacity-60" : ""}`}
      />
      {mode === "auto" && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Using today's date ({new Date(Date.now()).toLocaleDateString("en-IN")})
        </p>
      )}
    </div>
  );
}

