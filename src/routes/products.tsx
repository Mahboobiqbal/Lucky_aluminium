import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — UDYANA" }] }),
  component: ProductsPage,
});

const CATEGORIES = [
  "uPVC Sliding Window", "uPVC Casement Window", "uPVC Fixed Window",
  "uPVC Awning Window", "uPVC Tilt & Turn Window", "uPVC Sliding Door",
  "uPVC Casement Door", "uPVC French Door", "uPVC Folding Door", "Custom Product",
];

type Product = {
  id: number;
  code: string;
  name: string;
  category: string;
  openingType?: string;
  profileSeries?: string;
  glassType?: string;
  glassThickness?: string;
  frameColor?: string;
  handleType?: string;
  lockType?: string;
  unit: string;
  basePrice: number;
  description?: string;
  active: boolean;
  createdAt: string;
};

const empty: Omit<Product, "id" | "createdAt"> = {
  code: "", name: "", category: CATEGORIES[0], profileSeries: "", glassType: "", glassThickness: "",
  frameColor: "White", handleType: "", lockType: "", unit: "sqft", basePrice: 0, description: "", active: true,
};

function ProductsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.safeGet<Product[]>("/api/products");
      setList(data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter((p) => [p.name, p.code, p.category].some((v) => v?.toLowerCase().includes(s)));
  }, [list, q]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...empty, code: `PRD-${String(list.length + 1).padStart(4, "0")}` });
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({ code: p.code, name: p.name, category: p.category, profileSeries: p.profileSeries || "", glassType: p.glassType || "", glassThickness: p.glassThickness || "", frameColor: p.frameColor || "", handleType: p.handleType || "", lockType: p.lockType || "", unit: p.unit, basePrice: p.basePrice, description: p.description || "", active: p.active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    try {
      if (editingId) {
        await api.put(`/api/products/${editingId}`, { id: editingId, ...form });
        toast.success("Product updated");
      } else {
        await api.post("/api/products", form);
        toast.success("Product added");
      }
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/products/${id}`);
      toast.success("Deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <AppShell
      title="Products"
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="h-8 pl-8 w-64 text-sm" />
          </div>
          {can("products", "create") && (
            <Button size="sm" className="ml-auto" onClick={openNew}><Plus className="size-3.5 mr-1" />New product</Button>
          )}
        </>
      }
    >
      <PageContainer>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Unit</th><th className="text-right">Base price</th><th>Status</th><th className="w-24 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-muted-foreground">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.unit}</td>
                  <td className="text-right tabular-nums font-medium">{currency(p.basePrice)}</td>
                  <td>{p.active
                    ? <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Active</span>
                    : <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] border bg-muted text-muted-foreground border-border">Inactive</span>}
                  </td>
                  <td className="text-right">
                    {can("products", "edit") && <button onClick={() => openEdit(p)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"><Pencil className="size-3.5" /></button>}
                    {can("products", "delete") && <button onClick={() => setDeleteTarget(p.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center"><Trash2 className="size-3.5" /></button>}
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">{loading ? "Loading..." : "No products found"}</td></tr>}
            </tbody>
          </table>
        </div>
      </PageContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label className="text-xs">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{["sqft", "sqm", "pcs", "m"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Profile series</Label><Input value={form.profileSeries} onChange={(e) => setForm({ ...form, profileSeries: e.target.value })} className="h-8" placeholder="e.g. 60mm" /></div>
            <div><Label className="text-xs">Glass type</Label><Input value={form.glassType} onChange={(e) => setForm({ ...form, glassType: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Glass thickness</Label><Input value={form.glassThickness} onChange={(e) => setForm({ ...form, glassThickness: e.target.value })} className="h-8" placeholder="e.g. 5mm" /></div>
            <div><Label className="text-xs">Frame color</Label><Input value={form.frameColor} onChange={(e) => setForm({ ...form, frameColor: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Handle</Label><Input value={form.handleType} onChange={(e) => setForm({ ...form, handleType: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Lock</Label><Input value={form.lockType} onChange={(e) => setForm({ ...form, lockType: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Base price</Label><Input type="number" value={form.basePrice || ""} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} className="h-8" /></div>
            <div className="col-span-3"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <label className="col-span-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete product?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget != null) { remove(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
