import { currency } from "@/lib/format";
import { ShoppingCart, CreditCard, AlertTriangle, Calendar } from "lucide-react";

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
  const cards = [
    {
      icon: ShoppingCart,
      label: "Total Purchases",
      value: currency(totalPurchases),
      tone: "blue" as const,
    },
    {
      icon: CreditCard,
      label: "Total Payments",
      value: currency(totalPayments),
      tone: "emerald" as const,
    },
    {
      icon: AlertTriangle,
      label: "Outstanding Balance",
      value: currency(outstandingBalance),
      tone: outstandingBalance > 0 ? "rose" : "emerald" as const,
    },
    {
      icon: Calendar,
      label: "Last Purchase",
      value: lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      tone: "violet" as const,
    },
  ];

  const tones = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => {
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
  );
}
