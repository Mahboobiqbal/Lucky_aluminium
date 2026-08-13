import { currency, dateShort } from "@/lib/format";

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
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="text-sm font-semibold">Recent Transactions</div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Transaction Type</th>
            <th>Description</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={`${transaction.reference}-${transaction.id ?? transaction.date}`}>
              <td className="text-muted-foreground">{dateShort(transaction.date)}</td>
              <td className="font-medium">{transaction.reference}</td>
              <td>{transaction.type}</td>
              <td>{transaction.description}</td>
              <td className="text-right tabular-nums">{currency(transaction.amount)}</td>
              <td className="text-right tabular-nums">{currency(transaction.balance)}</td>
            </tr>
          ))}
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
  );
}
