import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, hint }: {
  icon: React.ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className="size-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <Icon className="size-5 text-muted-foreground/50" />
      </div>
      <div className="text-sm text-muted-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground/60 mt-1">{hint}</div>}
    </div>
  );
}
