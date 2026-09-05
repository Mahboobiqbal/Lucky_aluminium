import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CalendarDays, CalendarRange, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { TableActions } from "@/components/layout/TableActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency, dateShort } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Lucky Aluminium" }] }),
  component: ExpensesPage,
});

type Expense = { id: number; category: string; amount: number; date: string; description?: string; createdBy?: string; createdAt: string };
type ExpenseLine = { description: string; amount: number };

function ExpensesPage() {
  const { can } = useAuth();
  const [list, setList] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState(Date.now());
  const [lines, setLines] = useState<ExpenseLine[]>([{ description: "", amount: 0 }]);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.safeGet<Expense[]>("/api/expenses");
      setList(data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = list.reduce((s, e) => s + e.amount, 0);
  const daily = useMemo(() => list.filter((e) => new Date(e.date).toISOString().slice(0, 10) === selectedDate), [list, selectedDate]);
  const monthly = useMemo(() => list.filter((e) => new Date(e.date).toISOString().slice(0, 7) === selectedMonth), [list, selectedMonth]);

  const save = async () => {
    if (!category.trim()) return toast.error("Enter a category");
    const valid = lines.filter((l) => l.amount > 0);
    if (!valid.length) return toast.error("Add at least one expense item with an amount");
    try {
      for (const line of valid) {
        await api.post("/api/expenses", { category: category.trim(), amount: line.amount, date: new Date(expenseDate).toISOString(), description: line.description || null });
      }
      toast.success(`${valid.length} expense${valid.length === 1 ? "" : "s"} recorded`);
      setOpen(false);
      setCategory("");
      setExpenseDate(Date.now());
      setLines([{ description: "", amount: 0 }]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/expenses/${id}`);
      toast.success("Expense deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const ExpenseTable = ({ rows }: { rows: Expense[] }) => (
    <TableShell>
      <table className="data-table">
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th className="text-center whitespace-nowrap">Actions</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="text-muted-foreground">{dateShort(e.date)}</td>
              <td>{e.category}</td>
              <td className="text-muted-foreground">{e.description || "-"}</td>
              <td className="tabular-nums">{currency(e.amount)}</td>
              <td>{can("expenses", "delete") && <TableActions><button onClick={() => setDeleteTarget(e.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center"><Trash2 className="size-3.5" /></button></TableActions>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState icon={Receipt} title={loading ? "Loading..." : "No expenses recorded"} hint={loading ? "Please wait" : "Add your first expense to get started"} />}
    </TableShell>
  );

  return (
    <AppShell title="Expenses" actions={
      can("expenses", "create") ? <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}><Plus className="size-3.5 mr-1" />New expense</Button> : undefined
    }>
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total expenses</div><div className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{currency(total)}</div></div>
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Selected day</div><div className="text-xl font-semibold tabular-nums">{currency(daily.reduce((s, e) => s + e.amount, 0))}</div></div>
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Selected month</div><div className="text-xl font-semibold tabular-nums">{currency(monthly.reduce((s, e) => s + e.amount, 0))}</div></div>
        </div>
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily"><CalendarDays className="size-3.5 mr-2" />Daily calendar</TabsTrigger>
            <TabsTrigger value="monthly"><CalendarRange className="size-3.5 mr-2" />Monthly</TabsTrigger>
            <TabsTrigger value="all">All expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="space-y-4">
            <div><Label className="text-xs">Select day</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-8 w-44" /></div>
            <ExpenseTable rows={daily} />
          </TabsContent>
          <TabsContent value="monthly" className="space-y-4">
            <div><Label className="text-xs">Select month</Label><Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-8 w-44" /></div>
            <ExpenseTable rows={monthly} />
          </TabsContent>
          <TabsContent value="all"><ExpenseTable rows={list} /></TabsContent>
        </Tabs>
      </PageContainer>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setCategory(""); setExpenseDate(Date.now()); setLines([{ description: "", amount: 0 }]); } setOpen(v); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Category *</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-8" placeholder="e.g. Rent, Electricity" /></div>
              <div><DateField label="Date" value={expenseDate} onChange={setExpenseDate} /></div>
            </div>
            <div className="border border-border rounded-md overflow-visible">
              <div className="px-3 py-2 bg-muted/60 text-sm font-semibold">Expense items</div>
              <div className="divide-y divide-border">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 p-3 items-end">
                    <div><Label className="text-xs">Description</Label><Input value={line.description} onChange={(e) => { const next = [...lines]; next[index] = { ...next[index], description: e.target.value }; setLines(next); }} className="h-8" placeholder="What is this for?" /></div>
                    <div><Label className="text-xs">Amount</Label><Input type="number" value={line.amount || ""} onChange={(e) => { const next = [...lines]; next[index] = { ...next[index], amount: Number(e.target.value) }; setLines(next); }} className="h-8 w-28" placeholder="0" /></div>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => setLines(lines.filter((_, i) => i !== index))} disabled={lines.length === 1}><Trash2 className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border"><Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: "", amount: 0 }])}><Plus className="size-3.5 mr-1" />Add item</Button></div>
            </div>
            <div className="text-right text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{currency(lines.reduce((s, l) => s + (l.amount || 0), 0))}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete expense?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget != null) { remove(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
