import { type Supplier } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function SupplierList({
  suppliers,
  selectedSupplierId,
  onSelect,
  onRemove,
}: {
  suppliers: Supplier[];
  selectedSupplierId?: number;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Contact</th>
            <th>Products</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => {
            const active = supplier.id === selectedSupplierId;
            return (
              <tr
                key={supplier.id}
                className={`cursor-pointer transition-colors ${active ? "bg-muted/60" : "hover:bg-muted/30"}`}
                onClick={() => supplier.id && onSelect(supplier.id)}
              >
                <td className="font-medium">{supplier.name}</td>
                <td>{supplier.company || "—"}</td>
                <td className="tabular-nums">{supplier.contact}</td>
                <td className="text-muted-foreground">{supplier.products || "—"}</td>
                <td>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      if (supplier.id) onRemove(supplier.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete supplier"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {!suppliers.length && (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-foreground">
                No suppliers
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
