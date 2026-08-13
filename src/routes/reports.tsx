import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Download } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currency, dateShort } from "@/lib/format";
import { companyFromSettings, printReport, reportRowsForInventory } from "@/lib/print";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports - UDYANA" }] }),
  component: ReportsPage,
});

const REPORTS = ["Daily sale report", "Monthly sale report", "Stock report", "Profit loss report", "Top selling product", "Customer credit report", "Roznamcha"] as const;
type ReportName = (typeof REPORTS)[number];

type Order = { id: number; number: string; customerName: string; orderDate: string; items: { productName: string; quantity: number; amount: number }[]; total: number; paid: number; status: string };
type Expense = { id: number; category: string; amount: number; date: string; description?: string };
type Setting = { key: string; value: string };
type InventoryItem = { id: number; name: string; category: string; unit: string; currentStock: number; minStock: number; costPrice: number };

function ReportsPage() {
  const { can } = useAuth();
  const [report, setReport] = useState<ReportName>("Daily sale report");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const company = companyFromSettings(settings);

  const fetchData = useCallback(async () => {
    try {
      const [o, e, s, inv] = await Promise.all([
        api.safeGet<Order[]>("/api/orders"), api.safeGet<Expense[]>("/api/expenses"),
        api.safeGet<Setting[]>("/api/settings"), api.safeGet<InventoryItem[]>("/api/inventory"),
      ]);
      setOrders(o || []); setExpenses(e || []); setSettings(s || []); setInventory(inv || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dailyOrders = useMemo(() => orders.filter((o) => new Date(o.orderDate).toISOString().slice(0, 10) === date), [orders, date]);
  const monthlyOrders = useMemo(() => orders.filter((o) => new Date(o.orderDate).toISOString().slice(0, 7) === month), [orders, month]);

  const orderRows = (list: Order[]) => [
    ["Order #", "Customer", "Date", "Total", "Paid", "Balance"],
    ...list.map((o) => [o.number, o.customerName, dateShort(o.orderDate), currency(o.total), currency(o.paid), currency(o.total - o.paid)]),
  ];

  const profitLossRows = () => {
    const sales = orders.reduce((s, o) => s + o.total, 0);
    const paid = orders.reduce((s, o) => s + o.paid, 0);
    const exp = expenses.reduce((s, e) => s + e.amount, 0);
    return [["Metric", "Amount"], ["Sales", currency(sales)], ["Payments received", currency(paid)], ["Expenses", currency(exp)], ["Profit / Loss", currency(sales - exp)]];
  };

  const topProductRows = () => {
    const map: Record<string, { qty: number; amount: number }> = {};
    orders.forEach((o) => o.items.forEach((it) => { if (!map[it.productName]) map[it.productName] = { qty: 0, amount: 0 }; map[it.productName].qty += it.quantity; map[it.productName].amount += it.amount; }));
    const sorted = Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
    return [["Product", "Qty Sold", "Revenue"], ...sorted.map(([name, v]) => [name, String(v.qty), currency(v.amount)])];
  };

  const getRows = () => {
    switch (report) {
      case "Daily sale report": return orderRows(dailyOrders);
      case "Monthly sale report": return orderRows(monthlyOrders);
      case "Stock report": return reportRowsForInventory(inventory as any);
      case "Profit loss report": return profitLossRows();
      case "Top selling product": return topProductRows();
      case "Customer credit report": return orderRows(orders.filter((o) => o.total > o.paid));
      case "Roznamcha": return orderRows(orders);
      default: return [];
    }
  };

  const rows = getRows();
  const labels: Record<ReportName, string> = {
    "Daily sale report": `Daily Sales — ${date}`,
    "Monthly sale report": `Monthly Sales — ${month}`,
    "Stock report": "Stock Report",
    "Profit loss report": "Profit & Loss",
    "Top selling product": "Top Selling Products",
    "Customer credit report": "Customer Credits",
    "Roznamcha": "Roznamcha (Full Ledger)",
  };

  if (loading) return <AppShell title="Reports"><PageContainer><div className="text-center py-12 text-muted-foreground">Loading...</div></PageContainer></AppShell>;

  return (
    <AppShell title="Reports">
      <PageContainer>
        <div className="max-w-4xl space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs">Report</Label><Select value={report} onValueChange={(v) => setReport(v as ReportName)}><SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            {(report === "Daily sale report" || report === "Roznamcha") && <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" /></div>}
            {report === "Monthly sale report" && <div><Label className="text-xs">Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-44" /></div>}
            {can("reports", "export") && rows.length > 1 && <Button variant="outline" size="sm" className="h-9" onClick={() => printReport(labels[report], rows, company)}><Download className="size-3.5 mr-1" />Export PDF</Button>}
          </div>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">{labels[report]}</div>
            {rows.length > 1 ? (
              <div className="overflow-x-auto">
                <table className="data-table text-sm">
                  <thead><tr>{rows[0].map((h, i) => <th key={i} className={i >= 3 ? "text-right" : ""}>{h}</th>)}</tr></thead>
                  <tbody>{rows.slice(1).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={ci >= 3 ? "text-right tabular-nums" : ""}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No data available</div>
            )}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
