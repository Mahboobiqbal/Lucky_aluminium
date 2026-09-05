import { currency, dateShort } from "@/lib/format";
import { ShoppingCart, CreditCard } from "lucide-react";

type SupplierTransaction = {
  id?: number;
  date: number;
  reference: string;
  type: string;
  description: string;
  amount: number;
  balance: number;
};

export function RecentTransactions({ transactions }: { transactions: SupplierTransaction[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="text-sm font-semibold tracking-tight">Recent Transactions</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const isPurchase = transaction.type === "Purchase";
              return (
                <tr key={`${transaction.reference}-${transaction.id ?? transaction.date}`} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground">{dateShort(transaction.date)}</td>
                  <td className="font-medium">{transaction.reference}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${isPurchase ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                      {isPurchase ? <ShoppingCart className="size-3" /> : <CreditCard className="size-3" />}
                      {transaction.type}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{transaction.description}</td>
                  <td className={`text-right tabular-nums font-medium ${isPurchase ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {isPurchase ? "+" : "−"}{currency(transaction.amount)}
                  </td>
                  <td className="tabular-nums font-semibold">{currency(transaction.balance)}</td>
                </tr>
              );
            })}
            {!transactions.length && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No recent transactions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
