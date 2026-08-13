import { currency } from "@/lib/format";

export function PaymentSummary({
  totalPaymentsReceived,
  outstandingAmount,
  numberOfTransactions,
}: {
  totalPaymentsReceived: number;
  outstandingAmount: number;
  numberOfTransactions: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total received</div>
        <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          {currency(totalPaymentsReceived)}
        </div>
      </div>
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
        <div className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
          {currency(outstandingAmount)}
        </div>
      </div>
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Transactions</div>
        <div className="text-xl font-semibold tabular-nums">{numberOfTransactions}</div>
      </div>
    </div>
  );
}
