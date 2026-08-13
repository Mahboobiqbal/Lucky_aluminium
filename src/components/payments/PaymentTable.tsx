import { currency, dateShort } from "@/lib/format";

export type PaymentRow = {
  id: string;
  number: string;
  referenceNumber: string;
  customerName: string;
  orderDate: number;
  paid: number;
  balance: number;
  method?: string;
  notes?: string;
};

export function PaymentTable({
  rows,
  withNotes = false,
  emptyLabel = "No payments found",
}: {
  rows: PaymentRow[];
  withNotes?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Customer</th>
            <th>Method</th>
            <th className="text-right">Paid</th>
            <th className="text-right">Remaining Balance</th>
            {withNotes && <th>Notes</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="text-muted-foreground">{dateShort(row.orderDate)}</td>
              <td>
                <div className="font-medium">{row.referenceNumber}</div>
                <div className="text-xs text-muted-foreground">{row.number}</div>
              </td>
              <td className="font-medium">{row.customerName}</td>
              <td>{row.method || "-"}</td>
              <td className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                {currency(row.paid)}
              </td>
              <td className="text-right tabular-nums text-rose-600 dark:text-rose-400">{currency(row.balance)}</td>
              {withNotes && <td className="text-muted-foreground max-w-48 truncate">{row.notes || "-"}</td>}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={withNotes ? 7 : 6} className="text-center py-12 text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
