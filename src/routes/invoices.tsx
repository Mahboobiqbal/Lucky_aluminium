import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { currency, dateShort, statusLabel, statusColor } from "@/lib/format";
import { Download, Eye, FileText, Printer, Trash2 } from "lucide-react";
import { companyFromSettings } from "@/lib/print";
import { createCustomerInvoicePdf, downloadPdf, printPdf, type CustomerInvoiceData } from "@/lib/pdf";
import { toast } from "sonner";
import { TableActions } from "@/components/layout/TableActions";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Lucky Aluminium" }] }),
  component: InvoicesPage,
});

type Order = { id: number; number: string; customerId: number; customerName: string; orderDate: string; deliveryDate?: string; items: any[]; subtotal: number; discountPercent: number; extraCharges?: number; hardwareCharges?: number; total: number; paid: number; previousBalance?: number; balance?: number; grandTotal?: number; status: string; notes?: string; createdAt: string };
type Customer = { id: number; name: string; mobile?: string; whatsapp?: string; email?: string; address?: string; city?: string };
type Setting = { key: string; value: string };

function InvoicesPage() {
  const { can } = useAuth();
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const company = companyFromSettings(settings);

  const fetchData = useCallback(async () => {
    try {
      const [o, c, s] = await Promise.all([api.safeGet<Order[]>("/api/orders"), api.safeGet<Customer[]>("/api/customers"), api.safeGet<Setting[]>("/api/settings")]);
      setOrders(Array.isArray(o) ? o : []); setCustomers(Array.isArray(c) ? c : []); setSettings(Array.isArray(s) ? s : []);
    } catch { toast.error("Failed to load data"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const findCustomer = (order: Order) => (Array.isArray(customers) ? customers : []).find((c) => c.id === order.customerId);
  const invoiceNumber = (order: Order) => `INV-${String(order.id).padStart(4, "0")}`;

  const buildInvoice = (order: Order, customer?: Customer): CustomerInvoiceData => ({
    invoiceNumber: invoiceNumber(order), orderNumber: order.number, orderDate: new Date(order.orderDate).getTime(),
    deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).getTime() : undefined, status: order.status,
    customer: { name: order.customerName, mobile: customer?.mobile, whatsapp: customer?.whatsapp, email: customer?.email, address: customer?.address, city: customer?.city },
    items: order.items, subtotal: order.subtotal ?? order.total, discountPercent: order.discountPercent ?? 0,
    hardwareCharges: (order as any).hardwareCharges ?? 0, extraCharges: order.extraCharges ?? 0,
    total: order.total, paid: order.paid,
    previousBalance: (order as any).previousBalance ?? 0,
    balance: (order as any).balance ?? Math.max(0, order.total - order.paid),
    grandTotal: order.total + Number((order as any).previousBalance ?? 0),
    notes: order.notes,
  });

  const handleView = (order: Order) => { setSelectedOrder(order); setViewOpen(true); };

  const handleDownload = async (order: Order) => {
    const doc = createCustomerInvoicePdf(buildInvoice(order, findCustomer(order)), company);
    await downloadPdf(doc, `${invoiceNumber(order)}-${order.customerName.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
  };

  const handlePrint = async (order: Order) => {
    const doc = createCustomerInvoicePdf(buildInvoice(order, findCustomer(order)), company);
    await printPdf(doc);
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    try { await api.delete(`/api/invoices/by-order/${deleteTarget}`); toast.success("Invoice deleted"); setDeleteTarget(null); fetchData(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  return (
    <AppShell title="Invoices">
      <PageContainer>
        <TableShell>
          <table className="data-table min-w-[1100px]">
            <thead><tr><th>Invoice #</th><th>Customer</th><th>Order</th><th>Date</th><th className="text-center">Items</th><th>Subtotal</th><th className="text-center">Discount</th><th>Hardware</th><th>Extra</th><th>Total</th><th>Paid</th><th>Balance</th><th>Prev. Balance</th><th>Grand Total</th><th className="text-center whitespace-nowrap">Actions</th></tr></thead>
            <tbody>
              {(Array.isArray(orders) ? orders : []).map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{invoiceNumber(o)}</td>
                  <td>{o.customerName}</td>
                  <td className="text-muted-foreground">{o.number}</td>
                  <td className="text-muted-foreground">{dateShort(o.orderDate)}</td>
                  <td className="text-center">{o.items.length}</td>
                  <td className="tabular-nums">{currency(o.subtotal ?? o.total)}</td>
                  <td className="text-center tabular-nums">{o.discountPercent > 0 ? `${o.discountPercent}%` : "\u2014"}</td>
                  <td className="tabular-nums">{(o as any).hardwareCharges ?? 0 > 0 ? currency((o as any).hardwareCharges ?? 0) : "\u2014"}</td>
                  <td className="tabular-nums">{(o.extraCharges ?? 0) > 0 ? currency(o.extraCharges ?? 0) : "\u2014"}</td>
                  <td className="tabular-nums">{currency(o.total)}</td>
                  <td className="tabular-nums text-emerald-600">{currency(o.paid)}</td>
                  <td className="tabular-nums text-rose-600">{currency((o as any).balance ?? Math.max(0, o.total - o.paid))}</td>
                  <td className="tabular-nums text-blue-600">{Number((o as any).previousBalance ?? 0) > 0 ? currency((o as any).previousBalance) : "\u2014"}</td>
                  <td className="tabular-nums font-semibold">{currency(o.total + Number((o as any).previousBalance ?? 0))}</td>
                  <td>
                    <TableActions>
                      <button onClick={() => handleView(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="View"><Eye className="size-3.5" /></button>
                      {can("invoices", "export") && <button onClick={() => handleDownload(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Download"><Download className="size-3.5" /></button>}
                      {can("invoices", "print") && <button onClick={() => handlePrint(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Print"><Printer className="size-3.5" /></button>}
                      {can("invoices", "delete") && <button onClick={() => setDeleteTarget(o.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete"><Trash2 className="size-3.5" /></button>}
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(Array.isArray(orders) ? orders : []).length && <EmptyState icon={FileText} title={loading ? "Loading..." : "No invoices"} hint={loading ? "Please wait" : "Invoices are generated from orders"} />}
        </TableShell>
      </PageContainer>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice {selectedOrder ? invoiceNumber(selectedOrder) : ""}</DialogTitle></DialogHeader>
          {selectedOrder && (() => {
            const customer = findCustomer(selectedOrder);
            const hw = (selectedOrder as any).hardwareCharges ?? 0;
            const ex = selectedOrder.extraCharges ?? 0;
            const discountAmt = (selectedOrder.subtotal ?? selectedOrder.total) * (selectedOrder.discountPercent ?? 0) / 100;
            const grandTotal = selectedOrder.total + Number((selectedOrder as any).previousBalance ?? 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Customer</div><div className="font-medium mt-1">{selectedOrder.customerName}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Mobile</div><div className="font-medium mt-1">{customer?.mobile || "-"}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Order #</div><div className="font-medium mt-1">{selectedOrder.number}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Order Date</div><div className="font-medium mt-1">{dateShort(selectedOrder.orderDate)}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Delivery Date</div><div className="font-medium mt-1">{selectedOrder.deliveryDate ? dateShort(selectedOrder.deliveryDate) : "-"}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Status</div><div className="mt-1"><Badge variant="outline" className={`text-[11px] ${statusColor[selectedOrder.status]}`}>{statusLabel(selectedOrder.status)}</Badge></div></div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="data-table text-sm w-full">
                    <thead>
                      <tr>
                        <th className="w-8 text-center">#</th>
                        <th>Product</th>
                        <th>Color</th>
                        <th>Size</th>
                        <th>Gaze</th>
                        <th className="w-20 text-center">Type</th>
                        <th className="w-40 text-center">Dimensions</th>
                        <th className="w-16 text-center">Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((it: any, i: number) => {
                        const isLength = it.itemType === "length";
                        return (
                          <tr key={i}>
                            <td className="text-center text-muted-foreground">{i + 1}</td>
                            <td className="font-medium">{it.productName}</td>
                            <td>{it.color || "-"}</td>
                            <td>{it.size || "-"}</td>
                            <td>{it.gaze || "-"}</td>
                            <td className="text-center">{isLength ? "Length-based" : "Window"}</td>
                            <td className="text-center tabular-nums">{isLength ? `${it.length} ft` : `${it.width} x ${it.height} = ${((it.width || 0) * (it.height || 0)).toFixed(2)} sqft`}</td>
                            <td className="text-center">{it.quantity}</td>
                            <td className="tabular-nums">{currency(it.unitPrice)}</td>
                            <td className="font-medium tabular-nums">{currency(it.amount)}</td>
                            <td className="text-xs text-muted-foreground max-w-[140px] truncate">{it.notes || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end"><div className="w-72 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{currency(selectedOrder.subtotal ?? selectedOrder.total)}</span></div>
                  {selectedOrder.discountPercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({selectedOrder.discountPercent}%)</span><span className="tabular-nums text-destructive">-{currency(discountAmt)}</span></div>}
                  {hw > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Hardware Charges</span><span className="tabular-nums">{currency(hw)}</span></div>}
                  {ex > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Extra Charges</span><span className="tabular-nums">{currency(ex)}</span></div>}
                  <div className="flex justify-between border-t pt-1.5"><span className="font-semibold">Order Total</span><span className="font-semibold tabular-nums">{currency(selectedOrder.total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid / Advance</span><span className="tabular-nums text-emerald-600">{currency(selectedOrder.paid)}</span></div>
                  <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">Remaining Balance</span><span className="tabular-nums font-semibold text-rose-600">{currency((selectedOrder as any).balance ?? Math.max(0, selectedOrder.total - selectedOrder.paid))}</span></div>
                  {(Number((selectedOrder as any).previousBalance ?? 0) > 0) && (
                    <>
                      <div className="border-t border-dashed border-border pt-1.5" />
                      <div className="flex justify-between"><span className="text-blue-600">Previous Balance</span><span className="tabular-nums text-blue-600">{currency((selectedOrder as any).previousBalance)}</span></div>
                      <div className="flex justify-between border-t pt-1.5"><span className="font-bold">Grand Total</span><span className="font-bold text-rose-600">{currency(grandTotal)}</span></div>
                    </>
                  )}
                </div></div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete invoice?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
