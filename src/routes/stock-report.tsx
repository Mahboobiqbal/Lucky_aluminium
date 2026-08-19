import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currency, dateShort } from "@/lib/format";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Eye, AlertTriangle, Boxes, Package, TrendingDown, Warehouse, X } from "lucide-react";
import { toast } from "sonner";

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

const empty: Omit<InventoryItem, "id" | "createdAt"> = {
  name: "", category: "", unit: "pcs", itemType: "other", pricingMode: "piece",
  currentStock: 0, minStock: 0, costPrice: 0, supplier: "", widthFt: 0, heightFt: 0, length: 0, stockQty: 0,
};

function StockReportPage() {
  const { can } = useAuth();
  const [list, setList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);

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

  const save = async () => {
    if (!form.name.trim()) return toast.error("Item name required");
    try {
      if (editingId) {
        await api.put(`/api/inventory/${editingId}`, { id: editingId, ...form });
        toast.success("Item updated");
      } else {
        await api.post("/api/inventory", form);
        toast.success("Item added");
      }
      setOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/inventory/${id}`);
      toast.success("Item deleted");
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const openNew = () => { setEditingId(null); setForm(empty); setOpen(true); };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      itemType: (item.itemType || "other") as "window" | "other",
      pricingMode: (item.pricingMode || "piece") as "piece" | "size",
      currentStock: item.currentStock, minStock: item.minStock, costPrice: item.costPrice,
      supplier: item.supplier || "", widthFt: item.widthFt ?? 0, heightFt: item.heightFt ?? 0,
      length: item.length ?? 0, stockQty: item.stockQty ?? 0,
    });
    setOpen(true);
  };

  return (
    <AppShell title="Stock Report" actions={
      can("inventory", "create") ? (
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="size-3.5 mr-1" />New Item
        </Button>
      ) : undefined
    }>
      <PageContainer>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard icon={Package} label="Total Items" value={String(totalItems)} tone="primary" />
            <StatCard icon={Warehouse} label="Total Units" value={String(totalUnits)} tone="blue" />
            <StatCard icon={Boxes} label="Stock Value" value={currency(totalStockValue)} tone="emerald" />
            <StatCard icon={AlertTriangle} label="Low Stock" value={String(lowStockCount)} tone="amber" />
            <StatCard icon={TrendingDown} label="Out of Stock" value={String(outOfStockCount)} tone="rose" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, category, supplier..." className="w-full sm:w-80" />
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

          <TableShell>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">#</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th className="text-right">Dimension</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Min Stock</th>
                  <th className="text-right">Cost Price</th>
                  <th className="text-right">Stock Value</th>
                  <th>Status</th>
                  <th className="w-28 text-right">Actions</th>
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
                    <tr key={item.id} className={`${out ? "bg-rose-500/5" : low ? "bg-amber-500/5" : ""} hover:bg-muted/30 transition-colors`}>
                      <td className="text-center text-muted-foreground">{idx + 1}</td>
                      <td className="font-medium">{item.name}</td>
                      <td><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${isWindow ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" : "bg-muted/50 text-muted-foreground border-border"}`}>{isWindow ? "Window" : "Other"}</span></td>
                      <td>{item.category || "-"}</td>
                      <td className="text-muted-foreground">{item.supplier || "-"}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{dimension}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{item.stockQty ?? 0}</td>
                      <td className={`text-right tabular-nums font-semibold ${out ? "text-rose-600 dark:text-rose-400" : low ? "text-amber-600 dark:text-amber-400" : ""}`}>{item.currentStock} <span className="text-[10px] font-normal text-muted-foreground">{unitOf(item)}</span></td>
                      <td className="text-right tabular-nums text-muted-foreground">{item.minStock}</td>
                      <td className="text-right tabular-nums">{currency(item.costPrice)}<span className="text-[10px] text-muted-foreground">/{unitOf(item)}</span></td>
                      <td className="text-right tabular-nums font-medium">{currency(value)}</td>
                      <td>
                        {out ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border bg-rose-500/15 text-rose-600 border-rose-500/30"><TrendingDown className="size-3" />Out</span>
                        ) : low ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border bg-amber-500/15 text-amber-600 border-amber-500/30"><AlertTriangle className="size-3" />Low</span>
                        ) : (
                          <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] border bg-emerald-500/15 text-emerald-600 border-emerald-500/30">OK</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setViewItem(item)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="View">
                            <Eye className="size-3.5" />
                          </button>
                          {can("inventory", "edit") && (
                            <button onClick={() => openEdit(item)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Edit">
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                          {can("inventory", "delete") && (
                            <button onClick={() => setDeleteTarget(item.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <EmptyState icon={Boxes} title={loading ? "Loading..." : "No items found"} hint={loading ? "Please wait" : "Try adjusting your filters"} />
            )}
          </TableShell>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {filtered.length} of {totalItems} items</span>
            <span>Total value: <span className="font-bold text-foreground">{currency(filtered.reduce((s, i) => s + i.currentStock * i.costPrice, 0))}</span></span>
          </div>
        </div>
      </PageContainer>

      {/* View Dialog */}
      {viewItem && (
        <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Package className="size-4" />
                </div>
                {viewItem.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Type" value={(viewItem.itemType || "other") === "window" ? "Window" : "Other"} />
                <InfoRow label="Category" value={viewItem.category || "—"} />
                <InfoRow label="Supplier" value={viewItem.supplier || "—"} />
                <InfoRow label="Unit" value={viewItem.unit} />
                <InfoRow label="Dimension" value={
                  (viewItem.itemType || "other") === "window"
                    ? `${viewItem.length || 0} ft`
                    : (viewItem.widthFt || viewItem.heightFt) ? `${viewItem.widthFt ?? 0} × ${viewItem.heightFt ?? 0} ft` : "—"
                } />
                <InfoRow label="Qty" value={String(viewItem.stockQty ?? 0)} />
              </div>
              <div className="border-t border-border pt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-[11px] text-muted-foreground uppercase">Stock</div>
                    <div className={`text-xl font-bold ${viewItem.currentStock === 0 ? "text-rose-600" : viewItem.currentStock < viewItem.minStock ? "text-amber-600" : ""}`}>
                      {viewItem.currentStock}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-[11px] text-muted-foreground uppercase">Min</div>
                    <div className="text-xl font-bold">{viewItem.minStock}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-[11px] text-muted-foreground uppercase">Value</div>
                    <div className="text-xl font-bold">{currency(viewItem.currentStock * viewItem.costPrice)}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Cost Price" value={`${currency(viewItem.costPrice)}/${unitOf(viewItem)}`} />
                <InfoRow label="Status" value={
                  viewItem.currentStock === 0 ? "Out of Stock" : viewItem.currentStock < viewItem.minStock ? "Low Stock" : "In Stock"
                } />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewItem(null)}>Close</Button>
              {can("inventory", "edit") && (
                <Button size="sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-8" /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.itemType || "other"} onValueChange={(v) => setForm({ ...form, itemType: v as "window" | "other" })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="window">Window</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Price Mode</Label>
              <Select value={form.pricingMode || "piece"} onValueChange={(v) => setForm({ ...form, pricingMode: v as "piece" | "size" })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Per Piece</SelectItem>
                  <SelectItem value="size">Per Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="h-8" /></div>
            {form.itemType === "window" ? (
              <div><Label className="text-xs">Length (ft)</Label><Input type="number" value={form.length || ""} onChange={(e) => setForm({ ...form, length: Number(e.target.value) })} className="h-8" /></div>
            ) : (
              <>
                <div><Label className="text-xs">W (ft)</Label><Input type="number" value={form.widthFt || ""} onChange={(e) => setForm({ ...form, widthFt: Number(e.target.value) })} className="h-8" /></div>
                <div><Label className="text-xs">H (ft)</Label><Input type="number" value={form.heightFt || ""} onChange={(e) => setForm({ ...form, heightFt: Number(e.target.value) })} className="h-8" /></div>
              </>
            )}
            <div><Label className="text-xs">Qty</Label><Input type="number" value={form.stockQty || ""} onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })} className="h-8" /></div>
            <div><Label className="text-xs">Current stock</Label><Input type="number" value={form.currentStock || ""} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} className="h-8" /></div>
            <div><Label className="text-xs">Minimum stock</Label><Input type="number" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Cost price {form.pricingMode === "size" ? (form.itemType === "window" ? "per ft" : "per sqft") : "per pc"}</Label><Input type="number" value={form.costPrice || ""} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="h-8" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>{editingId ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The item will be permanently removed from inventory.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget != null) { remove(deleteTarget); setDeleteTarget(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
