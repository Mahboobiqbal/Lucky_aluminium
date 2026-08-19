import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildSupplierLedger } from "@/lib/ledger";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { currency, dateShort } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";
import { SupplierList } from "@/components/suppliers/SupplierList";
import { SupplierDashboard, type SupplierTransaction } from "@/components/suppliers/SupplierDashboard";
import { PurchaseInvoice } from "@/components/suppliers/PurchaseInvoice";
import { PaymentReceipt } from "@/components/suppliers/PaymentReceipt";
import { createPaymentReceiptPdf, createPurchaseInvoicePdf, createSupplierStatementPdf, downloadPdf, openPdfPreview, sharePdf, type PurchaseInvoiceData, type PaymentReceiptData, type SupplierStatementData } from "@/lib/pdf";
import { companyFromSettings } from "@/lib/print";

export const Route = createFileRoute("/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Lucky Aluminium" }] }),
  component: SuppliersPage,
});

type Supplier = { id: number; name: string; company?: string; contact: string; mobile?: string; city?: string; email?: string; address?: string; products?: string; notes?: string; createdAt: string };
type Purchase = { id: number; invoiceNumber: string; supplierId: number; supplierName: string;   items: { productName: string; itemType?: string; pricingMode?: string; widthFt?: number; heightFt?: number; length?: number; quantity: number; purchasePrice: number; salePrice: number; amount: number }[]; paymentType: string; totalAmount: number; date: string; notes?: string; createdAt: string };

type PaymentRec = { id: number; invoiceId?: number; supplierId?: number; supplierName?: string; amount: number; method: string; date: string; notes?: string; createdAt: string };
type Setting = { key: string; value: string };

const emptySupplier = { name: "", company: "", contact: "", address: "", products: "", notes: "" };
type PurchaseFormItem = { productName: string; itemType: "window" | "other"; pricingMode: "piece" | "size"; widthFt?: number; heightFt?: number; length: number; quantity: number; purchasePrice: number; salePrice: number; amount: number };

function SuppliersPage() {
  const { can } = useAuth();
  const [list, setList] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<PaymentRec[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [purchaseForm, setPurchaseForm] = useState({ invoiceNumber: "", supplierId: 0, supplierName: "", items: [{ productName: "", itemType: "other" as "window" | "other", widthFt: undefined, heightFt: undefined, length: 0, quantity: 0, purchasePrice: 0, salePrice: 0, amount: 0 }] as PurchaseFormItem[], paymentType: "cash", totalAmount: 0, date: Date.now() });
  const [paymentForm, setPaymentForm] = useState({ supplierId: 0, supplierName: "", amount: 0, method: "cash", date: Date.now(), notes: "" });
  const [purchaseInvoiceOpen, setPurchaseInvoiceOpen] = useState(false);
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<PurchaseInvoiceData | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<PaymentReceiptData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const company = companyFromSettings(settings);

  const fetchData = useCallback(async (supplierId: number | null = null) => {
    try {
      const [s, p, pay, st] = await Promise.all([
        api.safeGet<Supplier[]>("/api/suppliers"),
        api.safeGet<Purchase[]>(supplierId ? `/api/purchases?supplier_id=${supplierId}` : "/api/purchases"),
        api.safeGet<PaymentRec[]>(supplierId ? `/api/payments?supplier_id=${supplierId}` : "/api/payments"),
        api.safeGet<Setting[]>("/api/settings"),
      ]);
      setList(s || []);
      setPurchases(p || []);
      setPayments(pay || []);
      setSettings(st || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(selectedSupplierId); }, [fetchData, selectedSupplierId]);

  const selectedSupplier = useMemo(() => list.find((s) => s.id === selectedSupplierId) ?? null, [list, selectedSupplierId]);
  const supplierPurchases = useMemo(() => purchases.filter((p) => p.supplierId === selectedSupplierId), [purchases, selectedSupplierId]);
  const supplierPayments = useMemo(() => payments.filter((p) => p.supplierId === selectedSupplierId), [payments, selectedSupplierId]);

  const supplierTransactions = useMemo(() => {
    const txns: Omit<SupplierTransaction, "balance">[] = [
      ...supplierPurchases.map((p) => ({ id: p.id, date: new Date(p.date).getTime(), reference: p.invoiceNumber, type: "Purchase", description: `${p.items.length} item${p.items.length === 1 ? "" : "s"} purchase`, amount: p.totalAmount })),
      ...supplierPayments.map((p) => ({ id: p.id, date: new Date(p.date).getTime(), reference: p.invoiceId ? `PAY-${p.invoiceId}` : `PAY-${p.id}`, type: "Payment", description: `${p.method} payment`, amount: p.amount })),
    ];
    let running = 0;
    return txns.sort((a, b) => a.date - b.date || a.reference.localeCompare(b.reference)).map((t) => { running += t.type === "Purchase" ? t.amount : -t.amount; return { ...t, balance: running }; });
  }, [supplierPurchases, supplierPayments]);

  const supplierLedger = useMemo(() => {
    const purchasesForLedger = supplierPurchases.map((p) => ({ ...p, date: new Date(p.date).getTime() }));
    const paymentsForLedger = supplierPayments.map((p) => ({ ...p, date: new Date(p.date).getTime(), invoiceId: (p as any).invoiceId }));
    return buildSupplierLedger(purchasesForLedger as any, paymentsForLedger as any);
  }, [supplierPurchases, supplierPayments]);

  const totalPurchases = supplierPurchases.reduce((s, p) => s + p.totalAmount, 0);
  const totalPayments = supplierPayments.reduce((s, p) => s + p.amount, 0);
  const outstandingBalance = totalPurchases - totalPayments;
  const lastPurchaseDate = supplierPurchases.reduce((latest, p) => Math.max(latest, new Date(p.date).getTime()), 0) || undefined;

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return toast.error("Name required");
    try {
      await api.post("/api/suppliers", supplierForm);
      toast.success("Supplier added");
      setSupplierOpen(false);
      setSupplierForm(emptySupplier);
      void fetchData(selectedSupplierId);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const removeSupplier = async (id: number) => {
    try {
      await api.delete(`/api/suppliers/${id}`);
      if (selectedSupplierId === id) { setSelectedSupplierId(null); setShowStatement(false); }
      toast.success("Supplier deleted");
      void fetchData(null);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const openPurchase = (supplierId?: number) => {
    const supplier = supplierId ? list.find((s) => s.id === supplierId) : undefined;
    setPurchaseForm({ invoiceNumber: `PUR-${String(purchases.length + 1).padStart(4, "0")}`, supplierId: supplier?.id ?? 0, supplierName: supplier?.name ?? "", items: [{ productName: "", itemType: "other", pricingMode: "piece", widthFt: undefined, heightFt: undefined, length: 0, quantity: 0, purchasePrice: 0, salePrice: 0, amount: 0 }] as PurchaseFormItem[], paymentType: "cash", totalAmount: 0, date: Date.now() });
    setPurchaseOpen(true);
  };

  const openPayment = () => {
    if (!selectedSupplier) return toast.error("Select a supplier first");
    setPaymentForm({ supplierId: selectedSupplier.id, supplierName: selectedSupplier.name, amount: 0, method: "cash", date: Date.now(), notes: "" });
    setPaymentOpen(true);
  };

  const updatePurchaseItem = (index: number, field: string, value: any) => {
    const items = [...purchaseForm.items];
    items[index] = { ...items[index], [field]: value };
    const calcAmount = (i: PurchaseFormItem) => {
      const dim = i.itemType === "window" ? (i.length || 0) : (i.widthFt || 0) * (i.heightFt || 0);
      return i.pricingMode === "size" && dim ? dim * i.quantity * i.purchasePrice : i.quantity * i.purchasePrice;
    };
    if (["quantity", "purchasePrice", "pricingMode", "length", "widthFt", "heightFt", "itemType"].includes(field)) {
      items[index].amount = calcAmount(items[index]);
    }
    setPurchaseForm({ ...purchaseForm, items, totalAmount: items.reduce((s, i) => s + i.amount, 0) });
  };

  const syncProductsFromPurchase = async (invoiceNumber: string, supplierName: string) => {
    try {
      const products = await api.safeGet<any[]>("/api/products");
      for (const item of purchaseForm.items) {
        if (!item.productName?.trim()) continue;
        const normalized = item.productName.trim().toLowerCase();
        const existing = products?.find((p) => p.name?.trim().toLowerCase() === normalized);
        const payload = {
          id: existing?.id,
          code: existing?.code || `PRD-${String((products?.length || 0) + 1).padStart(4, "0")}`,
          name: item.productName.trim(),
          category: "Purchased",
          openingType: existing?.openingType || "",
          profileSeries: existing?.profileSeries || "",
          glassType: existing?.glassType || "",
          glassThickness: existing?.glassThickness || "",
          frameColor: existing?.frameColor || "",
          handleType: existing?.handleType || "",
          lockType: existing?.lockType || "",
          unit: existing?.unit || "pcs",
          basePrice: item.salePrice > 0 ? item.salePrice : (existing?.basePrice || item.purchasePrice || 0),
          description: existing?.description
            ? `${existing.description} | Purchase ${invoiceNumber}`
            : `Added from purchase ${invoiceNumber} (${supplierName})`,
          active: existing?.active !== false,
        };

        if (existing?.id) {
          await api.put(`/api/products/${existing.id}`, payload);
        } else {
          await api.post("/api/products", payload);
        }
      }
    } catch {}
  };

  const savePurchase = async () => {
    if (!purchaseForm.invoiceNumber.trim()) return toast.error("Invoice number required");
    if (!purchaseForm.supplierName.trim()) return toast.error("Supplier required");
    if (!purchaseForm.items[0]?.productName) return toast.error("At least one product required");
    try {
      const result = await api.post<{ id: number }>("/api/purchases", {
        invoiceNumber: purchaseForm.invoiceNumber, supplierId: purchaseForm.supplierId, supplierName: purchaseForm.supplierName,
        items: purchaseForm.items, paymentType: purchaseForm.paymentType, totalAmount: purchaseForm.totalAmount,
        date: new Date(purchaseForm.date).toISOString(),
      });
      await syncProductsFromPurchase(purchaseForm.invoiceNumber, purchaseForm.supplierName);

      const supplier = list.find((s) => s.id === purchaseForm.supplierId);
      if (supplier) {
        setPreviewInvoice({ invoiceNumber: purchaseForm.invoiceNumber, date: purchaseForm.date, supplier: { name: supplier.name, company: supplier.company, contact: supplier.contact, address: supplier.address }, items: purchaseForm.items.map((i) => ({ productName: i.productName, quantity: i.quantity, purchasePrice: i.purchasePrice, amount: i.amount })), paymentType: purchaseForm.paymentType, subtotal: purchaseForm.totalAmount, totalQuantity: purchaseForm.items.reduce((s, i) => s + i.quantity, 0), outstandingBalance: totalPurchases + purchaseForm.totalAmount - totalPayments });
        setPurchaseInvoiceOpen(true);
      }
      toast.success("Purchase added");
      setPurchaseOpen(false);
      void fetchData(purchaseForm.supplierId || selectedSupplierId);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const savePayment = async () => {
    if (!paymentForm.supplierId) return toast.error("Supplier required");
    if (!paymentForm.amount || paymentForm.amount <= 0) return toast.error("Amount required");
    try {
      const result = await api.post<{ id: number }>("/api/payments", { supplierId: paymentForm.supplierId, supplierName: paymentForm.supplierName, amount: paymentForm.amount, method: paymentForm.method, date: new Date(paymentForm.date).toISOString(), notes: paymentForm.notes });
      const supplier = list.find((s) => s.id === paymentForm.supplierId);
      if (supplier) {
        setPreviewReceipt({ receiptNumber: `RCPT-${result.id}`, paymentDate: paymentForm.date, method: paymentForm.method, amountPaid: paymentForm.amount, previousBalance: outstandingBalance, remainingBalance: outstandingBalance - paymentForm.amount, notes: paymentForm.notes, supplier: { name: supplier.name, company: supplier.company, contact: supplier.contact, address: supplier.address } });
        setPaymentReceiptOpen(true);
      }
      toast.success("Payment recorded");
      setPaymentOpen(false);
      setShowStatement(false);
      void fetchData(paymentForm.supplierId || selectedSupplierId);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const selectSupplier = (id: number) => { setSelectedSupplierId(id); setShowStatement(false); };
  const goBack = () => { setSelectedSupplierId(null); setShowStatement(false); };
  const exportPdf = async () => {
    if (!selectedSupplier) return;
    const statement: SupplierStatementData = { statementDate: Date.now(), openingBalance: supplierLedger[0]?.balance ?? 0, totalPurchases, totalPayments, outstandingBalance, closingBalance: supplierLedger[supplierLedger.length - 1]?.balance ?? 0, supplier: { name: selectedSupplier.name, company: selectedSupplier.company, contact: selectedSupplier.contact, address: selectedSupplier.address }, rows: supplierLedger };
    const doc = createSupplierStatementPdf(statement, company);
    await downloadPdf(doc, `${selectedSupplier.name.replace(/\s+/g, "-")}-statement.pdf`);
  };

  return (
    <AppShell title="Suppliers" actions={
      <div className="ml-auto flex gap-2">
        {!selectedSupplier && can("purchase", "create") && <Button size="sm" onClick={() => openPurchase()}><ShoppingCart className="size-3.5 mr-1" />New Purchase</Button>}
        {can("suppliers", "create") && <Button size="sm" onClick={() => setSupplierOpen(true)}><Plus className="size-3.5 mr-1" />New Supplier</Button>}
      </div>
    }>
      <PageContainer>
        {selectedSupplier ? (
          <SupplierDashboard supplier={selectedSupplier as any} transactions={supplierTransactions} ledgerEntries={supplierLedger} totalPurchases={totalPurchases} totalPayments={totalPayments} outstandingBalance={outstandingBalance} lastPurchaseDate={lastPurchaseDate} showStatement={showStatement} onBack={goBack} onNewPurchase={() => openPurchase(selectedSupplier.id)} onMakePayment={openPayment} onViewHistory={() => { setShowStatement(false); setTimeout(() => document.getElementById("transaction-history")?.scrollIntoView({ behavior: "smooth" }), 100); }} onGenerateStatement={() => { setShowStatement(true); setTimeout(() => document.getElementById("supplier-statement")?.scrollIntoView({ behavior: "smooth" }), 100); }} onExportPdf={exportPdf} purchases={supplierPurchases as any} company={company} />
        ) : (
          <SupplierList suppliers={list as any} selectedSupplierId={selectedSupplierId ?? undefined} onSelect={selectSupplier} onRemove={can("suppliers", "delete") ? setDeleteTarget : (() => {})} />
        )}
        {previewInvoice && <Dialog open={purchaseInvoiceOpen} onOpenChange={setPurchaseInvoiceOpen}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Purchase Invoice Preview</DialogTitle></DialogHeader><PurchaseInvoice invoice={previewInvoice} onPrint={async () => { const doc = createPurchaseInvoicePdf(previewInvoice, company); await openPdfPreview(doc); }} onDownload={async () => { const doc = createPurchaseInvoicePdf(previewInvoice, company); await downloadPdf(doc, `${previewInvoice.invoiceNumber}-invoice.pdf`); }} onShare={async () => { const doc = createPurchaseInvoicePdf(previewInvoice, company); await sharePdf(doc, `${previewInvoice.invoiceNumber}-invoice.pdf`); }} /></DialogContent></Dialog>}
        {previewReceipt && <Dialog open={paymentReceiptOpen} onOpenChange={setPaymentReceiptOpen}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Payment Receipt Preview</DialogTitle></DialogHeader><PaymentReceipt receipt={previewReceipt} onPrint={async () => { const doc = createPaymentReceiptPdf(previewReceipt, company); await openPdfPreview(doc); }} onDownload={async () => { const doc = createPaymentReceiptPdf(previewReceipt, company); await downloadPdf(doc, `${previewReceipt.receiptNumber}-receipt.pdf`); }} onShare={async () => { const doc = createPaymentReceiptPdf(previewReceipt, company); await sharePdf(doc, `${previewReceipt.receiptNumber}-receipt.pdf`); }} /></DialogContent></Dialog>}
      </PageContainer>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Company</Label><Input value={supplierForm.company} onChange={(e) => setSupplierForm({ ...supplierForm, company: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Contact</Label><Input value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Products</Label><Input value={supplierForm.products} onChange={(e) => setSupplierForm({ ...supplierForm, products: e.target.value })} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} className="h-8" /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setSupplierOpen(false)}>Cancel</Button><Button size="sm" onClick={saveSupplier}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Invoice Number *</Label><Input value={purchaseForm.invoiceNumber} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })} className="h-8" /></div>
              <div><Label className="text-xs">Supplier *</Label><Select value={purchaseForm.supplierId ? String(purchaseForm.supplierId) : ""} onValueChange={(v) => { const s = list.find((x) => x.id === Number(v)); setPurchaseForm({ ...purchaseForm, supplierId: Number(v), supplierName: s?.name || "" }); }}><SelectTrigger className="h-8"><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{list.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <DateField label="Date" value={purchaseForm.date} onChange={(v) => setPurchaseForm({ ...purchaseForm, date: v })} />
              <div><Label className="text-xs">Payment Type</Label><select value={purchaseForm.paymentType} onChange={(e) => setPurchaseForm({ ...purchaseForm, paymentType: e.target.value })} className="h-9 px-2 rounded-lg border border-border bg-background text-sm w-full"><option value="cash">Cash</option><option value="credit">Credit</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank Transfer</option></select></div>
            </div>
            <div className="border rounded-md">
              <div className="bg-muted/50 px-4 py-2 border-b"><div className="text-sm font-semibold">Products</div></div>
              <div className="divide-y">
                {purchaseForm.items.map((item, idx) => {
                  const isWindow = item.itemType === "window";
                  return (
                    <div key={idx} className="p-3 space-y-2">
                      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isWindow ? "xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"} gap-2 items-end`}>
                        <div><Label className="text-xs">Product</Label><Input value={item.productName} onChange={(e) => updatePurchaseItem(idx, "productName", e.target.value)} className="h-8" /></div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select value={item.itemType || "other"} onValueChange={(v) => updatePurchaseItem(idx, "itemType", v)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="window">Window</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Price Mode</Label>
                          <Select value={item.pricingMode || "piece"} onValueChange={(v) => updatePurchaseItem(idx, "pricingMode", v)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="piece">Per Piece</SelectItem>
                              <SelectItem value="size">Per Size</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isWindow ? (
                          <div><Label className="text-xs">Length (ft)</Label><Input type="number" value={item.length || ""} onChange={(e) => updatePurchaseItem(idx, "length", Number(e.target.value))} className="h-8" min="0" step="0.01" /></div>
                        ) : (
                          <>
                            <div><Label className="text-xs">W (ft)</Label><Input type="number" value={item.widthFt || ""} onChange={(e) => updatePurchaseItem(idx, "widthFt", e.target.value === "" ? undefined : Number(e.target.value))} className="h-8" min="0" step="0.01" /></div>
                            <div><Label className="text-xs">H (ft)</Label><Input type="number" value={item.heightFt || ""} onChange={(e) => updatePurchaseItem(idx, "heightFt", e.target.value === "" ? undefined : Number(e.target.value))} className="h-8" min="0" step="0.01" /></div>
                          </>
                        )}
                        <div><Label className="text-xs">Qty</Label><Input type="number" value={item.quantity || ""} onChange={(e) => updatePurchaseItem(idx, "quantity", Number(e.target.value))} className="h-8" min="1" /></div>
                        <div><Label className="text-xs">{item.pricingMode === "size" ? (isWindow ? "Price / ft" : "Price / sqft") : "Price / pc"}</Label><Input type="number" value={item.purchasePrice || ""} onChange={(e) => updatePurchaseItem(idx, "purchasePrice", Number(e.target.value))} className="h-8" step="0.01" /></div>
                        <div><Label className="text-xs">Sale Price</Label><Input type="number" value={item.salePrice || ""} onChange={(e) => updatePurchaseItem(idx, "salePrice", Number(e.target.value))} className="h-8" step="0.01" /></div>
                        <div><Label className="text-xs">Amount</Label><div className="h-8 px-2 rounded border bg-muted/50 flex items-center text-sm font-medium">{currency(item.amount)}</div>{purchaseForm.items.length > 1 && <Button variant="ghost" size="sm" onClick={() => { const items = purchaseForm.items.filter((_, i) => i !== idx); setPurchaseForm({ ...purchaseForm, items, totalAmount: items.reduce((s, i) => s + i.amount, 0) }); }} className="mt-2 h-6 w-full text-destructive">Remove</Button>}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t"><Button variant="outline" size="sm" onClick={() => setPurchaseForm({ ...purchaseForm, items: [...purchaseForm.items, { productName: "", itemType: "other", pricingMode: "piece", widthFt: undefined, heightFt: undefined, length: 0, quantity: 0, purchasePrice: 0, salePrice: 0, amount: 0 } as PurchaseFormItem] })} className="w-full"><Plus className="size-3.5 mr-1" />Add Product</Button></div>
            </div>
            <div className="flex justify-end pt-4 border-t"><div className="flex items-center justify-between w-64"><span className="font-semibold">Total:</span><span className="text-lg font-bold text-primary">{currency(purchaseForm.totalAmount)}</span></div></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setPurchaseOpen(false)}>Cancel</Button><Button size="sm" onClick={savePurchase}>Save Purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Supplier Payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Supplier</Label><Input value={selectedSupplier?.name ?? paymentForm.supplierName} disabled className="h-8" /></div>
            <div><Label className="text-xs">Amount</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} className="h-8" min="0" step="0.01" /></div>
              <div><Label className="text-xs">Method</Label><select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="h-9 px-2 rounded-lg border border-border bg-background text-sm w-full"><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank Transfer</option><option value="online">Online</option></select></div>
            <div><DateField label="Payment Date" value={paymentForm.date} onChange={(v) => setPaymentForm({ ...paymentForm, date: v })} /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="h-8" /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button size="sm" onClick={savePayment}>Save Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete supplier?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget != null) { removeSupplier(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
