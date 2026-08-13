import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { APP_LOGO_URL } from "@/lib/brand";

export function AppShell({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground relative">
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <img
          src={APP_LOGO_URL}
          alt=""
          className="w-[320px] h-auto object-contain opacity-[0.07] dark:opacity-[0.09] dark:invert select-none"
          aria-hidden
        />
      </div>
      <AppSidebar />
      <div className="md:ml-56 flex flex-col min-h-screen min-w-0 relative z-10">
        <Topbar title={title} />
        {actions && (
          <div className="h-11 shrink-0 border-b border-border bg-card flex items-center px-4 gap-2">
            {actions}
          </div>
        )}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}


export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="p-4 md:p-5 space-y-4">{children}</div>;
}
