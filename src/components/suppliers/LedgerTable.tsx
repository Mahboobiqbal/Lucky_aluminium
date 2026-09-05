import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currency, dateShort } from "@/lib/format";
import { createPurchaseInvoicePdf, downloadPdf, printPdf, openPdfPreview, sharePdf, type PurchaseInvoiceData } from "@/lib/pdf";
import type { CompanyProfile } from "@/lib/print";
import type { Purchase, Supplier } from "@/lib/db";
import type { LedgerEntry } from "@/lib/ledger";
import { Download, Printer, ShoppingCart, CreditCard, Eye } from "lucide-react";
import { toast } from "sonner";
import { PurchaseInvoice } from "@/components/suppliers/PurchaseInvoice";
import { TableActions } from "@/components/layout/TableActions";

export function LedgerTable({
  rows,
  title,
  purchases,
  supplier,
  company,
  outstandingBalance,
}: {
  rows: LedgerEntry[];
  title: string;
  purchases: Purchase[];
  supplier: Supplier;
  company: CompanyProfile;
  outstandingBalance: number;
}) {
  const [viewPurchase, setViewPurchase] = useState<PurchaseInvoiceData | null>(null);

  const buildInvoiceData = (purchase: Purchase): PurchaseInvoiceData => ({
    invoiceNumber: purchase.invoiceNumber,
    date: new Date(purchase.date).getTime(),
    supplier: {
      name: supplier.name,
      company: supplier.company,
      contact: supplier.contact,
      address: supplier.address,
    },
    items: purchase.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      amount: item.amount,
    })),
    paymentType: purchase.paymentType,
    subtotal: purchase.totalAmount,
    totalQuantity: purchase.items.reduce((sum, item) => sum + item.quantity, 0),
    outstandingBalance,
  });

  const handleInvoiceAction = async (purchase: Purchase, mode: "pdf" | "print") => {
    const doc = createPurchaseInvoicePdf(buildInvoiceData(purchase), company);
    if (mode === "pdf") {
      await downloadPdf(doc, `${purchase.invoiceNumber}.pdf`);
      toast.success("Invoice saved as PDF");
    } else {
      await printPdf(doc);
      toast.success("Invoice print started");
    }
  };

  const handleView = (purchase: Purchase) => {
    setViewPurchase(buildInvoiceData(purchase));
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <CreditCard className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            <div className="text-[11px] text-muted-foreground">
              Purchases (debit) + Payments (credit) = Running Balance
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Type</th>
              <th>Description</th>
              <th>Debit (Purchase)</th>
              <th>Credit (Payment)</th>
              <th>Running Balance</th>
              <th className="text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const purchase = row.type === "Purchase" ? purchases.find((item) => item.id === row.id) : undefined;
              const isPurchase = row.type === "Purchase";
              return (
                <tr key={`${row.reference}-${index}`} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground">{row.date ? dateShort(row.date) : "Opening"}</td>
                  <td className="font-medium">{row.reference}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${isPurchase ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                      {isPurchase ? <ShoppingCart className="size-3" /> : <CreditCard className="size-3" />}
                      {row.type}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{row.description}</td>
                  <td className="tabular-nums">{row.debit ? currency(row.debit) : ""}</td>
                  <td className="tabular-nums">{row.credit ? currency(row.credit) : ""}</td>
                  <td className="tabular-nums font-semibold">{currency(row.balance)}</td>
                  <td>
                    {purchase ? (
                      <TableActions justify="end">
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleView(purchase)} className="h-7 px-2">
                          <Eye className="size-3.5 mr-1" />View
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void handleInvoiceAction(purchase, "pdf")} className="h-7 px-2">
                          <Download className="size-3.5" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void handleInvoiceAction(purchase, "print")} className="h-7 px-2">
                          <Printer className="size-3.5" />
                        </Button>
                      </TableActions>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  No ledger entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewPurchase && (
        <Dialog open={!!viewPurchase} onOpenChange={(open) => !open && setViewPurchase(null)}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Invoice — {viewPurchase.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <PurchaseInvoice
              invoice={viewPurchase}
              onPrint={async () => { const doc = createPurchaseInvoicePdf(viewPurchase, company); await openPdfPreview(doc); }}
              onDownload={async () => { const doc = createPurchaseInvoicePdf(viewPurchase, company); await downloadPdf(doc, `${viewPurchase.invoiceNumber}-invoice.pdf`); }}
              onShare={async () => { const doc = createPurchaseInvoicePdf(viewPurchase, company); await sharePdf(doc, `${viewPurchase.invoiceNumber}-invoice.pdf`); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
