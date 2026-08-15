import { useMemo, useState } from "react";
import { currency, dateShort } from "@/lib/format";
import { ShoppingCart, ChevronDown, ChevronUp, Package } from "lucide-react";
import type { Purchase } from "@/lib/db";

export function RecentPurchasesList({ purchases }: { purchases: Purchase[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const recentPurchases = useMemo(() => {
    return [...purchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [purchases]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShoppingCart className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Recent Purchases</div>
            <div className="text-[11px] text-muted-foreground">
              Last {recentPurchases.length} purchase{recentPurchases.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {recentPurchases.length > 0 ? (
          recentPurchases.map((purchase) => {
            const isExpanded = expandedId === purchase.id;
            const itemCount = purchase.items.length;
            const totalQty = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <div key={purchase.id} className="hover:bg-muted/30 transition-colors">
                <button
                  type="button"
                  onClick={() => purchase.id && toggleExpand(purchase.id)}
                  className="w-full px-5 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{purchase.invoiceNumber}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {purchase.paymentType}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {dateShort(purchase.date)} · {itemCount} item{itemCount !== 1 ? "s" : ""} · {totalQty} unit{totalQty !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{currency(purchase.totalAmount)}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Items Purchased
                      </div>
                      <div className="space-y-2">
                        {purchase.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{item.productName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.quantity} × {currency(item.purchasePrice)}
                              </div>
                            </div>
                            <div className="font-semibold tabular-nums shrink-0">
                              {currency(item.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {purchase.notes && (
                        <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                          Note: {purchase.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="px-5 py-12 text-center text-muted-foreground">
            <Package className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No purchases recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
