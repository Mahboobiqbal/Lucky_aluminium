import { currency, dateShort } from "@/lib/format";
import { LedgerTable } from "@/components/suppliers/LedgerTable";
import type { LedgerEntry } from "@/lib/ledger";
import type { Supplier } from "@/lib/db";

export function SupplierStatement({
  supplier,
  entries,
  statementDate,
  openingBalance,
  totalPurchases,
  totalPayments,
  outstandingBalance,
  closingBalance,
}: {
  supplier: Supplier;
  entries: LedgerEntry[];
  statementDate: number;
  openingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  closingBalance: number;
}) {
  return (
    <div id="supplier-statement" className="bg-card border border-border rounded-md p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold">Supplier Statement</div>
          <div className="text-sm text-muted-foreground">{supplier.name}</div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>Statement Date: {dateShort(statementDate)}</div>
          <div>Opening Balance: {currency(openingBalance)}</div>
        </div>
      </div>
      <LedgerTable rows={entries} title="Statement Ledger" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Closing Balance</div>
          <div className="text-xl font-semibold tabular-nums">{currency(closingBalance)}</div>
        </div>
      </div>
    </div>
  );
}
