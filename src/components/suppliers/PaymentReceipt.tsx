import { Button } from "@/components/ui/button";
import { currency, dateShort } from "@/lib/format";
import { Download, Printer, Share2 } from "lucide-react";
import type { PaymentReceiptData } from "@/lib/pdf";

export function PaymentReceipt({
  receipt,
  onPrint,
  onDownload,
  onShare,
}: {
  receipt: PaymentReceiptData;
  onPrint: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const remainingBalance = receipt.previousBalance - receipt.amountPaid;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold">Payment Receipt</div>
          <p className="text-sm text-muted-foreground">Payment record with running balance and receipt details.</p>
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
          <div className="text-sm font-semibold">{receipt.supplier.name}</div>
          <div className="text-sm text-muted-foreground">{receipt.supplier.company || "—"}</div>
          <div className="text-sm">{receipt.supplier.contact || "—"}</div>
          <div className="text-sm">{receipt.supplier.address || "—"}</div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Receipt #</div>
              <div className="font-medium">{receipt.receiptNumber}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Payment Date</div>
              <div className="font-medium">{dateShort(receipt.paymentDate)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Method</div>
              <div className="font-medium capitalize">{receipt.method}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase">Amount Paid</div>
              <div className="font-medium">{currency(receipt.amountPaid)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Notes: {receipt.notes || "No additional notes."}
        </div>
        <div className="rounded-md border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Previous Balance</span><span>{currency(receipt.previousBalance)}</span></div>
          <div className="flex justify-between"><span>Amount Paid</span><span>{currency(receipt.amountPaid)}</span></div>
          <div className="flex justify-between"><span>Remaining Balance</span><span>{currency(remainingBalance)}</span></div>
        </div>
      </div>
    </div>
  );
}
