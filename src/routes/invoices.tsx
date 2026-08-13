import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { currency, dateShort, statusLabel, statusColor } from "@/lib/format";
import { Download, Eye, Printer, Trash2 } from "lucide-react";
import { companyFromSettings } from "@/lib/print";
import { createCustomerInvoicePdf, downloadPdf, printPdf, type CustomerInvoiceData } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "Invoices — UDYANA" }] }),
  component: InvoicesPage,
});

type Order = { id: number; number: string; customerId: number; customerName: string; orderDate: string; deliveryDate?: string; items: any[]; subtotal: number; discountPercent: number; total: number; paid: number; status: string; notes?: string; createdAt: string };
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
      setOrders(o || []); setCustomers(c || []); setSettings(s || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const findCustomer = (order: Order) => customers.find((c) => c.id === order.customerId);
  const invoiceNumber = (order: Order) => `INV-${String(order.id).padStart(4, "0")}`;

  const buildInvoice = (order: Order, customer?: Customer): CustomerInvoiceData => ({
    invoiceNumber: invoiceNumber(order), orderNumber: order.number, orderDate: new Date(order.orderDate).getTime(),
    deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).getTime() : undefined, status: order.status,
    customer: { name: order.customerName, mobile: customer?.mobile, whatsapp: customer?.whatsapp, email: customer?.email, address: customer?.address, city: customer?.city },
    items: order.items, subtotal: order.subtotal ?? order.total, discountPercent: order.discountPercent ?? 0, total: order.total, paid: order.paid, balance: Math.max(0, order.total - order.paid), notes: order.notes,
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
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Invoice #</th><th>Customer</th><th>Order</th><th>Date</th><th>Items</th><th className="text-center">Total</th><th className="text-center">Paid</th><th className="text-center">Balance</th><th className="w-28 text-right">Actions</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{invoiceNumber(o)}</td>
                  <td>{o.customerName}</td>
                  <td className="text-muted-foreground">{o.number}</td>
                  <td className="text-muted-foreground">{dateShort(o.orderDate)}</td>
                  <td>{o.items.length}</td>
                  <td className="text-center tabular-nums">{currency(o.total)}</td>
                  <td className="text-center tabular-nums text-emerald-600">{currency(o.paid)}</td>
                  <td className="text-center tabular-nums text-rose-600">{currency(Math.max(0, o.total - o.paid))}</td>
                  <td className="text-right">
                    <button onClick={() => handleView(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="View"><Eye className="size-3.5" /></button>
                    {can("invoices", "export") && <button onClick={() => handleDownload(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Download"><Download className="size-3.5" /></button>}
                    {can("invoices", "print") && <button onClick={() => handlePrint(o)} className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center" title="Print"><Printer className="size-3.5" /></button>}
                    {can("invoices", "delete") && <button onClick={() => setDeleteTarget(o.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete"><Trash2 className="size-3.5" /></button>}
                  </td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">{loading ? "Loading..." : "No invoices"}</td></tr>}
            </tbody>
          </table>
        </div>
      </PageContainer>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice {selectedOrder ? invoiceNumber(selectedOrder) : ""}</DialogTitle></DialogHeader>
          {selectedOrder && (() => {
            const customer = findCustomer(selectedOrder);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Customer</div><div className="font-medium mt-1">{selectedOrder.customerName}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Mobile</div><div className="font-medium mt-1">{customer?.mobile || "-"}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Order #</div><div className="font-medium mt-1">{selectedOrder.number}</div></div>
                  <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">Status</div><div className="mt-1"><Badge variant="outline" className={`text-[11px] ${statusColor[selectedOrder.status]}`}>{statusLabel(selectedOrder.status)}</Badge></div></div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="data-table text-sm w-full">
                    <thead>
                      <tr>
                        <th className="w-8 text-center">#</th>
                        <th>Product</th>
                        <th className="w-20 text-center">Type</th>
                        <th className="w-40 text-center">Dimensions</th>
                        <th className="w-16 text-center">Qty</th>
                        <th className="w-28 text-right">Rate</th>
                        <th className="w-28 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((it: any, i: number) => {
                        const isWindow = it.itemType === "window";
                        return (
                          <tr key={i}>
                            <td className="text-center text-muted-foreground">{i + 1}</td>
                            <td className="font-medium">{it.productName}</td>
                            <td className="text-center">{isWindow ? "Window" : "Other"}</td>
                            <td className="text-center tabular-nums">{isWindow ? `${it.length} ft` : `${it.width} × ${it.height} = ${((it.width || 0) * (it.height || 0)).toFixed(2)} sq ft`}</td>
                            <td className="text-center">{it.quantity}</td>
                            <td className="text-right tabular-nums">{currency(it.unitPrice)}</td>
                            <td className="text-right font-medium tabular-nums">{currency(it.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end"><div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{currency(selectedOrder.total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-medium text-emerald-600">{currency(selectedOrder.paid)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="font-semibold">Balance</span><span className="font-semibold text-rose-600">{currency(Math.max(0, selectedOrder.total - selectedOrder.paid))}</span></div>
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
