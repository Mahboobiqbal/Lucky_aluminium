import { type Supplier, type Purchase } from "@/lib/db";
import { type LedgerEntry } from "@/lib/ledger";
import type { CompanyProfile } from "@/lib/print";
import { SupplierProfile } from "@/components/suppliers/SupplierProfile";
import { SupplierSummaryCards } from "@/components/suppliers/SupplierSummaryCards";
import { SupplierActions } from "@/components/suppliers/SupplierActions";
import { PurchaseProductsSummary } from "@/components/suppliers/PurchaseProductsSummary";
import { RecentPurchasesList } from "@/components/suppliers/RecentPurchasesList";
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
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-2xl font-bold tracking-tight">Supplier Dashboard</div>
          <div className="text-sm text-muted-foreground mt-1">{supplier.name}</div>
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

      <SupplierSummaryCards
        totalPurchases={totalPurchases}
        totalPayments={totalPayments}
        outstandingBalance={outstandingBalance}
        lastPurchaseDate={lastPurchaseDate}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <SupplierProfile supplier={supplier} />
        <PurchaseProductsSummary purchases={purchases} />
      </div>

      <RecentPurchasesList purchases={purchases} />

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
