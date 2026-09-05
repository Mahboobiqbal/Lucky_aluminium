import { Button } from "@/components/ui/button";
import { currency, dateShort } from "@/lib/format";
import { Download, Printer, Share2 } from "lucide-react";
import type { PurchaseInvoiceData } from "@/lib/pdf";

export function PurchaseInvoice({
  invoice,
  onPrint,
  onDownload,
  onShare,
}: {
  invoice: PurchaseInvoiceData;
  onPrint: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const totalQuantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const outstanding = invoice.paymentType === "credit" ? invoice.outstandingBalance : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold">Purchase Invoice</div>
          <p className="text-sm text-muted-foreground">Invoice generated for the new purchase.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onPrint}>
            <Printer className="size-3.5 mr-1" /> Print
          </Button>
          <Button type="button" size="sm" onClick={onDownload}>
            <Download className="size-3.5 mr-1" /> Download PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onShare}>
            <Share2 className="size-3.5 mr-1" /> Share
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="text-sm uppercase tracking-[.2em] text-muted-foreground">Supplier</div>
          <div className="text-sm font-semibold">{invoice.supplier.name}</div>
          <div className="text-sm text-muted-foreground">{invoice.supplier.company || "—"}</div>
          <div className="text-sm">{invoice.supplier.contact || "—"}</div>
          <div className="text-sm">{invoice.supplier.address || "—"}</div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Invoice #</div>
              <div className="font-medium">{invoice.invoiceNumber}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Purchase Date</div>
              <div className="font-medium">{dateShort(invoice.date)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Payment Type</div>
              <div className="font-medium capitalize">{invoice.paymentType}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Outstanding</div>
              <div className="font-medium">{currency(outstanding)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Purchase Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
                <td className="tabular-nums">{currency(item.purchasePrice)}</td>
                <td className="tabular-nums">{currency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Invoice created for supplier purchase, with itemized product costs and credit details.
        </div>
        <div className="rounded-md border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Total Quantity</span><span>{totalQuantity}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
          <div className="flex justify-between"><span>Grand Total</span><span>{currency(subtotal)}</span></div>
          <div className="flex justify-between"><span>Payment Type</span><span className="capitalize">{invoice.paymentType}</span></div>
          <div className="flex justify-between"><span>Outstanding Balance</span><span>{currency(outstanding)}</span></div>
        </div>
      </div>
    </div>
  );
}
