import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory - UDYANA" }] }),
  component: InventoryPage,
});

type InventoryItem = { id: number; name: string; category: string; unit: string; itemType: string; pricingMode?: string; currentStock: number; minStock: number; costPrice: number; supplier?: string; widthFt?: number; heightFt?: number; length?: number; stockQty?: number; createdAt: string };
const empty: Omit<InventoryItem, "id" | "createdAt"> = { name: "", category: "", unit: "pcs", itemType: "other", pricingMode: "piece", currentStock: 0, minStock: 0, costPrice: 0, supplier: "", widthFt: 0, heightFt: 0, length: 0, stockQty: 0 };

function InventoryPage() {
  const { can } = useAuth();
  const [list, setList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try { const data = await api.safeGet<InventoryItem[]>("/api/inventory"); setList(data || []); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalValue = list.reduce((s, i) => s + i.currentStock * i.costPrice, 0);
  const lowStock = list.filter((i) => i.currentStock < i.minStock);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Item name required");
    try {
      if (editingId) { await api.put(`/api/inventory/${editingId}`, { id: editingId, ...form }); toast.success("Updated"); }
      else { await api.post("/api/inventory", form); toast.success("Added"); }
      setOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const remove = async (id: number) => {
    try { await api.delete(`/api/inventory/${id}`); toast.success("Deleted"); fetchData(); } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  return (
    <AppShell title="Inventory" actions={can("inventory", "create") ? <Button size="sm" className="ml-auto" onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }}><Plus className="size-3.5 mr-1" />New item</Button> : undefined}>
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Items</div><div className="text-xl font-semibold tabular-nums">{list.length}</div></div>
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stock value</div><div className="text-xl font-semibold tabular-nums">{currency(totalValue)}</div></div>
          <div className="stat-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Low stock</div><div className="text-xl font-semibold tabular-nums text-amber-600">{lowStock.length}</div></div>
        </div>
        <TableShell>
          <table className="data-table">
            <thead><tr><th>Item</th><th>Type</th><th>Category</th><th>Supplier</th><th>Unit</th><th className="text-right">Dimension</th><th className="text-right">Qty</th><th className="text-right">Total stock</th><th className="text-right">Min</th><th className="text-right">Cost</th><th>Status</th><th className="w-20 text-right">Actions</th></tr></thead>
            <tbody>
              {list.map((i) => {
                const low = i.currentStock < i.minStock;
                const isWindow = (i.itemType || "other") === "window";
                const unitOf = (i.pricingMode || "piece") === "size" ? (isWindow ? "ft" : "sqft") : "pcs";
                const dimension = isWindow
                  ? `${i.length || 0} ft`
                  : (i.widthFt || i.heightFt) ? `${i.widthFt ?? 0} × ${i.heightFt ?? 0} ft` : "-";
                return (
                  <tr key={i.id}>
                    <td className="font-medium">{i.name}</td>
                    <td><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${isWindow ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" : "bg-muted/50 text-muted-foreground border-border"}`}>{isWindow ? "Window" : "Other"}</span></td>
                    <td>{i.category}</td><td className="text-muted-foreground">{i.supplier || "-"}</td><td>{i.unit}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{dimension}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{i.stockQty ?? 0}</td>
                    <td className={`text-right tabular-nums ${low ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>{i.currentStock} <span className="text-[10px] text-muted-foreground">{unitOf}</span></td>
                    <td className="text-right tabular-nums text-muted-foreground">{i.minStock}</td><td className="text-right tabular-nums">{currency(i.costPrice)}<span className="text-[10px] text-muted-foreground">/{unitOf}</span></td>
                    <td>{low ? <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border bg-amber-500/15 text-amber-600 border-amber-500/30"><AlertTriangle className="size-3" />Low</span> : <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] border bg-emerald-500/15 text-emerald-600 border-emerald-500/30">OK</span>}</td>
                    <td className="text-right">
                      {can("inventory", "edit") && <button onClick={() => { setEditingId(i.id); setForm({ name: i.name, category: i.category, unit: i.unit, itemType: (i.itemType || "other") as "window" | "other", pricingMode: (i.pricingMode || "piece") as "piece" | "size", currentStock: i.currentStock, minStock: i.minStock, costPrice: i.costPrice, supplier: i.supplier || "", widthFt: i.widthFt ?? 0, heightFt: i.heightFt ?? 0, length: i.length ?? 0, stockQty: i.stockQty ?? 0 }); setOpen(true); }} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"><Pencil className="size-3.5" /></button>}
                      {can("inventory", "delete") && <button onClick={() => setDeleteTarget(i.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center"><Trash2 className="size-3.5" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState icon={Boxes} title={loading ? "Loading..." : "No inventory items"} hint={loading ? "Please wait" : "Add your first item to get started"} />}
        </TableShell>
      </PageContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete item?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget != null) { remove(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
