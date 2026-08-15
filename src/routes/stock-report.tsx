import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { currency } from "@/lib/format";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Boxes, Package, Search, TrendingDown, Warehouse } from "lucide-react";

export const Route = createFileRoute("/stock-report")({
  head: () => ({ meta: [{ title: "Stock Report — UDYANA" }] }),
  component: StockReportPage,
});

type InventoryItem = {
  id: number; name: string; category: string; unit: string; itemType: string; pricingMode?: string;
  currentStock: number; minStock: number; costPrice: number;
  supplier?: string; widthFt?: number; heightFt?: number; length?: number; stockQty?: number;
  createdAt: string;
};

function StockReportPage() {
  const [list, setList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const data = await api.safeGet<InventoryItem[]>("/api/inventory");
      setList(data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = useMemo(() => {
    const cats = new Set(list.map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(cats).sort()];
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter((item) => {
      const q = search.toLowerCase();
      if (q && ![item.name, item.category, item.supplier ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (typeFilter !== "all" && (item.itemType || "other") !== typeFilter) return false;
      if (statusFilter === "low" && item.currentStock >= item.minStock) return false;
      if (statusFilter === "out" && item.currentStock > 0) return false;
      if (statusFilter === "ok" && item.currentStock < item.minStock) return false;
      return true;
    });
  }, [list, search, categoryFilter, typeFilter, statusFilter]);

  const totalItems = list.length;
  const totalStockValue = list.reduce((s, i) => s + i.currentStock * i.costPrice, 0);
  const lowStockCount = list.filter((i) => i.currentStock < i.minStock && i.currentStock > 0).length;
  const outOfStockCount = list.filter((i) => i.currentStock === 0).length;
  const totalUnits = list.reduce((s, i) => s + (i.stockQty ?? 0), 0);

  const unitOf = (item: InventoryItem) => {
    if ((item.pricingMode || "piece") === "size") return (item.itemType || "other") === "window" ? "ft" : "sqft";
    return "pcs";
  };

  return (
    <AppShell title="Stock Report">
      <PageContainer>
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryCard icon={Package} label="Total Items" value={String(totalItems)} tone="primary" />
            <SummaryCard icon={Warehouse} label="Total Units" value={String(totalUnits)} tone="blue" />
            <SummaryCard icon={Boxes} label="Stock Value" value={currency(totalStockValue)} tone="emerald" />
            <SummaryCard icon={AlertTriangle} label="Low Stock" value={String(lowStockCount)} tone="amber" />
            <SummaryCard icon={TrendingDown} label="Out of Stock" value={String(outOfStockCount)} tone="rose" />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, category, supplier..." className="h-9 pl-8 rounded-lg" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-40 rounded-lg"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-36 rounded-lg"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="window">Window</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ok">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">#</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>Unit</th>
                  <th className="text-right">Dimension</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Min Stock</th>
                  <th className="text-right">Cost Price</th>
                  <th className="text-right">Stock Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const low = item.currentStock > 0 && item.currentStock < item.minStock;
                  const out = item.currentStock === 0;
                  const value = item.currentStock * item.costPrice;
                  const isWindow = (item.itemType || "other") === "window";
                  const dimension = isWindow
                    ? `${item.length || 0} ft`
                    : (item.widthFt || item.heightFt) ? `${item.widthFt ?? 0} × ${item.heightFt ?? 0} ft` : "-";
                  return (
                    <tr key={item.id} className={out ? "bg-rose-500/5" : low ? "bg-amber-500/5" : ""}>
                      <td className="text-center text-muted-foreground">{idx + 1}</td>
                      <td className="font-medium">{item.name}</td>
                      <td><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${isWindow ? "bg-violet-500/10 text-violet-600 border-violet-500/30" : "bg-slate-500/10 text-slate-600 border-slate-500/30"}`}>{isWindow ? "Window" : "Other"}</span></td>
                      <td>{item.category || "-"}</td>
                      <td className="text-muted-foreground">{item.supplier || "-"}</td>
                      <td>{item.unit}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{dimension}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{item.stockQty ?? 0}</td>
                      <td className={`text-right tabular-nums font-semibold ${out ? "text-rose-600 dark:text-rose-400" : low ? "text-amber-600 dark:text-amber-400" : ""}`}>{item.currentStock} <span className="text-[10px] font-normal text-muted-foreground">{unitOf(item)}</span></td>
                      <td className="text-right tabular-nums text-muted-foreground">{item.minStock}</td>
                      <td className="text-right tabular-nums">{currency(item.costPrice)}<span className="text-[10px] text-muted-foreground">/{unitOf(item)}</span></td>
                      <td className="text-right tabular-nums font-medium">{currency(value)}</td>
                      <td>
                        {out ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border bg-rose-500/15 text-rose-600 border-rose-500/30">
                            <TrendingDown className="size-3" />Out
                          </span>
                        ) : low ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border bg-amber-500/15 text-amber-600 border-amber-500/30">
                            <AlertTriangle className="size-3" />Low
                          </span>
                        ) : (
                          <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] border bg-emerald-500/15 text-emerald-600 border-emerald-500/30">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={13} className="text-center py-12 text-muted-foreground">{loading ? "Loading..." : "No items found"}</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Footer summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {filtered.length} of {totalItems} items</span>
            <span>Total value: <span className="font-bold text-foreground">{currency(filtered.reduce((s, i) => s + i.currentStock * i.costPrice, 0))}</span></span>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Package; label: string; value: string; tone: "primary" | "emerald" | "amber" | "rose" | "blue" }) {
  const tones = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
  };
  const t = tones[tone];
  return (
    <div className={`bg-card border border-border border-l-[3px] ${t.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums truncate">{value}</div>
        </div>
        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
