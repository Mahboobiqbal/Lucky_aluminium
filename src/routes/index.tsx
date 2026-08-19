import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, ClipboardList, Clock, Factory, PackageCheck, Truck, Wallet, TrendingDown, AlertTriangle, ArrowUpRight, Plus, Receipt, CreditCard, ChevronRight, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — UDYANA" }] }),
  component: Dashboard,
});

type Order = { id: number; number: string; customerId: number; customerName: string; orderDate: string; items: any[]; total: number; paid: number; status: string; createdAt: string };
type Expense = { id: number; category: string; amount: number; date: string };
type InventoryItem = { id: number; name: string; currentStock: number; minStock: number; supplier?: string };
type Setting = { key: string; value: string };

function StatCard({ icon: Icon, label, value, tone, onClick, subtitle }: { icon: LucideIcon; label: string; value: string; tone: "primary" | "emerald" | "amber" | "violet" | "rose" | "blue"; onClick?: () => void; subtitle?: string }) {
  const tones = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
  };
  const t = tones[tone];
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`bg-card border border-border border-l-[3px] ${t.border} rounded-xl p-4 shadow-sm text-left transition-all ${interactive ? "hover:shadow-md hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums truncate">{value}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
        </div>
        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {interactive && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <span className={t.text}>View all</span>
          <ChevronRight className="size-3" />
        </div>
      )}
    </button>
  );
}

function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col ${className ?? ""}`}>
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Dashboard() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ code: "", name: "", mobile: "", whatsapp: "", email: "", address: "", city: "", notes: "" });

  const [customerCount, setCustomerCount] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [custs, ords, exps, inv] = await Promise.all([
        api.safeGet<any[]>("/api/customers"), api.safeGet<Order[]>("/api/orders"),
        api.safeGet<Expense[]>("/api/expenses"), api.safeGet<InventoryItem[]>("/api/inventory"),
      ]);
      setCustomerCount(custs?.length || 0);
      setOrders(ords || []);
      setExpenses(exps || []);
      setInventory(inv || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSales = orders.reduce((s, o) => s + o.total, 0);
  const pendingPayments = orders.reduce((s, o) => s + Math.max(0, o.total - o.paid), 0);
  const byStatus = orders.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const today = new Date().toDateString();
  const dailyExpenses = expenses.filter((e) => new Date(e.date).toDateString() === today).reduce((s, e) => s + e.amount, 0);
  const lowStock = inventory.filter((i) => i.currentStock > 0 && i.currentStock < 10);

  const monthly = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleString("en-IN", { month: "short" });
    const rev = orders.filter((o) => new Date(o.orderDate).getMonth() === d.getMonth() && new Date(o.orderDate).getFullYear() === d.getFullYear()).reduce((s, o) => s + o.total, 0);
    const exp = expenses.filter((e) => new Date(e.date).getMonth() === d.getMonth() && new Date(e.date).getFullYear() === d.getFullYear()).reduce((s, e) => s + e.amount, 0);
    return { label, revenue: rev, expenses: exp };
  });

  const pieData = Object.entries(byStatus).map(([k, v]) => ({ name: statusLabel(k), value: v }));
  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const recent = useMemo(() => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8), [orders]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const saveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.mobile.trim()) return toast.error("Name and mobile required");
    try {
      await api.post("/api/customers", { ...customerForm, code: customerForm.code || `CUS-${String(customerCount + 1).padStart(4, "0")}` });
      toast.success("Customer added");
      setCustomerOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  if (loading) return (
    <AppShell title="Dashboard">
      <PageContainer>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-muted-foreground">Loading dashboard...</div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );

  return (
    <AppShell title="Dashboard" actions={<div className="flex gap-2">{can("customers", "create") && <Button size="sm" className="rounded-lg" onClick={() => { setCustomerForm({ code: `CUS-${String(customerCount + 1).padStart(4, "0")}`, name: "", mobile: "", whatsapp: "", email: "", address: "", city: "", notes: "" }); setCustomerOpen(true); }}><Plus className="size-3.5 mr-1" />Add Customer</Button>}{can("orders", "view") && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => navigate({ to: "/orders" })}>Check Orders</Button>}</div>}>
      <PageContainer>
        <div className="space-y-5">
          {/* Welcome header */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
              <p className="text-sm text-muted-foreground mt-1">Here's what's happening with your business today.</p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Customers" value={String(customerCount)} tone="primary" onClick={() => navigate({ to: "/customers" })} subtitle={`${orders.length} total orders`} />
            <StatCard icon={ClipboardList} label="Total Orders" value={String(orders.length)} tone="violet" onClick={() => navigate({ to: "/orders" })} subtitle={`${byStatus["pending"] || 0} pending`} />
            <StatCard icon={Wallet} label="Total Revenue" value={currency(totalSales)} tone="emerald" subtitle={`${currency(totalExpenses)} expenses`} />
            <StatCard icon={CreditCard} label="Pending Payments" value={currency(pendingPayments)} tone="rose" onClick={() => navigate({ to: "/payments" })} subtitle={`${orders.filter((o) => o.paid < o.total && o.total > 0).length} orders`} />
          </div>

          {/* Main content grid */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              {/* Revenue vs Expenses chart */}
              <Panel title="Revenue vs Expenses" subtitle="Last 6 months overview">
                {monthly.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                  <div className="p-5 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(v: number) => currency(v)}
                          contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        />
                        <Bar dataKey="revenue" fill="var(--chart-3)" radius={[6, 6, 0, 0]} name="Revenue" />
                        <Bar dataKey="expenses" fill="var(--chart-5)" radius={[6, 6, 0, 0]} name="Expenses" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    <div className="size-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><TrendingDown className="size-5 text-muted-foreground/50" /></div>
                    No revenue or expense data yet
                  </div>
                )}
              </Panel>

              {/* Order Status pie chart */}
              <Panel title="Order Status" subtitle="Current distribution">
                {pieData.length > 0 ? (
                  <div className="p-5 h-72 flex items-center justify-center gap-8">
                    <div className="h-52 w-52 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                            {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-3">
                          <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">{d.name}</div>
                            <div className="text-sm font-bold tabular-nums">{d.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    <div className="size-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><ClipboardList className="size-5 text-muted-foreground/50" /></div>
                    No orders yet
                  </div>
                )}
              </Panel>
            </div>

            <div className="space-y-5">
              {/* Low Stock Alert */}
              {lowStock.length > 0 && (
                <Panel title="Low Stock Alert" subtitle={`${lowStock.length} product${lowStock.length > 1 ? "s" : ""} running low`} action={<Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg" onClick={() => navigate({ to: "/stock-report" })}>View all <ChevronRight className="size-3 ml-0.5" /></Button>}>
                  <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
                    {lowStock.map((item) => (
                      <div key={item.id} className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => navigate({ to: "/stock-report" })}>
                        <div className="flex items-center gap-3">
                          <div className={`size-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${item.currentStock <= 3 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                            {item.currentStock <= 3 ? <AlertTriangle className="size-4" /> : item.currentStock}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{item.name}</div>
                            <div className="text-[11px] text-muted-foreground">{item.supplier || "No supplier"}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-bold tabular-nums ${item.currentStock <= 3 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {item.currentStock} left
                            </div>
                            {item.currentStock <= 3 && <div className="text-[10px] text-rose-500 dark:text-rose-400">Critical</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Recent Orders */}
              <Panel title="Recent Orders" subtitle="Latest activity" action={<Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg" onClick={() => navigate({ to: "/orders" })}>View all <ChevronRight className="size-3 ml-0.5" /></Button>}>
                <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                  {recent.length > 0 ? recent.map((o) => {
                    const initials = o.customerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div key={o.id} className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => navigate({ to: "/orders" })}>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">{initials}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{o.customerName}</div>
                            <div className="text-[11px] text-muted-foreground">{o.number} &middot; {dateShort(o.orderDate)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold tabular-nums">{currency(o.total)}</div>
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${statusColor[o.status]}`}>{statusLabel(o.status)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                      <div className="size-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><ClipboardList className="size-5 text-muted-foreground/50" /></div>
                      No orders yet
                    </div>
                  )}
                </div>
              </Panel>

              {/* Quick Stats */}
              <Panel title="Quick Stats" subtitle="At a glance">
                <div className="p-5 space-y-1">
                  <QuickStatRow icon={Receipt} label="Today's expenses" value={currency(dailyExpenses)} />
                  <QuickStatRow icon={TrendingDown} label="Total expenses" value={currency(totalExpenses)} />
                  <QuickStatRow icon={Factory} label="In production" value={String(byStatus["in_production"] || 0)} />
                  <QuickStatRow icon={Truck} label="Ready for delivery" value={String(byStatus["ready"] || 0)} />
                  <QuickStatRow icon={PackageCheck} label="Delivered" value={String(byStatus["delivered"] || 0)} />
                  {lowStock.length > 0 && <QuickStatRow icon={AlertTriangle} label="Low stock items" value={String(lowStock.length)} warn />}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </PageContainer>

      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="size-4 text-primary" /></div>
              Quick Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs font-medium">Name *</Label><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className="h-9 rounded-lg" placeholder="Customer name" /></div>
            <div><Label className="text-xs font-medium">Mobile *</Label><Input value={customerForm.mobile} onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} className="h-9 rounded-lg" placeholder="Phone number" /></div>
            <div><Label className="text-xs font-medium">City</Label><Input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} className="h-9 rounded-lg" placeholder="City" /></div>
            <div><Label className="text-xs font-medium">Email</Label><Input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className="h-9 rounded-lg" placeholder="Email address" /></div>
            <div className="sm:col-span-2"><Label className="text-xs font-medium">Address</Label><Input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} className="h-9 rounded-lg" placeholder="Full address" /></div>
            <div className="sm:col-span-2"><Label className="text-xs font-medium">Notes</Label><Textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={2} className="rounded-lg" placeholder="Optional notes" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCustomerOpen(false)}>Cancel</Button>
            <Button size="sm" className="rounded-lg" onClick={saveCustomer}>Save customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function QuickStatRow({ icon: Icon, label, value, warn }: { icon: LucideIcon; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-2 rounded-lg ${warn ? "bg-amber-500/5" : "hover:bg-muted/40"} transition-colors`}>
      <span className={`text-sm flex items-center gap-2.5 ${warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
        <Icon className="size-4" />
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</span>
    </div>
  );
}
