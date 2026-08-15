import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/DateField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

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
  subtotal: number;
  discountPercent: number;
  total: number;
  paid: number;
  status: string;
  notes?: string;
  createdAt: string;
};

type Customer = { id: number; name: string };
type Product = { id: number; name: string; basePrice: number; active: boolean };
type InventoryItem = { id: number; name: string; currentStock: number };

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
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    number: "",
    customerId: 0,
    customerName: "",
    orderDate: Date.now(),
    deliveryDate: Date.now() + 86400000 * 7,
    items: [emptyItem] as OrderItem[],
    subtotal: 0,
    discountPercent: 0,
    total: 0,
    paid: 0,
    status: "pending",
    notes: "",
  });
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [orders, custs, prods, inv] = await Promise.all([
        api.safeGet<Order[]>("/api/orders"),
        api.safeGet<Customer[]>("/api/customers"),
        api.safeGet<Product[]>("/api/products"),
        api.safeGet<InventoryItem[]>("/api/inventory"),
      ]);
      setList(orders || []);
      setCustomers(custs || []);
      setProducts((prods || []).filter((p) => p.active));
      setInventory(inv || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = list.filter((o) => !q || [o.number, o.customerName].some((v) => v.toLowerCase().includes(q.toLowerCase())));

  const getAvailableStock = (productName: string): number | null => {
    const item = inventory.find((i) => i.name.toLowerCase() === productName.toLowerCase());
    return item ? item.currentStock : null;
  };

  const changeStatus = async (id: number, status: string) => {
    try {
      await api.put(`/api/orders/${id}/status?status=${status}`);
      toast.success("Status updated");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const recalc = (items: OrderItem[], discountPercent?: number) => {
    const subtotal = items.reduce((s, item) => s + item.amount, 0);
    const dp = discountPercent ?? form.discountPercent;
    const total = subtotal - (subtotal * dp / 100);
    return { subtotal, total };
  };

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    const items = [...form.items];
    const next = { ...items[index], ...patch };
    if (next.itemType === "window") {
      next.amount = next.length * next.quantity * next.unitPrice;
    } else {
      next.amount = next.width * next.height * next.quantity * next.unitPrice;
    }
    items[index] = next;
    const { subtotal, total } = recalc(items);
    setForm({ ...form, items, subtotal, total });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({
      number: `ORD-${String(list.length + 1).padStart(4, "0")}`,
      customerId: 0, customerName: "",
      orderDate: Date.now(), deliveryDate: Date.now() + 86400000 * 7,
      items: [{ ...emptyItem }], subtotal: 0, discountPercent: 0, total: 0, paid: 0, status: "pending", notes: "",
    });
    setOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setForm({
      number: o.number, customerId: o.customerId, customerName: o.customerName,
      orderDate: new Date(o.orderDate).getTime(), deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).getTime() : Date.now() + 86400000 * 7,
      items: o.items.map((i) => ({ ...i })), subtotal: o.subtotal ?? o.total, discountPercent: o.discountPercent ?? 0, total: o.total, paid: o.paid, status: o.status, notes: o.notes ?? "",
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
    if (!form.customerName) return toast.error("Enter a customer name");
    if (!form.items.length || form.items.some((i) => !i.productName || i.amount <= 0)) return toast.error("Add valid order items");
    try {
      let customerId = form.customerId;
      if (!customerId) {
        const newCust = await api.post<Customer>("/api/customers", { name: form.customerName });
        customerId = newCust.id;
        toast.success("New customer created");
        fetchData();
      }
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
        number: form.number, customerId, customerName: form.customerName,
        orderDate: new Date(form.orderDate).toISOString(),
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).toISOString() : null,
        subtotal: form.subtotal, discountPercent: form.discountPercent,
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
      const msg = err.message || "Failed to save";
      if (msg.includes("Insufficient stock")) {
        toast.error(msg, { duration: 10000 });
      } else {
        toast.error(msg);
      }
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
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={customerOpen} className="h-8 w-full justify-between text-sm font-normal">
                      {form.customerName || "Select or type customer..."}
                      <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search customer..." value={customerSearch} onValueChange={setCustomerSearch} />
                      <CommandEmpty>
                        <div className="py-2 px-2 text-sm">
                          <div className="text-muted-foreground mb-1">No customer found</div>
                          <Button size="sm" className="w-full h-7" onClick={() => {
                            const name = customerSearch.trim();
                            if (!name) return;
                            setForm({ ...form, customerId: 0, customerName: name });
                            setCustomerSearch("");
                            setCustomerOpen(false);
                          }}>
                            <Plus className="size-3 mr-1" />Add "{customerSearch}"
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.filter((c) => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).map((c) => (
                          <CommandItem key={c.id} value={c.name} onSelect={() => {
                            setForm({ ...form, customerId: c.id, customerName: c.name });
                            setCustomerSearch("");
                            setCustomerOpen(false);
                          }}>
                            <Check className={cn("size-3.5 mr-2", form.customerId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      <div>
                        <Label className="text-xs">Product</Label>
                        <Select value={item.productName || "__none__"} onValueChange={(v) => {
                          if (v === "__none__") return updateItem(index, { productName: "" });
                          const prod = products.find((p) => p.name === v);
                          updateItem(index, { productName: v, unitPrice: prod?.basePrice || item.unitPrice });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">-- Select product --</SelectItem>
                            {products.map((p) => {
                              const stock = getAvailableStock(p.name);
                              return (
                                <SelectItem key={p.id} value={p.name}>
                                  {p.name} {stock !== null && <span className="text-muted-foreground ml-1">({stock} in stock)</span>}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {item.productName && (
                          <div className="mt-1">
                            {(() => {
                              const stock = getAvailableStock(item.productName);
                              if (stock === null) return null;
                              const isLow = stock < item.quantity;
                              return (
                                <span className={`text-[11px] ${isLow ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
                                  Available: {stock} {isLow && `(need ${item.quantity})`}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
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
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          className={`h-8 ${item.productName && getAvailableStock(item.productName) !== null && item.quantity > (getAvailableStock(item.productName) || 0) ? "border-rose-500 focus:ring-rose-500" : ""}`}
                        />
                      </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div><Label className="text-xs">Discount %</Label><Input type="number" min="0" max="100" value={form.discountPercent || ""} onChange={(e) => {
                const dp = Number(e.target.value);
                const total = form.subtotal - (form.subtotal * dp / 100);
                setForm({ ...form, discountPercent: dp, total });
              }} className="h-8" /></div>
              <div><Label className="text-xs">Paid amount</Label><Input type="number" value={form.paid || ""} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} className="h-8" /></div>
              <div className="stat-card py-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Subtotal</div><div className="text-sm font-semibold text-muted-foreground">{currency(form.subtotal)}</div>{form.discountPercent > 0 && <><div className="text-[11px] text-muted-foreground">Discount: {form.discountPercent}% (-{currency(form.subtotal * form.discountPercent / 100)})</div><div className="text-lg font-semibold">{currency(form.total)}</div></>}</div>
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
