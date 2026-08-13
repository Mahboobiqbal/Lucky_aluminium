import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";
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
import { Users, ClipboardList, Clock, Factory, PackageCheck, Truck, Wallet, TrendingDown, AlertTriangle, ArrowUpRight, Plus, Receipt, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — UDYANA" }] }),
  component: Dashboard,
});

type Order = { id: number; number: string; customerId: number; customerName: string; orderDate: string; items: any[]; total: number; paid: number; status: string; createdAt: string };
type Expense = { id: number; category: string; amount: number; date: string };
type InventoryItem = { id: number; name: string; currentStock: number; minStock: number };
type Setting = { key: string; value: string };

function Stat({ icon: Icon, label, value, tone = "primary", onClick }: { icon: LucideIcon; label: string; value: string; tone?: string; onClick?: () => void }) {
  const tones: Record<string, { cls: string; accent: string }> = {
    primary: { cls: "text-primary bg-primary/10", accent: "var(--color-primary)" },
    emerald: { cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", accent: "oklch(0.7 0.17 145)" },
    amber: { cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10", accent: "oklch(0.75 0.17 60)" },
    violet: { cls: "text-violet-600 dark:text-violet-400 bg-violet-500/10", accent: "oklch(0.55 0.18 268)" },
    rose: { cls: "text-rose-600 dark:text-rose-400 bg-rose-500/10", accent: "oklch(0.65 0.22 15)" },
    blue: { cls: "text-blue-600 dark:text-blue-400 bg-blue-500/10", accent: "oklch(0.65 0.16 195)" },
  };
  const t = tones[tone] ?? tones.primary;
  const interactive = Boolean(onClick);
  return (
    <div className={`stat-card flex items-center gap-3.5 ${interactive ? "stat-card--clickable" : ""}`} style={interactive ? ({ "--stat-accent": t.accent } as CSSProperties) : undefined} onClick={onClick} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}>
      <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${t.cls}`}><Icon className="size-5" /></div>
      <div className="min-w-0 flex-1"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-xl font-semibold tabular-nums truncate leading-tight">{value}</div></div>
      {interactive && <ArrowUpRight className="size-4 text-muted-foreground/40 shrink-0 self-start mt-1" />}
    </div>
  );
}

function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col ${className ?? ""}`}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-sm font-semibold leading-tight">{title}</div>{subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}</div>{action}</div>
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
  const lowStock = inventory.filter((i) => i.currentStock < i.minStock);

  const monthly = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleString("en-IN", { month: "short" });
    const rev = orders.filter((o) => new Date(o.orderDate).getMonth() === d.getMonth() && new Date(o.orderDate).getFullYear() === d.getFullYear()).reduce((s, o) => s + o.total, 0);
    const exp = expenses.filter((e) => new Date(e.date).getMonth() === d.getMonth() && new Date(e.date).getFullYear() === d.getFullYear()).reduce((s, e) => s + e.amount, 0);
    return { label, revenue: rev, expenses: exp };
  });

  const pieData = Object.entries(byStatus).map(([k, v]) => ({ name: statusLabel(k), value: v }));
  const pieColors = ["hsl(268 60% 55%)", "hsl(195 65% 50%)", "hsl(145 55% 45%)", "hsl(45 90% 55%)", "hsl(15 75% 55%)", "hsl(0 70% 55%)"];
  const recent = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  const saveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.mobile.trim()) return toast.error("Name and mobile required");
    try {
      await api.post("/api/customers", { ...customerForm, code: customerForm.code || `CUS-${String(customerCount + 1).padStart(4, "0")}` });
      toast.success("Customer added");
      setCustomerOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  if (loading) return <AppShell title="Dashboard"><PageContainer><div className="text-center py-12 text-muted-foreground">Loading dashboard...</div></PageContainer></AppShell>;

  return (
    <AppShell title="Dashboard" actions={<div className="flex gap-2">{can("customers", "create") && <Button size="sm" onClick={() => { setCustomerForm({ code: `CUS-${String(customerCount + 1).padStart(4, "0")}`, name: "", mobile: "", whatsapp: "", email: "", address: "", city: "", notes: "" }); setCustomerOpen(true); }}><Plus className="size-3.5 mr-1" />Add Customer</Button>}{can("orders", "view") && <Button size="sm" variant="outline" onClick={() => navigate({ to: "/orders" })}>Check Orders</Button>}</div>}>
      <PageContainer>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Users} label="Customers" value={String(customerCount)} tone="primary" onClick={() => navigate({ to: "/customers" })} />
            <Stat icon={ClipboardList} label="Total Orders" value={String(orders.length)} tone="violet" onClick={() => navigate({ to: "/orders" })} />
            <Stat icon={Wallet} label="Total Revenue" value={currency(totalSales)} tone="emerald" />
            <Stat icon={TrendingDown} label="Pending" value={currency(pendingPayments)} tone="rose" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Panel title="Revenue vs Expenses" subtitle="Last 6 months">
                {monthly.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                  <div className="p-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} />
                        <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => currency(v)} />
                        <Bar dataKey="revenue" fill="hsl(145 55% 45%)" radius={[4, 4, 0, 0]} name="Revenue" />
                        <Bar dataKey="expenses" fill="hsl(15 75% 55%)" radius={[4, 4, 0, 0]} name="Expenses" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="p-8 text-center text-sm text-muted-foreground">No data yet</div>}
              </Panel>

              <Panel title="Order Status" subtitle="Current distribution">
                {pieData.length > 0 ? (
                  <div className="p-4 h-64 flex items-center justify-center gap-6">
                    <div className="h-48 w-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">{pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}</Pie><Tooltip /></PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">{pieData.map((d, i) => <div key={d.name} className="flex items-center gap-2 text-xs"><div className="size-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} /><span className="text-muted-foreground">{d.name}</span><span className="font-semibold">{d.value}</span></div>)}</div>
                  </div>
                ) : <div className="p-8 text-center text-sm text-muted-foreground">No orders yet</div>}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel title="Recent Orders" subtitle="Latest activity">
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {recent.length > 0 ? recent.map((o) => (
                    <div key={o.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="font-medium text-sm truncate">{o.customerName}</div><div className="text-[11px] text-muted-foreground">{o.number} · {dateShort(o.orderDate)}</div></div><div className="text-right shrink-0"><div className="text-sm font-semibold tabular-nums">{currency(o.total)}</div><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${statusColor[o.status]}`}>{statusLabel(o.status)}</span></div></div>
                    </div>
                  )) : <div className="p-6 text-center text-sm text-muted-foreground">No orders yet</div>}
                </div>
              </Panel>

              <Panel title="Quick Stats">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><Receipt className="size-3.5" />Today's expenses</span><span className="font-semibold tabular-nums">{currency(dailyExpenses)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><TrendingDown className="size-3.5" />Total expenses</span><span className="font-semibold tabular-nums">{currency(totalExpenses)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><Factory className="size-3.5" />In production</span><span className="font-semibold">{byStatus["in_production"] || 0}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><Truck className="size-3.5" />Ready for delivery</span><span className="font-semibold">{byStatus["ready"] || 0}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><PackageCheck className="size-3.5" />Delivered</span><span className="font-semibold">{byStatus["delivered"] || 0}</span></div>
                  {lowStock.length > 0 && <div className="flex items-center justify-between text-sm"><span className="text-amber-600 flex items-center gap-2"><AlertTriangle className="size-3.5" />Low stock items</span><span className="font-semibold text-amber-600">{lowStock.length}</span></div>}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </PageContainer>

      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Quick Add Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Mobile *</Label><Input value={customerForm.mobile} onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">City</Label><Input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Email</Label><Input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setCustomerOpen(false)}>Cancel</Button><Button size="sm" onClick={saveCustomer}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
