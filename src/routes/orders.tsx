import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/DateField";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders - UDYANA" }] }),
  component: OrdersPage,
});

const STATUSES = ["pending", "confirmed", "in_production", "ready", "delivered", "finished", "cancelled"] as const;

type OrderItem = {
  productId?: number;
  productName: string;
  itemType: "window" | "other";
  width: number;
  height: number;
  length: number;
  sqft?: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string;
};

type Order = {
  id: number;
  number: string;
  customerId: number;
  customerName: string;
  quotationId?: number;
  orderDate: string;
  deliveryDate?: string;
  items: OrderItem[];
  total: number;
  paid: number;
  status: string;
  notes?: string;
  createdAt: string;
};

type Customer = { id: number; name: string };

const emptyItem: OrderItem = { productName: "", itemType: "other", width: 1, height: 1, length: 1, quantity: 1, unitPrice: 0, amount: 0 };

function OrdersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; status: string } | null>(null);

  const [list, setList] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    number: "",
    customerId: 0,
    customerName: "",
    orderDate: Date.now(),
    deliveryDate: Date.now() + 86400000 * 7,
    items: [emptyItem] as OrderItem[],
    total: 0,
    paid: 0,
    status: "pending",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [orders, custs] = await Promise.all([
        api.safeGet<Order[]>("/api/orders"),
        api.safeGet<Customer[]>("/api/customers"),
      ]);
      setList(orders || []);
      setCustomers(custs || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = list.filter((o) => !q || [o.number, o.customerName].some((v) => v.toLowerCase().includes(q.toLowerCase())));

  const changeStatus = async (id: number, status: string) => {
    try {
      await api.put(`/api/orders/${id}/status?status=${status}`);
      toast.success("Status updated");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const recalc = (items: OrderItem[]) => items.reduce((s, item) => s + item.amount, 0);

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    const items = [...form.items];
    const next = { ...items[index], ...patch };
    if (next.itemType === "window") {
      next.amount = next.length * next.quantity * next.unitPrice;
    } else {
      next.amount = next.width * next.height * next.quantity * next.unitPrice;
    }
    items[index] = next;
    setForm({ ...form, items, total: recalc(items) });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({
      number: `ORD-${String(list.length + 1).padStart(4, "0")}`,
      customerId: 0, customerName: "",
      orderDate: Date.now(), deliveryDate: Date.now() + 86400000 * 7,
      items: [{ ...emptyItem }], total: 0, paid: 0, status: "pending", notes: "",
    });
    setOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setForm({
      number: o.number, customerId: o.customerId, customerName: o.customerName,
      orderDate: new Date(o.orderDate).getTime(), deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).getTime() : Date.now() + 86400000 * 7,
      items: o.items.map((i) => ({ ...i })), total: o.total, paid: o.paid, status: o.status, notes: o.notes ?? "",
    });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    try {
      await api.delete(`/api/orders/${deleteTarget}`);
      toast.success("Order deleted");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const saveOrder = async () => {
    if (!form.customerId) return toast.error("Select a customer");
    if (!form.items.length || form.items.some((i) => !i.productName || i.amount <= 0)) return toast.error("Add valid order items");
    try {
      const items = form.items.map((i) => ({
        ...i,
        width: i.width || 0,
        height: i.height || 0,
        length: i.length || 0,
        sqft: i.sqft || 0,
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        amount: i.amount || 0,
      }));
      const body = {
        number: form.number, customerId: form.customerId, customerName: form.customerName,
        orderDate: new Date(form.orderDate).toISOString(),
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).toISOString() : null,
        items, total: form.total, paid: form.paid, status: form.status, notes: form.notes,
      };
      if (editingId) {
        await api.put(`/api/orders/${editingId}`, { id: editingId, ...body });
        toast.success("Order updated");
      } else {
        await api.post("/api/orders", body);
        toast.success("Order created");
      }
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  return (
    <AppShell
      title="Orders"
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders..." className="h-8 pl-8 w-64 text-sm" />
          </div>
          {can("orders", "create") && (
            <Button size="sm" className="ml-auto" onClick={openNew}>
              <Plus className="size-3.5 mr-1" />New order
            </Button>
          )}
        </>
      }
    >
      <PageContainer>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Order date</th>
                <th>Delivery</th>
                <th>Items</th>
                <th className="text-center whitespace-nowrap">Total</th>
                <th className="text-center whitespace-nowrap">Paid</th>
                <th className="text-center whitespace-nowrap">Remaining Balance</th>
                <th>Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.number}</td>
                  <td>{o.customerName}</td>
                  <td className="text-muted-foreground">{dateShort(o.orderDate)}</td>
                  <td className="text-muted-foreground">{dateShort(o.deliveryDate)}</td>
                  <td>{o.items.length}</td>
                  <td className="text-center tabular-nums whitespace-nowrap">{currency(o.total)}</td>
                  <td className="text-center tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{currency(o.paid)}</td>
                  <td className="text-center tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">{currency(o.total - o.paid)}</td>
                  <td>
                    {can("orders", "edit") ? (
                      <Select value={o.status} onValueChange={(v) => setStatusConfirm({ id: o.id, status: v })}>
                        <SelectTrigger className={`h-7 text-[11px] px-2 border ${statusColor[o.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] border ${statusColor[o.status]}`}>{statusLabel(o.status)}</span>
                    )}
                  </td>
                  <td className="text-right">
                    {can("orders", "edit") && (
                      <button onClick={() => openEdit(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {can("orders", "delete") && (
                      <button onClick={() => setDeleteTarget(o.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">{loading ? "Loading..." : "No orders found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContainer>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setEditingId(null); setOpen(v); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-5xl max-h-[84vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit order" : "New order"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Order #</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="h-8" /></div>
              <div>
                <Label className="text-xs">Customer *</Label>
                <Select value={form.customerId ? String(form.customerId) : ""} onValueChange={(v) => {
                  const customer = customers.find((c) => c.id === Number(v));
                  setForm({ ...form, customerId: Number(v), customerName: customer?.name || "" });
                }}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DateField label="Order date" value={form.orderDate} onChange={(v) => setForm({ ...form, orderDate: v })} />
              <DateField label="Delivery date" value={form.deliveryDate || Date.now()} onChange={(v) => setForm({ ...form, deliveryDate: v })} />
            </div>

            <div className="border border-border rounded-md overflow-visible">
              <div className="px-3 py-2 bg-muted/60 text-sm font-semibold">Items</div>
              <div className="divide-y divide-border">
                {form.items.map((item, index) => (
                  <div key={index} className="p-3 space-y-2">
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${item.itemType === "window" ? "lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto_auto]" : "lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"} gap-2 items-end`}>
                      <div><Label className="text-xs">Product</Label><Input value={item.productName} onChange={(e) => updateItem(index, { productName: e.target.value })} placeholder="Type product name" className="h-8" /></div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={item.itemType || "other"} onValueChange={(v) => updateItem(index, { itemType: v as "window" | "other" })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="other">Other Items</SelectItem>
                            <SelectItem value="window">Window</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {item.itemType === "window" ? (
                        <div><Label className="text-xs">Length</Label><Input type="number" value={item.length || ""} onChange={(e) => updateItem(index, { length: Number(e.target.value) })} className="h-8" /></div>
                      ) : (
                        <>
                          <div><Label className="text-xs">Width</Label><Input type="number" value={item.width || ""} onChange={(e) => updateItem(index, { width: Number(e.target.value) })} className="h-8" /></div>
                          <div><Label className="text-xs">Height</Label><Input type="number" value={item.height || ""} onChange={(e) => updateItem(index, { height: Number(e.target.value) })} className="h-8" /></div>
                        </>
                      )}
                      <div><Label className="text-xs">Qty</Label><Input type="number" value={item.quantity || ""} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} className="h-8" /></div>
                      <div><Label className="text-xs">Unit Price</Label><Input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} className="h-8" /></div>
                      <div><Label className="text-xs">Amount</Label><div className="h-8 px-2 rounded border bg-muted/40 flex items-center text-sm font-semibold">{currency(item.amount)}</div></div>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => { const items = form.items.filter((_, i) => i !== index); setForm({ ...form, items, total: recalc(items) }); }} disabled={form.items.length === 1}><Trash2 className="size-3.5" /></Button>
                    </div>
                    <div><Label className="text-xs">Description</Label><Input value={item.notes ?? ""} onChange={(e) => updateItem(index, { notes: e.target.value })} placeholder="Item description, specs, color, etc." className="h-8" /></div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>
                  <Plus className="size-3.5 mr-1" />Add item
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div><Label className="text-xs">Paid amount</Label><Input type="number" value={form.paid || ""} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} className="h-8" /></div>
              <div className="stat-card py-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</div><div className="text-lg font-semibold">{currency(form.total)}</div></div>
              <div className="stat-card py-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Remaining Balance</div><div className="text-lg font-semibold text-rose-600">{currency(form.total - form.paid)}</div></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveOrder}>{editingId ? "Update order" : "Save order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this order? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusConfirm != null} onOpenChange={() => setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to change the status?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (statusConfirm) { changeStatus(statusConfirm.id, statusConfirm.status); setStatusConfirm(null); } }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
