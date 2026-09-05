import { currency, dateShort } from "@/lib/format";
import { LedgerTable } from "@/components/suppliers/LedgerTable";
import type { LedgerEntry } from "@/lib/ledger";
import type { Supplier } from "@/lib/db";
import { FileText, ShoppingCart, CreditCard, AlertTriangle, TrendingDown } from "lucide-react";

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
  const summaryCards: Array<{ icon: typeof ShoppingCart; label: string; value: string; tone: keyof typeof tones }> = [
    { icon: ShoppingCart, label: "Total Purchases", value: currency(totalPurchases), tone: "blue" },
    { icon: CreditCard, label: "Total Payments", value: currency(totalPayments), tone: "emerald" },
    { icon: AlertTriangle, label: "Outstanding", value: currency(outstandingBalance), tone: outstandingBalance > 0 ? "rose" : "emerald" },
    { icon: TrendingDown, label: "Closing Balance", value: currency(closingBalance), tone: "violet" },
  ];

  const tones: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  };

  return (
    <div id="supplier-statement" className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <FileText className="size-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Supplier Statement</div>
            <div className="text-sm text-muted-foreground">{supplier.name}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
          <div>Date: {dateShort(statementDate)}</div>
          <div>Opening Balance: {currency(openingBalance)}</div>
        </div>
      </div>

      <LedgerTable rows={entries} title="Statement Ledger" purchases={[]} supplier={supplier} company={{}} outstandingBalance={outstandingBalance} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const t = tones[card.tone];
          return (
            <div key={card.label} className={`bg-card border border-border border-l-[3px] ${t.border} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</div>
                  <div className="mt-1.5 text-xl font-bold tracking-tight tabular-nums truncate">{card.value}</div>
                </div>
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>
                  <card.icon className="size-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
