import { useMemo } from "react";
import { currency } from "@/lib/format";
import { Package, ShoppingCart } from "lucide-react";
import type { Purchase } from "@/lib/db";

type ProductSummary = {
  name: string;
  totalQuantity: number;
  totalAmount: number;
  avgPrice: number;
  purchaseCount: number;
};

export function PurchaseProductsSummary({ purchases }: { purchases: Purchase[] }) {
  const productMap = useMemo(() => {
    const map = new Map<string, ProductSummary>();
    for (const purchase of purchases) {
      for (const item of purchase.items) {
        const key = item.productName.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalAmount += item.amount;
          existing.purchaseCount += 1;
          existing.avgPrice = existing.totalAmount / existing.totalQuantity;
        } else {
          map.set(key, {
            name: item.productName,
            totalQuantity: item.quantity,
            totalAmount: item.amount,
            avgPrice: item.purchasePrice,
            purchaseCount: 1,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [purchases]);

  const totalProducts = productMap.length;
  const totalQuantity = productMap.reduce((sum, p) => sum + p.totalQuantity, 0);
  const totalValue = productMap.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Package className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Products Purchased</div>
            <div className="text-[11px] text-muted-foreground">
              {totalProducts} product{totalProducts !== 1 ? "s" : ""} · {totalQuantity} total units · {currency(totalValue)}
            </div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {productMap.length > 0 ? (
          productMap.map((product) => (
            <div key={product.name} className="px-5 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{product.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {product.purchaseCount} purchase{product.purchaseCount !== 1 ? "s" : ""} · Avg {currency(product.avgPrice)}/unit
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">{currency(product.totalAmount)}</div>
                  <div className="text-[11px] text-muted-foreground">{product.totalQuantity} units</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-muted-foreground">
            <ShoppingCart className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No purchases yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
