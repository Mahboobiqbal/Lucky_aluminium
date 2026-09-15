import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Ruler } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/measurements")({
  head: () => ({ meta: [{ title: "Measurements — Lucky Aluminium" }] }),
  component: MeasurementsPage,
});

type Order = { id: number; number: string; customerName: string; items: { productName: string; color?: string; size?: string; gaze?: string; itemType?: string; width: number; height: number; length?: number; quantity: number }[]; createdAt: string };

function MeasurementsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try { const data = await api.safeGet<Order[]>("/api/orders"); setOrders(Array.isArray(data) ? data : []); } catch { toast.error("Failed to load measurements"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = (Array.isArray(orders) ? orders : []).flatMap((o) => o.items.map((it, i) => ({ order: o.number, customer: o.customerName, ...it, key: `${o.id}-${i}` })));

  return (
    <AppShell title="Measurements">
      <PageContainer>
        <TableShell>
          <table className="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Color</th><th>Size</th><th>Gaze</th><th>Type</th><th>W (ft)</th><th>H (ft)</th><th>Length (ft)</th><th>Qty</th><th>Area</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const isLength = r.itemType === "length";
                const area = isLength
                  ? (r.length || 0) * r.quantity
                  : r.width * r.height * r.quantity;
                const unit = isLength ? "ft" : "sqft";
                return (
                  <tr key={r.key}>
                    <td className="font-medium">{r.order}</td>
                    <td>{r.customer}</td>
                    <td>{r.productName}</td>
                    <td className="text-muted-foreground text-xs">{r.color || "-"}</td>
                    <td className="text-muted-foreground text-xs">{r.size || "-"}</td>
                    <td className="text-muted-foreground text-xs">{r.gaze || "-"}</td>
                    <td className="text-xs">{isLength ? "Length" : "Window"}</td>
                    <td className="tabular-nums">{isLength ? "-" : r.width}</td>
                    <td className="tabular-nums">{isLength ? "-" : r.height}</td>
                    <td className="tabular-nums">{isLength ? (r.length || 0) : "-"}</td>
                    <td className="tabular-nums">{r.quantity}</td>
                    <td className="tabular-nums font-medium">{area.toFixed(1)} {unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <EmptyState icon={Ruler} title={loading ? "Loading..." : "No measurements recorded"} hint={loading ? "Please wait" : "Measurements come from orders"} />}
        </TableShell>
      </PageContainer>
    </AppShell>
  );
}
