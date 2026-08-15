import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { currency, dateShort, statusColor, statusLabel } from "@/lib/format";
import { createQuotationPdf, downloadQuotationPdf, printQuotationPdf, viewQuotationPdf } from "@/lib/quotations-pdf";
import { companyFromSettings, phoneDisplay } from "@/lib/print";
import { APP_LOGO_URL } from "@/lib/brand";

export const Route = createFileRoute("/quotations")({
  head: () => ({ meta: [{ title: "Quotations — UDYANA" }] }),
  component: QuotationsPage,
});

type QuotationItem = {
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

type Quotation = {
  id: number;
  number: string;
  customerId: number;
  customerName: string;
  date: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  extraCharges: number;
  total: number;
  status: string;
  notes?: string;
  createdAt: string;
};

type Setting = { key: string; value: string };

function QuotationsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [extra, setExtra] = useState(0);
  const [items, setItems] = useState<QuotationItem[]>([]);

  const [list, setList] = useState<Quotation[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const company = companyFromSettings(settings);

  const fetchData = useCallback(async () => {
    try {
      const [quotations, settingsData] = await Promise.all([
        api.safeGet<Quotation[]>("/api/quotations"),
        api.safeGet<Setting[]>("/api/settings"),
      ]);
      setList(quotations || []);
      setSettings(settingsData || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(
    () => list.filter((x) => !q || [x.number, x.customerName].some((v) => v.toLowerCase().includes(q.toLowerCase()))),
    [list, q],
  );

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discountAmount = subtotal * discount / 100;
  const total = Math.max(0, subtotal - discountAmount + extra);

  const addItem = () => setItems([...items, { productName: "", itemType: "other", width: 0, height: 0, length: 0, sqft: 0, quantity: 1, unitPrice: 0, amount: 0, notes: "" }]);
  const updateItem = (i: number, patch: Partial<QuotationItem>) => {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      if (next.itemType === "window") {
        next.amount = Number((next.length * next.quantity * next.unitPrice).toFixed(2));
      } else {
        const w = next.width || 0;
        const h = next.height || 0;
        const s = next.sqft || 0;
        const area = s > 0 ? s : w * h;
        next.amount = Number((area * next.quantity * next.unitPrice).toFixed(2));
      }
      return next;
    }));
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const reset = () => { setEditingId(null); setCustomerName(""); setDiscount(0); setExtra(0); setItems([]); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (qt: Quotation) => {
    setEditingId(qt.id);
    setCustomerName(qt.customerName);
    setDiscount(qt.discount);
    setExtra(qt.extraCharges);
    setItems(qt.items.map((it) => ({ ...it })));
    setOpen(true);
  };

  const handlePdfAction = (qt: Quotation, action: "view" | "download" | "print") => {
    const doc = createQuotationPdf(qt as any, company);
    if (action === "view") viewQuotationPdf(doc);
    else if (action === "download") downloadQuotationPdf(doc, `${qt.number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`);
    else printQuotationPdf(doc);
  };

  const save = async () => {
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (!items.length) return toast.error("Add at least one item");
    try {
      if (editingId) {
        await api.put(`/api/quotations/${editingId}`, {
          id: editingId,
          number: list.find((x) => x.id === editingId)?.number || "",
          customerId: 0,
          customerName: customerName.trim(),
          date: list.find((x) => x.id === editingId)?.date || new Date().toISOString(),
          items, subtotal, discount, extraCharges: extra, total, status: "draft", notes: "",
        });
        toast.success("Quotation updated");
      } else {
        await api.post("/api/quotations", {
          number: `QT-${String(list.length + 1).padStart(4, "0")}`,
          customerId: 0,
          customerName: customerName.trim(),
          date: new Date().toISOString(),
          items, subtotal, discount, extraCharges: extra, total, status: "draft", notes: "",
        });
        toast.success("Quotation created");
      }
      setOpen(false);
      reset();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    try {
      await api.delete(`/api/quotations/${deleteTarget}`);
      toast.success("Quotation deleted");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const inputClass = "h-9 bg-background border-input text-foreground placeholder:text-muted-foreground text-sm font-medium tabular-nums";

  return (
    <AppShell
      title="Quotations"
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quotations..." className="h-8 pl-8 w-64 text-sm" />
          </div>
          {can("quotations", "create") && (
            <Button size="sm" className="ml-auto" onClick={openNew}>
              <Plus className="size-3.5 mr-1" />New quotation
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
                <th>Quote #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th className="text-right whitespace-nowrap">Subtotal</th>
                <th className="text-center whitespace-nowrap">Discount</th>
                <th className="text-right whitespace-nowrap">Total</th>
                <th>Status</th>
                <th className="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((qt) => (
                <tr key={qt.id}>
                  <td>
                    <button onClick={() => handlePdfAction(qt, "view")} className="font-medium text-primary hover:underline" title="View quotation">
                      {qt.number}
                    </button>
                  </td>
                  <td>{qt.customerName}</td>
                  <td className="text-muted-foreground">{dateShort(qt.date)}</td>
                  <td>{qt.items.length}</td>
                  <td className="text-right tabular-nums whitespace-nowrap">{currency(qt.subtotal)}</td>
                  <td className="text-center tabular-nums whitespace-nowrap">{qt.discount > 0 ? `${qt.discount}%` : "-"}</td>
                  <td className="text-right tabular-nums font-semibold whitespace-nowrap">{currency(qt.total)}</td>
                  <td><span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] border ${statusColor[qt.status]}`}>{statusLabel(qt.status)}</span></td>
                  <td className="text-right">
                    {can("quotations", "edit") && (
                      <button onClick={() => openEdit(qt)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {can("quotations", "export") && (
                      <button onClick={() => handlePdfAction(qt, "download")} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Download PDF">
                        <Download className="size-3.5" />
                      </button>
                    )}
                    {can("quotations", "print") && (
                      <button onClick={() => handlePdfAction(qt, "print")} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Print">
                        <Printer className="size-3.5" />
                      </button>
                    )}
                    {can("quotations", "delete") && (
                      <button onClick={() => setDeleteTarget(qt.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">{loading ? "Loading..." : "No quotations yet"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-6xl max-h-[88vh] overflow-y-auto p-0">
          <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={APP_LOGO_URL} alt="Logo" className="size-7 object-contain brightness-0 invert" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div>
                <div className="text-base font-bold tracking-tight">{company?.companyName || "UDYANA uPVC Works"}</div>
                <div className="text-[10px] text-primary-foreground/60 leading-tight">
                  {company?.address && <div>{company.address}</div>}
                  <div>{[phoneDisplay(company), company?.email].filter(Boolean).join(" | ")}</div>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold tracking-wide">QUOTATION</div>
              <div className="text-[10px] text-primary-foreground/60 mt-0.5 leading-relaxed">
                <div>Reference: {editingId ? list.find((x) => x.id === editingId)?.number : `QT-${String(list.length + 1).padStart(4, "0")}`}</div>
                <div>Date: {editingId ? dateShort(list.find((x) => x.id === editingId)?.date) : dateShort(new Date().toISOString())}</div>
              </div>
            </div>
          </div>

          <div className="px-6 pt-4 pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bill To</div>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" className="h-9 text-base font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none" />
                </div>
              </div>
                <Badge variant="outline" className="text-xs px-3 py-1 border-border text-muted-foreground bg-muted/50">Draft</Badge>
            </div>
          </div>

          <Separator className="mx-6 w-auto" />

          <div className="px-6 pt-3 pb-1 space-y-3">
            {items.map((it, i) => {
              const isWindow = it.itemType === "window";
              const s = it.sqft || 0;
              const sqftVal = s > 0 ? s : (it.width || 0) * (it.height || 0);
              const measTotal = isWindow ? it.length * (it.quantity || 1) : sqftVal * (it.quantity || 1);
              return (
                <div key={i} className="border border-border rounded-md bg-card">
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${isWindow ? "xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"} gap-1.5 p-2 items-end`}>
                    <div><Label className="text-[10px]">Product</Label><Input className={inputClass} type="text" value={it.productName} onChange={(e) => updateItem(i, { productName: e.target.value })} placeholder="Product name" /></div>
                    <div>
                      <Label className="text-[10px]">Type</Label>
                      <Select value={it.itemType || "other"} onValueChange={(v) => updateItem(i, { itemType: v as "window" | "other" })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="window">Window</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {isWindow ? (
                      <div><Label className="text-[10px]">Length (ft)</Label><Input className={inputClass} type="number" value={it.length || ""} onChange={(e) => updateItem(i, { length: Number(e.target.value) })} /></div>
                    ) : (
                      <>
                        <div><Label className="text-[10px]">W</Label><Input className={inputClass} type="number" value={it.width || ""} onChange={(e) => updateItem(i, { width: Number(e.target.value) })} /></div>
                        <div><Label className="text-[10px]">H</Label><Input className={inputClass} type="number" value={it.height || ""} onChange={(e) => updateItem(i, { height: Number(e.target.value) })} /></div>
                        <div><Label className="text-[10px]">Sq Ft</Label><Input className={inputClass} type="number" value={it.sqft || ""} onChange={(e) => updateItem(i, { sqft: Number(e.target.value) })} /></div>
                      </>
                    )}
                    <div><Label className="text-[10px]">Meas.</Label><div className="h-8 px-2 rounded border bg-muted/30 flex items-center text-sm font-semibold tabular-nums">{measTotal.toFixed(2)}</div></div>
                    <div><Label className="text-[10px]">Qty</Label><Input className={inputClass} type="number" value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Rate</Label><Input className={inputClass} type="number" value={it.unitPrice || ""} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Amount</Label><div className="h-8 px-2 rounded border bg-muted/30 flex items-center text-sm font-semibold tabular-nums">{currency(it.amount)}</div></div>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-1.5 text-destructive" onClick={() => removeItem(i)} disabled={items.length === 1} title="Remove item"><Trash2 className="size-3.5" /></Button>
                  </div>
                  <div className="px-2 pb-2"><Label className="text-[10px]">Description</Label><Input className={inputClass} type="text" value={it.notes ?? ""} onChange={(e) => updateItem(i, { notes: e.target.value })} placeholder="Item description, specs, color, etc." /></div>
                </div>
              );
            })}
            {!items.length && <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border rounded-md">No items — click "Add item"</div>}
            <div><Button variant="outline" size="sm" onClick={addItem}><Plus className="size-3.5 mr-1" />Add item</Button></div>
          </div>

          <Separator className="mx-6 w-auto" />

            <div className="px-6 pt-3 pb-4 flex justify-end">
            <div className="w-72 space-y-1">
              <div className="flex justify-between items-center py-1.5 text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums font-medium">{currency(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between items-center py-1.5 text-sm"><span className="text-muted-foreground">Discount ({discount}%)</span><span className="tabular-nums text-destructive">− {currency(discountAmount)}</span></div>}
              <div className="flex justify-between items-center py-1.5 text-sm"><span className="text-muted-foreground">Extra Charges</span><span className="tabular-nums font-medium">{currency(extra)}</span></div>
              <Separator />
              <div className="flex justify-between items-center py-2"><span className="text-base font-bold">Grand Total</span><span className="text-lg font-bold tabular-nums text-destructive">{currency(total)}</span></div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div><Label className="text-[10px] text-muted-foreground">Discount %</Label><Input type="number" min="0" max="100" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} className="h-7 text-xs" /></div>
                <div><Label className="text-[10px] text-muted-foreground">Extra charges</Label><Input type="number" value={extra || ""} onChange={(e) => setExtra(Number(e.target.value))} className="h-7 text-xs" /></div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-4 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save quotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this quotation? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
