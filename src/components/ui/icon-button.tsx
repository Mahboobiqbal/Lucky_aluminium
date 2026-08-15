import type { ReactNode } from "react";

export function IconButton({ onClick, label, children, variant = "default", className = "" }: {
  onClick?: () => void;
  label: string;
  children: ReactNode;
  variant?: "default" | "destructive";
  className?: string;
}) {
  const base = "size-8 rounded-lg grid place-items-center transition-colors shrink-0";
  const variants = {
    default: "hover:bg-accent text-muted-foreground hover:text-foreground",
    destructive: "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
  };
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
