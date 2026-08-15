import { LedgerTable } from "@/components/suppliers/LedgerTable";
import type { Purchase, Supplier } from "@/lib/db";
import type { CompanyProfile } from "@/lib/print";
import type { LedgerEntry } from "@/lib/ledger";

export function SupplierTransactionHistory({
  transactions,
  purchases,
  supplier,
  company,
  outstandingBalance,
}: {
  transactions: LedgerEntry[];
  purchases: Purchase[];
  supplier: Supplier;
  company: CompanyProfile;
  outstandingBalance: number;
}) {
  return <LedgerTable rows={transactions} title="Financial Ledger" purchases={purchases} supplier={supplier} company={company} outstandingBalance={outstandingBalance} />;
}
