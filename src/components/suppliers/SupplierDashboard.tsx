import { type Supplier, type Purchase } from "@/lib/db";
import { type LedgerEntry } from "@/lib/ledger";
import type { CompanyProfile } from "@/lib/print";
import { SupplierProfile } from "@/components/suppliers/SupplierProfile";
import { SupplierSummaryCards } from "@/components/suppliers/SupplierSummaryCards";
import { SupplierActions } from "@/components/suppliers/SupplierActions";
import { RecentTransactions } from "@/components/suppliers/RecentTransactions";
import { SupplierTransactionHistory } from "@/components/suppliers/SupplierTransactionHistory";
import { SupplierStatement } from "@/components/suppliers/SupplierStatement";

export type SupplierTransaction = {
  id?: number;
  date: number;
  reference: string;
  type: string;
  description: string;
  amount: number;
  balance: number;
};

export function SupplierDashboard({
  supplier,
  transactions,
  ledgerEntries,
  totalPurchases,
  totalPayments,
  outstandingBalance,
  lastPurchaseDate,
  showStatement,
  onBack,
  onNewPurchase,
  onMakePayment,
  onViewHistory,
  onGenerateStatement,
  onExportPdf,
  purchases,
  company,
}: {
  supplier: Supplier;
  transactions: SupplierTransaction[];
  ledgerEntries: LedgerEntry[];
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  lastPurchaseDate?: number;
  showStatement: boolean;
  onBack: () => void;
  onNewPurchase: () => void;
  onMakePayment: () => void;
  onViewHistory: () => void;
  onGenerateStatement: () => void;
  onExportPdf: () => void;
  purchases: Purchase[];
  company: CompanyProfile;
}) {
  const recentTransactions = [...transactions].sort((a, b) => b.date - a.date).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold">Supplier Dashboard</div>
          <div className="text-sm text-muted-foreground">{supplier.name}</div>
        </div>
        <SupplierActions
          onBack={onBack}
          onNewPurchase={onNewPurchase}
          onMakePayment={onMakePayment}
          onViewHistory={onViewHistory}
          onGenerateStatement={onGenerateStatement}
          onExportPdf={onExportPdf}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SupplierProfile supplier={supplier} />
        <SupplierSummaryCards
          totalPurchases={totalPurchases}
          totalPayments={totalPayments}
          outstandingBalance={outstandingBalance}
          lastPurchaseDate={lastPurchaseDate}
        />
      </div>

      <RecentTransactions transactions={recentTransactions} />

      <div id="transaction-history">
        <SupplierTransactionHistory transactions={ledgerEntries} purchases={purchases} supplier={supplier} company={company} outstandingBalance={outstandingBalance} />
      </div>

      {showStatement && (
        <SupplierStatement
          supplier={supplier}
          entries={ledgerEntries}
          statementDate={Date.now()}
          openingBalance={ledgerEntries[0]?.balance ?? 0}
          totalPurchases={totalPurchases}
          totalPayments={totalPayments}
          outstandingBalance={outstandingBalance}
          closingBalance={ledgerEntries[ledgerEntries.length - 1]?.balance ?? 0}
        />
      )}
    </div>
  );
}
