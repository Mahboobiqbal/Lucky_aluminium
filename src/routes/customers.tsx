import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, FileText, ShoppingBag, Banknote, WalletCards, CalendarDays, Download, Users, Send } from "lucide-react";
import { toast } from "sonner";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { createPaymentReminderPdf, sharePdf } from "@/lib/pdf";
import { companyFromSettings, printCustomer, printCustomers } from "@/lib/print";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customers — Lucky Aluminium" }] }),
  component: CustomersPage,
});

type Customer = {
  id: number;
  code: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  previousBalance?: number;
  createdAt: string;
};

type Order = {
  id: number;
  number: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  items: any[];
  total: number;
  paid: number;
  status: string;
};

type Setting = { key: string; value: string };

const empty: Omit<Customer, "id" | "createdAt"> = { code: "", name: "", mobile: "", whatsapp: "", email: "", address: "", city: "", notes: "", previousBalance: 0 };

function CustomersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const [list, setList] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const company = companyFromSettings(settings);

  const customerPayments = useMemo(() => {
    const map: Record<number, { total: number; paid: number; balance: number }> = {};
    for (const o of orders) {
      if (!map[o.customerId]) map[o.customerId] = { total: 0, paid: 0, balance: 0 };
      map[o.customerId].total += o.total;
      map[o.customerId].paid += o.paid;
      map[o.customerId].balance += (o as any).balance ?? Math.max(0, o.total - o.paid);
    }
    return map;
  }, [orders]);

  const fetchData = useCallback(async () => {
    try {
      const [custs, ords, sets] = await Promise.all([
        api.safeGet<Customer[]>("/api/customers"),
        api.safeGet<Order[]>("/api/orders"),
        api.safeGet<Setting[]>("/api/settings"),
      ]);
      setList(custs || []);
      setOrders(ords || []);
      setSettings(sets || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter((c) => [c.name, c.code, c.mobile, c.city, c.email].some((v) => v?.toLowerCase().includes(s)));
  }, [list, q]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...empty, code: `CUS-${String(list.length + 1).padStart(4, "0")}` });
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, mobile: c.mobile, whatsapp: c.whatsapp || "", email: c.email || "", address: c.address || "", city: c.city || "", notes: c.notes || "", previousBalance: c.previousBalance ?? 0 });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.mobile.trim()) return toast.error("Name and mobile are required");
    try {
      if (editingId) {
        await api.put(`/api/customers/${editingId}`, { id: editingId, ...form });
        toast.success("Customer updated");
      } else {
        await api.post("/api/customers", form);
        toast.success("Customer added");
      }
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/customers/${id}`);
      toast.success("Customer deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const openDetails = (customer: Customer) => { setSelected(customer); setDetailOpen(true); };

  return (
    <AppShell
      title="Customers"
      actions={
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Search customers..." className="w-64 h-8" />
          <div className="ml-auto flex gap-2">
            {can("customers", "export") && (
              <Button variant="outline" size="sm" onClick={() => printCustomers(filtered as any, company, customerPayments)}><Download className="size-3.5 mr-1" />Export PDF</Button>
            )}
            {can("customers", "create") && (
              <Button size="sm" onClick={openNew}><Plus className="size-3.5 mr-1" />New customer</Button>
            )}
          </div>
        </>
      }
    >
      <PageContainer>
        <TableShell>
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Mobile</th><th>City</th><th>Email</th><th className="text-right whitespace-nowrap">Paid</th><th className="text-right whitespace-nowrap">Remaining Balance</th><th>Added</th><th className="w-24 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((c) => {
                const pmt = customerPayments[c.id];
                const paid = pmt?.paid ?? 0;
                const orderBalance = pmt ? pmt.balance : 0;
                const opening = Number(c.previousBalance ?? 0);
                const balance = orderBalance + opening;
                return (
                  <tr key={c.id}>
                    <td className="font-mono text-xs text-muted-foreground">{c.code}</td>
                    <td><button className="font-medium hover:text-primary" onClick={() => openDetails(c)}>{c.name}</button></td>
                    <td className="tabular-nums">{c.mobile}</td>
                    <td>{c.city || "—"}</td>
                    <td className="text-muted-foreground">{c.email || "—"}</td>
                    <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{pmt ? currency(paid) : "—"}</td>
                    <td className="text-right tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">{balance > 0 ? currency(balance) : "—"}</td>
                    <td className="text-right">
                      <button onClick={() => openDetails(c)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"><Eye className="size-3.5" /></button>
                      {can("customers", "edit") && (
                        <button onClick={() => openEdit(c)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"><Pencil className="size-3.5" /></button>
                      )}
                      {can("customers", "delete") && (
                        <button onClick={() => setDeleteTarget(c.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center"><Trash2 className="size-3.5" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <EmptyState icon={Users} title={loading ? "Loading..." : "No customers found"} hint={loading ? "Please wait" : "Add your first customer to get started"} />}
        </TableShell>
      </PageContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div><Label className="text-xs">Previous Balance (opening carry)</Label><Input type="number" value={form.previousBalance || ""} onChange={(e) => setForm({ ...form, previousBalance: Number(e.target.value) })} className="h-8" placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Customer history</DialogTitle></DialogHeader>
          {selected && (() => {
            const customerOrders = orders.filter((o) => o.customerId === selected.id);
            const pmt = customerPayments[selected.id];
            const orderBalance = pmt ? pmt.balance : 0;
            const openingBalance = Number(selected.previousBalance ?? 0);
            const totalBalance = orderBalance + openingBalance;
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[["Code", selected.code], ["Name", selected.name], ["Mobile", selected.mobile], ["WhatsApp", selected.whatsapp || "-"], ["Email", selected.email || "-"], ["City", selected.city || "-"], ["Added", dateShort(selected.createdAt)]].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-medium mt-1">{value}</div></div>
                  ))}
                  <div className="col-span-2 rounded-md border border-border p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Address</div><div className="font-medium mt-1">{selected.address || "-"}</div></div>
                  <div className="col-span-2 rounded-md border border-border p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</div><div className="font-medium mt-1 whitespace-pre-wrap">{selected.notes || "-"}</div></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-md border border-border bg-muted/20 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="size-4 text-primary" />Order balance</div><div className="mt-1 text-xl font-bold tabular-nums">{currency(orderBalance)}</div><div className="text-[11px] text-muted-foreground">{customerOrders.length} order(s)</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><WalletCards className="size-4 text-blue-500" />Previous Balance</div><div className="mt-1 text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{currency(openingBalance)}</div><div className="text-[11px] text-muted-foreground">carried forward</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><Banknote className="size-4 text-emerald-500" />Total paid</div><div className="mt-1 text-xl font-bold tabular-nums text-emerald-600">{currency(pmt?.paid ?? 0)}</div></div>
                  <div className="rounded-md border border-border bg-muted/20 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><WalletCards className="size-4 text-rose-500" />Total Outstanding</div><div className="mt-1 text-xl font-bold tabular-nums text-rose-600">{currency(totalBalance)}</div></div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold mb-2"><CalendarDays className="size-4 text-primary" />Order history</div>
                  {customerOrders.length > 0 ? (
                    <div className="border border-border rounded-md overflow-hidden">
                      <table className="data-table text-sm">
                        <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th className="text-right whitespace-nowrap">Total</th><th className="text-right whitespace-nowrap">Paid</th><th className="text-right whitespace-nowrap">Remaining Balance</th><th>Status</th></tr></thead>
                        <tbody>
                          {customerOrders.map((o) => (
                            <tr key={o.id}>
                              <td className="font-medium">{o.number}</td>
                              <td className="text-muted-foreground">{dateShort(o.orderDate)}</td>
                              <td>{o.items.length}</td>
                              <td className="text-right tabular-nums whitespace-nowrap">{currency(o.total)}</td>
                              <td className="text-right tabular-nums text-emerald-600 whitespace-nowrap">{currency(o.paid)}</td>
                              <td className="text-right tabular-nums text-rose-600 whitespace-nowrap">{currency((o as any).balance ?? Math.max(0, o.total - o.paid))}</td>
                              <td><Badge variant="outline" className={`text-[11px] ${statusColor[o.status]}`}>{statusLabel(o.status)}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="text-sm text-muted-foreground py-6 text-center border border-border rounded-md">No orders yet</div>}
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Close</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const doc = createPaymentReminderPdf(
                      { code: selected.code, name: selected.name, mobile: selected.mobile, whatsapp: selected.whatsapp, previousBalance: Number(selected.previousBalance ?? 0) },
                      customerOrders.map((o: any) => ({ number: o.number, orderDate: o.orderDate, total: o.total, paid: o.paid, status: o.status })),
                      company,
                    );
                    sharePdf(doc, `Payment-Reminder-${selected.code}.pdf`);
                  }} disabled={totalBalance <= 0}><Send className="size-3.5 mr-1" />Send Bill</Button>
                  <Button size="sm" onClick={() => printCustomer(selected as any, company, customerOrders as any, pmt)}><FileText className="size-3.5 mr-1" />Save as PDF</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete customer?</AlertDialogTitle><AlertDialogDescription>This removes the customer from records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget != null) { remove(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
