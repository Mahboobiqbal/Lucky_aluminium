import type { Purchase, Payment } from "@/lib/db";

export type LedgerEntry = {
  id?: number;
  date?: number;
  reference: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export function buildSupplierLedger(purchases: Purchase[], payments: Payment[], openingBalance = 0) {
  const entries = [
    ...purchases.map((purchase) => ({
      id: purchase.id,
      date: purchase.date,
      reference: purchase.invoiceNumber,
      type: "Purchase",
      description: `${purchase.items.length} item${purchase.items.length === 1 ? "" : "s"} purchased`,
      debit: purchase.totalAmount,
      credit: 0,
      balance: 0,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      date: payment.date,
      reference: payment.invoiceId ? `PAY-${payment.invoiceId}` : `PAY-${payment.id ?? ""}`,
      type: "Payment",
      description: `${payment.method} payment`,
      debit: 0,
      credit: payment.amount,
      balance: 0,
    })),
  ].sort((a, b) => (a.date ?? 0) - (b.date ?? 0) || a.reference.localeCompare(b.reference));

  let balance = openingBalance;
  return [
    {
      reference: "Opening Balance",
      type: "Opening",
      description: "Balance carried forward",
      debit: 0,
      credit: 0,
      balance: openingBalance,
    },
    ...entries.map((entry) => {
      balance += entry.debit - entry.credit;
      return { ...entry, balance };
    }),
  ];
}
