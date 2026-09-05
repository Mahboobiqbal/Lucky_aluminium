import type { ReactNode } from "react";

export function TableActions({ children, justify = "center" }: { children: ReactNode; justify?: "center" | "end" }) {
  return (
    <div className={`flex items-center gap-1 flex-nowrap whitespace-nowrap ${justify === "end" ? "justify-end" : "justify-center"}`}>
      {children}
    </div>
  );
}
