import { type Supplier } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SupplierProfile({ supplier }: { supplier: Supplier }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Name</p>
            <p className="font-medium">{supplier.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Company</p>
            <p className="font-medium">{supplier.company || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Contact Number</p>
            <p className="font-medium">{supplier.contact || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Address</p>
            <p className="font-medium">{supplier.address || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Notes</p>
            <p className="font-medium">{supplier.notes || "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
