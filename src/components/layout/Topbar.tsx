import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { Bell, CheckCheck, LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type SearchResult = { label: string; meta: string; to: string };

export function Topbar({ title }: { title?: string }) {
  const { theme, toggle } = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState("");
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [notifications, setNotifications] = useState<{ key: string; title: string; body: string; to: string }[]>([]);

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);

  // Load notifications on mount
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [inventory, orders, expenses] = await Promise.all([
          api.safeGet<any[]>("/api/inventory"),
          api.safeGet<any[]>("/api/orders"),
          api.safeGet<any[]>("/api/expenses"),
        ]);
        const lowStock = (inventory || []).filter((i: any) => i.currentStock < i.minStock).slice(0, 3);
        const pendingOrders = (orders || []).filter((o: any) => ["pending", "confirmed", "in_production"].includes(o.status)).slice(0, 3);
        const today = new Date().toDateString();
        const todayExpenses = (expenses || []).filter((e: any) => new Date(e.date).toDateString() === today);

        const notifs: { key: string; title: string; body: string; to: string }[] = [
          ...lowStock.map((i: any) => ({ key: `low-stock-${i.id}`, title: "Low stock", body: `${i.name}: ${i.currentStock} ${i.unit}`, to: "/inventory" })),
          ...pendingOrders.map((o: any) => ({ key: `order-${o.id}`, title: "Order in progress", body: `${o.number} - ${o.customerName}`, to: "/orders" })),
        ];
        if (todayExpenses.length) notifs.push({ key: "today-expenses", title: "Today expenses", body: `${todayExpenses.length} entries recorded`, to: "/expenses" });
        setNotifications(notifs.slice(0, 8));
      } catch {}
    };
    loadNotifications();
  }, []);

  // Search
  useEffect(() => {
    if (!q.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const query = q.trim().toLowerCase();
        const [custs, ords, prods] = await Promise.all([
          api.safeGet<any[]>("/api/customers"),
          api.safeGet<any[]>("/api/orders"),
          api.safeGet<any[]>("/api/products"),
        ]);
        const results: SearchResult[] = [
          ...(custs || []).filter((c: any) => [c.name, c.code, c.mobile, c.city].some((v: any) => v?.toLowerCase().includes(query))).slice(0, 3).map((c: any) => ({ label: c.name, meta: c.code, to: "/customers" })),
          ...(ords || []).filter((o: any) => [o.number, o.customerName].some((v: any) => v.toLowerCase().includes(query))).slice(0, 3).map((o: any) => ({ label: o.number, meta: o.customerName, to: "/orders" })),
          ...(prods || []).filter((p: any) => [p.name, p.code, p.category].some((v: any) => v?.toLowerCase().includes(query))).slice(0, 3).map((p: any) => ({ label: p.name, meta: p.code, to: "/products" })),
        ].slice(0, 7);
        setSearchResults(results);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { const stored = localStorage.getItem("dismissedNotifications"); return new Set(stored ? JSON.parse(stored) : []); } catch { return new Set(); }
  });

  const visibleNotifications = notifications.filter((n) => !dismissed.has(n.key));
  const unreadCount = visibleNotifications.length;

  const markAllRead = useCallback(() => {
    const keys = notifications.map((n) => n.key);
    const next = new Set([...dismissed, ...keys]);
    setDismissed(next);
    localStorage.setItem("dismissedNotifications", JSON.stringify([...next]));
  }, [notifications, dismissed]);

  const submitSearch = () => {
    if (searchResults.length) { navigate({ to: searchResults[0].to as any }); setQ(""); }
  };

  const roleLabel = currentUser?.role === "admin" ? "Administrator" : "Manager";
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <header className="h-12 shrink-0 bg-topbar text-topbar-foreground border-b border-border flex items-center gap-3 px-4">
      <div className="text-sm font-semibold tracking-tight">{title ?? "Dashboard"}</div>
      <div className="ml-4 flex-1 max-w-md relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); if (e.key === "Escape") setQ(""); }} placeholder="Search customers, orders, products..." className="h-8 pl-8 text-sm bg-muted/60 border-transparent focus-visible:bg-background" autoComplete="off" />
        {q && (
          <div className="absolute left-0 right-0 top-10 z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            {searchResults.length ? searchResults.map((result, i) => (
              <button key={`${result.to}-${i}`} onClick={() => { navigate({ to: result.to as any }); setQ(""); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between gap-3">
                <span className="truncate font-medium">{result.label}</span><span className="text-xs text-muted-foreground truncate">{result.meta}</span>
              </button>
            )) : <div className="px-3 py-3 text-sm text-muted-foreground">No results</div>}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden lg:inline text-xs text-muted-foreground tabular-nums px-2">{now}</span>
        <button onClick={toggle} className="size-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="size-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground relative" aria-label="Notifications">
              <Bell className="size-4" />
              {!!unreadCount && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">{unreadCount}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {!!visibleNotifications.length && <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><CheckCheck className="size-3" />Mark all read</button>}
            </div>
            <DropdownMenuSeparator />
            {visibleNotifications.length ? visibleNotifications.map((item, i) => (
              <button key={`${item.key}-${i}`} onClick={() => { const next = new Set(dismissed); next.add(item.key); setDismissed(next); localStorage.setItem("dismissedNotifications", JSON.stringify([...next])); navigate({ to: item.to as any }); }} className="w-full px-3 py-2.5 text-left hover:bg-accent rounded-sm border-l-2 border-transparent hover:border-primary transition-colors">
                <div className="text-sm font-medium">{item.title}</div><div className="text-xs text-muted-foreground mt-0.5">{item.body}</div>
              </button>
            )) : <div className="px-2 py-8 text-center text-sm text-muted-foreground">{notifications.length && !unreadCount ? "All caught up!" : "No notifications"}</div>}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-1 flex items-center gap-2 pl-2 border-l border-border h-6">
          <div className="size-7 rounded-full bg-primary/15 text-primary grid place-items-center"><User className="size-3.5" /></div>
          <div className="hidden sm:flex flex-col leading-tight"><span className="text-xs font-medium">{currentUser?.fullName || "User"}</span><span className="text-[10px] text-muted-foreground capitalize">{roleLabel}</span></div>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => setLogoutOpen(true)} title="Logout"><LogOut className="size-4" /></Button>
        </div>
      </div>
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>You are about to log out. Any unsaved data will be lost.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={logout}>Yes, log out</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
