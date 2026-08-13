import { currency } from "@/lib/format";

export function SupplierSummaryCards({
  totalPurchases,
  totalPayments,
  outstandingBalance,
  lastPurchaseDate,
}: {
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  lastPurchaseDate?: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Purchases</div>
        <div className="text-xl font-semibold tabular-nums">{currency(totalPurchases)}</div>
      </div>
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Payments</div>
        <div className="text-xl font-semibold tabular-nums">{currency(totalPayments)}</div>
      </div>
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding Balance</div>
        <div className="text-xl font-semibold tabular-nums">{currency(outstandingBalance)}</div>
      </div>
      <div className="stat-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Last Purchase Date</div>
        <div className="text-xl font-semibold">{lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
      </div>
    </div>
  );
}
