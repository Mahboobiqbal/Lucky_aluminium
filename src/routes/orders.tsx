import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { TableActions } from "@/components/layout/TableActions";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/DateField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders — Lucky Aluminium" }] }),
  component: OrdersPage,
});

const STATUSES = ["pending", "confirmed", "in_production", "ready", "delivered", "finished", "cancelled"] as const;

type OrderItem = {
  productId?: number;
  productName: string;
  color?: string;
  size?: string;
  gaze?: string;
  itemType: "length" | "window";
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
  extraCharges?: number;
  total: number;
  paid: number;
  previousBalance?: number;
  balance?: number;
  grandTotal?: number;
  status: string;
  notes?: string;
  createdAt: string;
};

type Customer = { id: number; name: string };
type Product = { id: number; name: string; basePrice: number; active: boolean };
type InventoryItem = { id: number; name: string; color?: string; size?: string; gaze?: string; itemType?: string; pricingMode?: string; currentStock: number; widthFt?: number; heightFt?: number; length?: number };

const emptyItem: OrderItem = { productName: "", color: "", size: "", gaze: "", itemType: "length", width: 0, height: 0, length: 0, quantity: 0, unitPrice: 0, amount: 0 };

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
    hardwareCharges: 0,
    extraCharges: 0,
    total: 0,
    paid: 0,
    previousBalance: 0,
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
      setList(Array.isArray(orders) ? orders : []);
      setCustomers(Array.isArray(custs) ? custs : []);
      setProducts((Array.isArray(prods) ? prods : []).filter((p) => p.active));
      setInventory(Array.isArray(inv) ? inv : []);
    } catch { toast.error("Failed to load data"); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (Array.isArray(list) ? list : []).filter((o) => !q || [o.number, o.customerName].some((v) => v.toLowerCase().includes(q.toLowerCase())));

  const getAvailableStock = (productName: string, color?: string, size?: string, gaze?: string): number | null => {
    const items = (Array.isArray(inventory) ? inventory : []).filter((i) => i.name.toLowerCase() === productName.toLowerCase());
    if (!items.length) return null;
    const exact = items.find((i) => (i.color || "") === (color || "") && (i.size || "") === (size || "") && (i.gaze || "") === (gaze || ""));
    return exact ? exact.currentStock : items[0].currentStock;
  };

  const invOf = (productName: string) => (Array.isArray(inventory) ? inventory : []).find((i) => i.name.toLowerCase() === productName.toLowerCase());
  const productLabel = (productName: string) => {
    const inv = invOf(productName);
    const variants = [inv?.color, inv?.size, inv?.gaze].filter(Boolean);
    return variants.length ? `${productName} • ${variants.join(" / ")}` : productName;
  };

  const isSizeMode = (productName: string) => invOf(productName)?.pricingMode === "size";

  const unitOf = (productName: string, itemType?: string): string => {
    const inv = invOf(productName);
    const type = inv?.itemType || itemType || "window";
    return isSizeMode(productName) ? (type === "length" ? "ft" : "sqft") : "pcs";
  };

  const consumedOf = (item: OrderItem): number => {
    if (!isSizeMode(item.productName)) return item.quantity;
    const inv = invOf(item.productName);
    const type = inv?.itemType || item.itemType || "window";
    if (type === "length") {
      const dim = item.length > 0 ? item.length : (inv?.length || 0);
      return dim ? dim * item.quantity : item.quantity;
    }
    const w = item.width > 0 ? item.width : (inv?.widthFt || 0);
    const h = item.height > 0 ? item.height : (inv?.heightFt || 0);
    return w && h ? w * h * item.quantity : item.quantity;
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
    const hardwareVal = form.hardwareCharges || 0;
    const extraVal = form.extraCharges || 0;
    const total = subtotal - (subtotal * dp / 100) + hardwareVal + extraVal;
    return { subtotal, total };
  };

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    const items = [...form.items];
    const next = { ...items[index], ...patch };
    if (next.productName) {
      const inv = invOf(next.productName);
      next.color = next.color || inv?.color || "";
      next.size = next.size || inv?.size || "";
      next.gaze = next.gaze || inv?.gaze || "";
    }
    if (isSizeMode(next.productName)) {
      if (next.itemType === "length") {
        next.amount = next.length * next.quantity * next.unitPrice;
      } else {
        next.amount = next.width * next.height * next.quantity * next.unitPrice;
      }
    } else {
      next.amount = next.quantity * next.unitPrice;
    }
    items[index] = next;
    const { subtotal, total } = recalc(items);
    setForm({ ...form, items, subtotal, total });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({
      number: `ORD-${String((Array.isArray(list) ? list : []).length + 1).padStart(4, "0")}`,
      customerId: 0, customerName: "",
      orderDate: Date.now(), deliveryDate: Date.now() + 86400000 * 7,
      items: [{ ...emptyItem }], subtotal: 0, discountPercent: 0, hardwareCharges: 0, extraCharges: 0, total: 0, paid: 0, previousBalance: 0, status: "pending", notes: "",
    });
    setOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setForm({
      number: o.number, customerId: o.customerId, customerName: o.customerName,
      orderDate: new Date(o.orderDate).getTime(), deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).getTime() : Date.now() + 86400000 * 7,
      items: o.items.map((i) => ({ ...i })), subtotal: o.subtotal ?? o.total, discountPercent: o.discountPercent ?? 0, hardwareCharges: (o as any).hardwareCharges ?? 0, extraCharges: o.extraCharges ?? 0, total: o.total, paid: o.paid, previousBalance: (o as any).previousBalance ?? 0, status: o.status, notes: o.notes ?? "",
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
        color: i.color || invOf(i.productName)?.color || "",
        size: i.size || invOf(i.productName)?.size || "",
        gaze: i.gaze || invOf(i.productName)?.gaze || "",
        width: i.width || 0,
        height: i.height || 0,
        length: i.length || 0,
        sqft: i.sqft || 0,
        quantity: i.quantity || 0,
        unitPrice: i.unitPrice || 0,
        amount: i.amount || 0,
      }));
      const body = {
        number: form.number, customerId, customerName: form.customerName,
        orderDate: new Date(form.orderDate).toISOString(),
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).toISOString() : null,
        subtotal: form.subtotal, discountPercent: form.discountPercent, hardwareCharges: form.hardwareCharges, extraCharges: form.extraCharges,
        items, total: form.total, paid: form.paid, previousBalance: form.previousBalance, status: form.status, notes: form.notes,
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
          <SearchInput value={q} onChange={setQ} placeholder="Search orders..." className="w-64 h-8" />
          {can("orders", "create") && (
            <Button size="sm" className="ml-auto" onClick={openNew}>
              <Plus className="size-3.5 mr-1" />New order
            </Button>
          )}
        </>
      }
    >
      <PageContainer>
        <TableShell>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Order date</th>
                <th>Delivery</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining Balance</th>
                <th>Prev. Balance</th>
                <th>Status</th>
                <th className="text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.number}</td>
                  <td>{o.customerName}</td>
                  <td className="text-muted-foreground">{dateShort(o.orderDate)}</td>
                  <td className="text-muted-foreground">{dateShort(o.deliveryDate)}</td>
                  <td className="tabular-nums whitespace-nowrap">{currency(o.total)}</td>
                  <td className="tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{currency(o.paid)}</td>
                  <td className="tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">{currency(o.balance ?? Math.max(0, o.total - o.paid))}</td>
                  <td className="tabular-nums text-blue-600 dark:text-blue-400 whitespace-nowrap">{Number(o.previousBalance ?? 0) > 0 ? currency(Number(o.previousBalance ?? 0)) : "—"}</td>
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
                  <td>
                    <TableActions>
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
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState icon={ShoppingCart} title={loading ? "Loading..." : "No orders found"} hint={loading ? "Please wait" : "Create your first order to get started"} />}
        </TableShell>
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
                        {(Array.isArray(customers) ? customers : []).filter((c) => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).map((c) => (
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
                    <div className="grid gap-2 items-end" style={{ gridTemplateColumns: item.itemType === "length" ? "minmax(0,1fr) 90px 90px 90px 140px 70px 70px 90px 90px 36px" : "minmax(0,1fr) 90px 90px 90px 140px 70px 70px 70px 90px 90px 36px" }}>
                      <div className="min-w-0">
                        <Label className="text-xs">Product</Label>
                        <Select value={item.productName ? `inv-${item.productName}|${item.color || ""}|${item.size || ""}|${item.gaze || ""}` : "__none__"} onValueChange={(v) => {
                          if (v === "__none__") return updateItem(index, { productName: "" });
                          const inv = (Array.isArray(inventory) ? inventory : []).find((i) => `inv-${i.name}|${i.color || ""}|${i.size || ""}|${i.gaze || ""}` === v);
                          if (!inv) return;
                          const prod = products.find((p) => p.name.toLowerCase() === inv.name.toLowerCase());
                          updateItem(index, {
                            productName: inv.name,
                            color: inv.color || "",
                            size: inv.size || "",
                            gaze: inv.gaze || "",
                            itemType: inv.itemType === "length" ? "length" : "window",
                            unitPrice: prod?.basePrice || item.unitPrice,
                          });
                        }}>
                          <SelectTrigger className="h-8 overflow-hidden"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent className="max-h-[280px]">
                            <SelectItem value="__none__">-- Select product --</SelectItem>
                            {(Array.isArray(inventory) ? inventory : []).map((inv) => {
                              const key = `inv-${inv.name}|${inv.color || ""}|${inv.size || ""}|${inv.gaze || ""}`;
                              const stock = inv.currentStock;
                              const unit = (inv.pricingMode || "piece") === "size" ? ((inv.itemType || "window") === "length" ? "ft" : "sqft") : "pcs";
                              const isLow = stock < 10;
                              const isOut = stock <= 0;
                              const variants = [inv.color, inv.size, inv.gaze].filter(Boolean);
                              const label = variants.length ? `${inv.name} • ${variants.join(" / ")}` : inv.name;
                              return (
                                <SelectItem key={key} value={key} className="py-2.5">
                                  <div className="flex items-center justify-between gap-3 w-full">
                                    <span className="font-medium truncate">{label}</span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isOut ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : isLow ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                                      {isOut ? <AlertTriangle className="size-2.5" /> : <Package className="size-2.5" />}
                                      {stock} {unit}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {item.productName && (
                          <div className="mt-1.5">
                            {(() => {
                              const stock = getAvailableStock(item.productName, item.color, item.size, item.gaze);
                              if (stock === null) return null;
                              const need = consumedOf(item);
                              const isLow = need > stock;
                              const unit = unitOf(item.productName, item.itemType);
                              if (isLow) {
                                return (
                                  <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-md px-2 py-1">
                                    <AlertTriangle className="size-3 shrink-0" />
                                    <span>Available: <span className="font-semibold">{stock} {unit}</span> — need <span className="font-semibold">{need}</span></span>
                                  </div>
                                );
                              }
                              return (
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-2 py-1">
                                  <Package className="size-3 shrink-0" />
                                  <span>Available: <span className="font-semibold">{stock} {unit}</span></span>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div><Label className="text-xs">Color</Label><Input value={item.color || ""} onChange={(e) => updateItem(index, { color: e.target.value })} className="h-8" /></div>
                      <div><Label className="text-xs">Size</Label><Input value={item.size || ""} onChange={(e) => updateItem(index, { size: e.target.value })} className="h-8" /></div>
                      <div><Label className="text-xs">Gaze</Label><Input value={item.gaze || ""} onChange={(e) => updateItem(index, { gaze: e.target.value })} className="h-8" /></div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={item.itemType || "window"} onValueChange={(v) => updateItem(index, { itemType: v as "length" | "window" })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="window">Other Items</SelectItem>
                            <SelectItem value="length">Length-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {item.itemType === "length" ? (
                        <div><Label className="text-xs">Length</Label><Input type="number" min="0" value={item.length || ""} onChange={(e) => updateItem(index, { length: Number(e.target.value) })} className="h-8" /></div>
                      ) : (
                        <>
                          <div><Label className="text-xs">Width</Label><Input type="number" min="0" value={item.width || ""} onChange={(e) => updateItem(index, { width: Number(e.target.value) })} className="h-8" /></div>
                          <div><Label className="text-xs">Height</Label><Input type="number" min="0" value={item.height || ""} onChange={(e) => updateItem(index, { height: Number(e.target.value) })} className="h-8" /></div>
                        </>
                      )}
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          className={`h-8 ${item.productName && getAvailableStock(item.productName, item.color, item.size, item.gaze) !== null && consumedOf(item) > (getAvailableStock(item.productName, item.color, item.size, item.gaze) || 0) ? "border-rose-500 focus:ring-rose-500" : ""}`}
                        />
                      </div>
                      <div><Label className="text-xs">Unit Price{isSizeMode(item.productName) ? (item.itemType === "length" ? " /ft" : " /sqft") : " /pc"}</Label><Input type="number" min="0" value={item.unitPrice || ""} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} className="h-8" /></div>
                      <div><Label className="text-xs">Amount</Label><div className="h-8 px-2 rounded border bg-muted/40 flex items-center text-sm font-semibold truncate">{currency(item.amount)}</div></div>
                      <div className="flex items-end justify-center pb-0.5"><Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-destructive" onClick={() => { const items = form.items.filter((_, i) => i !== index); const { subtotal, total } = recalc(items); setForm({ ...form, items, subtotal, total }); }} disabled={form.items.length === 1}><Trash2 className="size-3.5" /></Button></div>
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

            {/* --- ORDER TOTALS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Left: Inputs */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Discount %</Label><Input type="number" min="0" max="100" value={form.discountPercent || ""} onChange={(e) => {
                    const dp = Number(e.target.value);
                    const hardwareVal = form.hardwareCharges || 0;
                    const extraVal = form.extraCharges || 0;
                    const total = Math.max(0, form.subtotal - (form.subtotal * dp / 100) + hardwareVal + extraVal);
                    setForm({ ...form, discountPercent: dp, total });
                  }} className="h-8" /></div>
                  <div><Label className="text-xs">Hardware Charges</Label><Input type="number" min="0" value={form.hardwareCharges || ""} onChange={(e) => {
                    const hardwareVal = Number(e.target.value);
                    const total = Math.max(0, form.subtotal - (form.subtotal * form.discountPercent / 100) + hardwareVal + (form.extraCharges || 0));
                    setForm({ ...form, hardwareCharges: hardwareVal, total });
                  }} className="h-8" /></div>
                  <div><Label className="text-xs">Extra Charges</Label><Input type="number" min="0" value={form.extraCharges || ""} onChange={(e) => {
                    const extraVal = Number(e.target.value);
                    const total = Math.max(0, form.subtotal - (form.subtotal * form.discountPercent / 100) + (form.hardwareCharges || 0) + extraVal);
                    setForm({ ...form, extraCharges: extraVal, total });
                  }} className="h-8" /></div>
                  <div><Label className="text-xs">Paid amount</Label><Input type="number" min="0" value={form.paid || ""} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} className="h-8" /></div>
                </div>
                <div><Label className="text-xs">Previous Balance (from before this order)</Label><Input type="number" min="0" value={form.previousBalance || ""} onChange={(e) => setForm({ ...form, previousBalance: Number(e.target.value) })} className="h-8" placeholder="0" /></div>
              </div>
              {/* Right: Summary */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{currency(form.subtotal)}</span></div>
                {form.discountPercent > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Discount ({form.discountPercent}%)</span><span className="tabular-nums text-destructive">−{currency(form.subtotal * form.discountPercent / 100)}</span></div>}
                {(form.hardwareCharges ?? 0) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Hardware Charges</span><span className="tabular-nums">{currency(form.hardwareCharges)}</span></div>}
                {(form.extraCharges ?? 0) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Extra Charges</span><span className="tabular-nums">{currency(form.extraCharges)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5"><span>Order Total</span><span className="tabular-nums">{currency(form.total)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Paid / Advance</span><span className="tabular-nums">{currency(form.paid)}</span></div>
                <div className="flex justify-between text-xs border-t border-border pt-1.5"><span className="text-muted-foreground">Remaining Balance</span><span className="tabular-nums font-semibold">{currency(editingId ? (form as any).balance ?? Math.max(0, form.total - form.paid) : Math.max(0, form.total - form.paid))}</span></div>
                {form.previousBalance > 0 && <>
                  <div className="border-t border-dashed border-border pt-1.5" />
                  <div className="flex justify-between text-xs"><span className="text-blue-600">Previous Balance</span><span className="tabular-nums text-blue-600">{currency(form.previousBalance)}</span></div>
                </>}
                <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5"><span className="text-rose-600">Grand Total</span><span className="tabular-nums text-rose-600">{currency(editingId ? (form as any).grandTotal ?? Math.max(0, form.total - form.paid) + form.previousBalance : Math.max(0, form.total - form.paid) + form.previousBalance)}</span></div>
              </div>
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
