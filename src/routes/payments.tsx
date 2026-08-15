import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Banknote, CalendarDays, CalendarRange, CheckCircle2, CreditCard, FileText, Receipt, Search, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { currency, dateShort } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { companyFromSettings } from "@/lib/print";
import { createDailyPaymentStatementPdf, createMonthlyPaymentStatementPdf, createAllPaymentsStatementPdf } from "@/lib/pdf";
import { PaymentTable, type PaymentRow } from "@/components/payments/PaymentTable";
import { DateField } from "@/components/ui/DateField";
import { PDFExporter } from "@/components/payments/PDFExporter";
import { PRESET_LABELS, rangeFromCustom, resolvePresetRange, type DateRange, type DateRangePreset } from "@/components/payments/paymentFilterUtils";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments - UDYANA" }] }),
  component: PaymentsPage,
});

type Order = {
  id: number; number: string; customerId: number; customerName: string;
  orderDate: string; items: any[]; total: number; paid: number; status: string; notes?: string; createdAt: string;
};

type Payment = {
  id: number; orderId?: number; customerId?: number; customerName?: string;
  amount: number; method: string; date: string; notes?: string; createdAt: string;
};

type Setting = { key: string; value: string };

function inputDateStr(ts: number | string) {
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateFromInput(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function sameDay(dateStr: string, yyyyMmDd: string) {
  return inputDateStr(dateStr) === yyyyMmDd;
}

function sameMonth(dateStr: string, month: string, year: string) {
  const d = new Date(dateStr);
  return String(d.getMonth() + 1).padStart(2, "0") === month && String(d.getFullYear()) === year;
}

function pendingBalance(order: Order) {
  return Math.max(0, order.total - order.paid);
}

function monthLabel(month: string, year: string) {
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "long" });
}

function matchesSearch(row: PaymentRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.number, row.referenceNumber, row.customerName, row.method ?? "", row.notes ?? ""].some((v) => v.toLowerCase().includes(q));
}

function withinRange(row: PaymentRow, range: DateRange) {
  return row.orderDate >= range.start && row.orderDate <= range.end;
}

function toPaymentRows(orders: Order[], payments: Payment[]): PaymentRow[] {
  return orders.flatMap((order) => {
    if (order.paid <= 0) return [];
    const recordedPayments = payments
      .filter((p) => p.orderId === order.id && p.amount > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recordedTotal = recordedPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingPaid = Math.max(0, order.paid - recordedTotal);
    const entries: Array<{ id: string; date: number; amount: number; method: string; referenceNumber: string; notes?: string }> = [];
    if (openingPaid > 0) {
      entries.push({ id: `order-${order.id}-opening`, date: new Date(order.orderDate).getTime(), amount: openingPaid, method: "Opening Payment", referenceNumber: `PAY-${String(order.id).padStart(4, "0")}`, notes: order.notes });
    }
    recordedPayments.forEach((p) => {
      entries.push({ id: `payment-${p.id}`, date: new Date(p.date).getTime(), amount: p.amount, method: p.method || "Payment", referenceNumber: `RCPT-${String(p.id).padStart(4, "0")}`, notes: p.notes });
    });
    let runningPaid = 0;
    return entries.map((entry) => {
      runningPaid += entry.amount;
      return { id: entry.id, number: order.number, referenceNumber: entry.referenceNumber, customerName: order.customerName, orderDate: entry.date, paid: entry.amount, balance: Math.max(0, order.total - runningPaid), method: entry.method, notes: entry.notes };
    });
  }).sort((a, b) => b.orderDate - a.orderDate || b.referenceNumber.localeCompare(a.referenceNumber));
}

function toStatementRows(rows: PaymentRow[]) {
  return rows.map((row) => ({ date: row.orderDate, invoiceNumber: row.number, customerName: row.customerName, paymentMethod: row.method || "Payment", amountPaid: row.paid, remainingBalance: row.balance, notes: row.notes }));
}

function StatTile({ label, value, tone, icon: Icon }: { label: string; value: string; tone?: "emerald" | "rose" | "amber" | "slate"; icon: typeof Banknote }) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    slate: "bg-primary/10 text-primary",
  };
  const accents = {
    emerald: "border-l-emerald-500",
    rose: "border-l-rose-500",
    amber: "border-l-amber-500",
    slate: "border-l-primary",
  };
  return (
    <div className={`bg-card border border-border border-l-[3px] ${accents[tone || "slate"]} rounded-lg p-4 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        </div>
        <div className={`size-10 rounded-lg flex items-center justify-center ${tones[tone || "slate"]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function PaymentsPage() {
  const { can } = useAuth();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(inputDateStr(Date.now()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(inputDateStr(Date.now()));
  const [paymentNotes, setPaymentNotes] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const company = companyFromSettings(settings);

  const fetchData = useCallback(async () => {
    try {
      const [o, p, s] = await Promise.all([
        api.safeGet<Order[]>("/api/orders"),
        api.safeGet<Payment[]>("/api/payments"),
        api.safeGet<Setting[]>("/api/settings"),
      ]);
      setOrders(o || []);
      setPayments(p || []);
      setSettings(s || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allRows = useMemo(() => toPaymentRows(orders, payments), [orders, payments]);
  const totalPaid = allRows.reduce((sum, row) => sum + row.paid, 0);
  const totalDue = orders.reduce((sum, order) => sum + pendingBalance(order), 0);
  const paidOrderCount = orders.filter((order) => order.paid >= order.total && order.total > 0).length;

  const range: DateRange = useMemo(() => preset === "custom" ? rangeFromCustom(customStart, customEnd) : resolvePresetRange(preset), [preset, customStart, customEnd]);
  const searchedRows = useMemo(() => allRows.filter((row) => matchesSearch(row, search)), [allRows, search]);
  const dailyRows = useMemo(() => searchedRows.filter((row) => sameDay(new Date(row.orderDate).toISOString(), selectedDate)), [searchedRows, selectedDate]);
  const monthlyRows = useMemo(() => searchedRows.filter((row) => sameMonth(new Date(row.orderDate).toISOString(), selectedMonth, selectedYear)), [searchedRows, selectedMonth, selectedYear]);
  const filteredRows = useMemo(() => searchedRows.filter((row) => withinRange(row, range)), [searchedRows, range]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => pendingBalance(order) > 0).filter((order) => {
      const q = pendingSearch.trim().toLowerCase();
      if (!q) return true;
      return [order.customerName, order.number, order.notes ?? ""].some((v) => v.toLowerCase().includes(q));
    }).sort((a, b) => pendingBalance(b) - pendingBalance(a) || new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
    [orders, pendingSearch],
  );
  const pendingTotal = pendingOrders.reduce((sum, order) => sum + pendingBalance(order), 0);

  const dailyTotals = useMemo(() => ({ totalPaymentsReceived: dailyRows.reduce((sum, r) => sum + r.paid, 0), outstandingAmount: dailyRows.reduce((sum, r) => sum + r.balance, 0), numberOfTransactions: dailyRows.length }), [dailyRows]);
  const monthlyTotals = useMemo(() => ({ totalPaymentsReceived: monthlyRows.reduce((sum, r) => sum + r.paid, 0), outstandingAmount: monthlyRows.reduce((sum, r) => sum + r.balance, 0), numberOfTransactions: monthlyRows.length }), [monthlyRows]);
  const allTotals = useMemo(() => ({ totalPaymentsReceived: filteredRows.reduce((sum, r) => sum + r.paid, 0), outstandingAmount: filteredRows.reduce((sum, r) => sum + r.balance, 0), numberOfTransactions: filteredRows.length }), [filteredRows]);

  const buildDaily = () => createDailyPaymentStatementPdf({ ...dailyTotals, rows: toStatementRows(dailyRows) }, company, new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }));
  const buildMonthly = () => createMonthlyPaymentStatementPdf({ ...monthlyTotals, rows: toStatementRows(monthlyRows) }, company, monthLabel(selectedMonth, selectedYear), selectedYear);
  const buildAll = () => createAllPaymentsStatementPdf({ ...allTotals, rows: toStatementRows(filteredRows) }, company);

  const openPayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentAmount(pendingBalance(order));
    setPaymentMethod("Cash");
    setPaymentDate(inputDateStr(Date.now()));
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!selectedOrder?.id) return;
    const balance = pendingBalance(selectedOrder);
    if (!paymentAmount || paymentAmount <= 0) return toast.error("Payment amount required");
    if (paymentAmount > balance) return toast.error("Payment cannot be more than the balance");
    try {
      await api.post("/api/payments", {
        orderId: selectedOrder.id,
        customerId: selectedOrder.customerId,
        customerName: selectedOrder.customerName,
        amount: paymentAmount,
        method: paymentMethod,
        date: dateFromInput(paymentDate),
        notes: paymentNotes,
      });
      toast.success("Payment recorded");
      setPaymentOpen(false);
      setSelectedOrder(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const selectedBalance = selectedOrder ? pendingBalance(selectedOrder) : 0;
  const selectedRemaining = Math.max(0, selectedBalance - paymentAmount);

  return (
    <AppShell title="Payments">
      <PageContainer>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total Received" value={currency(totalPaid)} tone="emerald" icon={Banknote} />
            <StatTile label="Outstanding" value={currency(totalDue)} tone="rose" icon={WalletCards} />
            <StatTile label="Pending Orders" value={String(pendingOrders.length)} tone="amber" icon={Receipt} />
            <StatTile label="Fully Paid" value={String(paidOrderCount)} tone="slate" icon={CheckCircle2} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="size-4 text-primary" /></div>
                      Statement History
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Review received payments by day, month, or custom range.</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, order, receipt..." className="h-9 pl-8 rounded-lg" />
                  </div>
                </div>
              </div>

              <Tabs defaultValue="daily" className="w-full">
                <div className="px-5 pt-4">
                  <TabsList className="grid w-full grid-cols-3 lg:w-[480px] h-10 rounded-lg">
                    <TabsTrigger value="daily" className="rounded-md text-xs"><CalendarDays className="size-3.5 mr-1.5" />Daily</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-md text-xs"><CalendarRange className="size-3.5 mr-1.5" />Monthly</TabsTrigger>
                    <TabsTrigger value="all" className="rounded-md text-xs"><Receipt className="size-3.5 mr-1.5" />All</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="daily" className="p-5 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap items-end gap-3">
                      <div><Label className="text-xs font-medium">Payment date</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-9 w-44 rounded-lg" /></div>
                      <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Received</div><div className="text-sm font-bold tabular-nums text-emerald-600">{currency(dailyTotals.totalPaymentsReceived)}</div></div>
                      <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</div><div className="text-sm font-bold tabular-nums">{dailyTotals.numberOfTransactions}</div></div>
                    </div>
                    {can("payments", "export") && <PDFExporter build={buildDaily} fileName={`daily-payment-statement-${selectedDate}.pdf`} disabled={!dailyRows.length} />}
                  </div>
                  <PaymentTable rows={dailyRows} withNotes emptyLabel="No payments received on this date" />
                </TabsContent>

                <TabsContent value="monthly" className="p-5 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap items-end gap-3">
                      <div><Label className="text-xs font-medium">Month</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="h-9 w-40 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => { const v = String(i + 1).padStart(2, "0"); return <SelectItem key={v} value={v}>{monthLabel(v, selectedYear)}</SelectItem>; })}</SelectContent></Select></div>
                      <div><Label className="text-xs font-medium">Year</Label><Input type="number" min="2000" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="h-9 w-28 rounded-lg" /></div>
                      <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Received</div><div className="text-sm font-bold tabular-nums text-emerald-600">{currency(monthlyTotals.totalPaymentsReceived)}</div></div>
                    </div>
                    {can("payments", "export") && <PDFExporter build={buildMonthly} fileName={`monthly-payment-statement-${selectedYear}-${selectedMonth}.pdf`} disabled={!monthlyRows.length} />}
                  </div>
                  <PaymentTable rows={monthlyRows} emptyLabel="No payments found for this month" />
                </TabsContent>

                <TabsContent value="all" className="p-5 space-y-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex flex-wrap items-end gap-3">
                      <div><Label className="text-xs font-medium">Range</Label><Select value={preset} onValueChange={(v) => setPreset(v as DateRangePreset)}><SelectTrigger className="h-9 w-44 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((k) => <SelectItem key={k} value={k}>{PRESET_LABELS[k]}</SelectItem>)}</SelectContent></Select></div>
                      {preset === "custom" && (<><div><Label className="text-xs font-medium">From</Label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9 w-40 rounded-lg" /></div><div><Label className="text-xs font-medium">To</Label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9 w-40 rounded-lg" /></div></>)}
                      <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Filtered total</div><div className="text-sm font-bold tabular-nums text-emerald-600">{currency(allTotals.totalPaymentsReceived)}</div></div>
                    </div>
                    {can("payments", "export") && <PDFExporter build={buildAll} fileName="all-payments-statement.pdf" disabled={!filteredRows.length} />}
                  </div>
                  <PaymentTable rows={filteredRows} emptyLabel="No payments match the selected filters" />
                </TabsContent>
              </Tabs>
            </section>

            <aside className="bg-card border border-border rounded-lg shadow-sm overflow-hidden xl:sticky xl:top-4 xl:self-start">
              <div className="p-5 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><WalletCards className="size-4 text-amber-600 dark:text-amber-400" /></div>
                      Collection Queue
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Click a customer to receive their balance.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Due</div>
                    <div className="text-lg font-bold tabular-nums text-rose-600">{currency(pendingTotal)}</div>
                  </div>
                </div>
                <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search pending customer..." className="h-9 pl-8 rounded-lg" /></div>
              </div>
              <div className="max-h-[68vh] overflow-y-auto">
                {pendingOrders.map((order, idx) => {
                  const balance = pendingBalance(order);
                  const progress = order.total ? Math.min(100, Math.max(0, (order.paid / order.total) * 100)) : 0;
                  const initials = order.customerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <button key={order.id} type="button" onClick={() => can("payments", "create") && openPayment(order)} className="w-full p-4 text-left transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-b border-border last:border-b-0 group">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold truncate text-sm">{order.customerName}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">{order.number} &middot; {dateShort(order.orderDate)}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold tabular-nums text-rose-600">{currency(balance)}</div>
                              <div className="text-[10px] text-muted-foreground">due</div>
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full transition-all ${progress >= 75 ? "bg-emerald-500" : progress >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-muted-foreground font-medium">{Math.round(progress)}% paid</span>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CreditCard className="size-3 text-primary" />
                            <span className="text-[10px] font-medium text-primary">Click to receive payment</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!pendingOrders.length && <div className="p-10 text-center text-sm text-muted-foreground">{loading ? "Loading..." : "All orders fully paid!"}</div>}
              </div>
            </aside>
          </div>
        </div>
      </PageContainer>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center"><CreditCard className="size-4 text-primary" /></div>
              Receive Payment
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-base">{selectedOrder.customerName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{selectedOrder.number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Remaining Balance</div>
                    <div className="text-lg font-bold tabular-nums text-rose-600">{currency(selectedBalance)}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs font-medium">Amount paid</Label><Input type="number" min="1" max={selectedBalance} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="h-10 rounded-lg" /></div>
                <div><DateField label="Payment date" value={new Date(paymentDate).getTime()} onChange={(v) => setPaymentDate(inputDateStr(v))} /></div>
                <div><Label className="text-xs font-medium">Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs font-medium">Remaining balance</Label><div className="h-10 rounded-lg border border-border bg-muted/30 px-3 flex items-center text-sm font-bold tabular-nums">{currency(selectedRemaining)}</div></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setPaymentAmount(selectedBalance)}>Full balance</Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setPaymentAmount(Math.round(selectedBalance / 2))}>Half</Button>
              </div>
              <div><Label className="text-xs font-medium">Notes</Label><Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional note" className="h-10 rounded-lg" /></div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button size="sm" className="rounded-lg" onClick={savePayment}><CreditCard className="size-3.5 mr-1.5" />Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
