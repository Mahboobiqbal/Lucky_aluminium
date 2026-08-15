import type { ReactNode } from "react";

export function TableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
