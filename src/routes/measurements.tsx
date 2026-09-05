import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Ruler } from "lucide-react";

export const Route = createFileRoute("/measurements")({
  head: () => ({ meta: [{ title: "Measurements — Lucky Aluminium" }] }),
  component: MeasurementsPage,
});

type Order = { id: number; number: string; customerName: string; items: { productName: string; width: number; height: number; quantity: number }[]; createdAt: string };

function MeasurementsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try { const data = await api.safeGet<Order[]>("/api/orders"); setOrders(data || []); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = orders.flatMap((o) => o.items.map((it, i) => ({ order: o.number, customer: o.customerName, ...it, key: `${o.id}-${i}` })));

  return (
    <AppShell title="Measurements">
      <PageContainer>
        <TableShell>
          <table className="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>W (ft)</th><th>H (ft)</th><th>Qty</th><th>Area (sqft)</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium">{r.order}</td>
                  <td>{r.customer}</td>
                  <td>{r.productName}</td>
                  <td className="tabular-nums">{r.width}</td>
                  <td className="tabular-nums">{r.height}</td>
                  <td className="tabular-nums">{r.quantity}</td>
                  <td className="tabular-nums font-medium">{(r.width * r.height * r.quantity).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState icon={Ruler} title={loading ? "Loading..." : "No measurements recorded"} hint={loading ? "Please wait" : "Measurements come from orders"} />}
        </TableShell>
      </PageContainer>
    </AppShell>
  );
}
