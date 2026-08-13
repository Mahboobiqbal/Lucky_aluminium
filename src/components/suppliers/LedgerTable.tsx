import { Button } from "@/components/ui/button";
import { currency, dateShort } from "@/lib/format";
import { createPurchaseInvoicePdf, downloadPdf, printPdf } from "@/lib/pdf";
import type { CompanyProfile } from "@/lib/print";
import type { Purchase, Supplier } from "@/lib/db";
import type { LedgerEntry } from "@/lib/ledger";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

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
  const handleInvoiceAction = async (purchase: Purchase, mode: "pdf" | "print") => {
    const invoiceData = {
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
    };

    const doc = createPurchaseInvoicePdf(invoiceData, company);
    if (mode === "pdf") {
      await downloadPdf(doc, `${purchase.invoiceNumber}.pdf`);
      toast.success("Invoice saved as PDF");
    } else {
      await printPdf(doc);
      toast.success("Invoice print started");
    }
  };

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Type</th>
              <th>Description</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th className="text-right">Remaining Balance</th>
              <th className="w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const purchase = row.type === "Purchase" ? purchases.find((item) => item.id === row.id) : undefined;
              return (
                <tr key={`${row.reference}-${index}`}>
                  <td className="text-muted-foreground">{row.date ? dateShort(row.date) : "Opening"}</td>
                  <td className="font-medium">{row.reference}</td>
                  <td>{row.type}</td>
                  <td>{row.description}</td>
                  <td className="text-right tabular-nums">{row.debit ? currency(row.debit) : ""}</td>
                  <td className="text-right tabular-nums">{row.credit ? currency(row.credit) : ""}</td>
                  <td className="text-right tabular-nums font-semibold">{currency(row.balance)}</td>
                  <td className="text-right">
                    {purchase ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleInvoiceAction(purchase, "pdf")}>
                          <Download className="size-3.5 mr-1" />PDF
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleInvoiceAction(purchase, "print")}>
                          <Printer className="size-3.5 mr-1" />Print
                        </Button>
                      </div>
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
    </div>
  );
}
