import { type Supplier } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Trash2, Building2, Phone, Package } from "lucide-react";
import { TableActions } from "@/components/layout/TableActions";

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
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="text-sm font-semibold tracking-tight">All Suppliers</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Contact</th>
              <th>Products</th>
              <th className="text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const active = supplier.id === selectedSupplierId;
              const initials = supplier.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <tr
                  key={supplier.id}
                  className={`cursor-pointer transition-colors ${active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"}`}
                  onClick={() => supplier.id && onSelect(supplier.id)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{supplier.name}</div>
                        {supplier.company && <div className="text-[11px] text-muted-foreground truncate">{supplier.company}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">{supplier.contact || "—"}</td>
                  <td className="text-muted-foreground truncate max-w-[200px]">{supplier.products || "—"}</td>
                  <td>
                    <TableActions>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (supplier.id) onRemove(supplier.id);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                        title="Delete supplier"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableActions>
                  </td>
                </tr>
              );
            })}
            {!suppliers.length && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-muted-foreground">
                  No suppliers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
