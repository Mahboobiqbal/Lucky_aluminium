import { type Supplier } from "@/lib/db";
import { Building2, Phone, MapPin, FileText } from "lucide-react";

export function SupplierProfile({ supplier }: { supplier: Supplier }) {
  const initials = supplier.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold truncate">{supplier.name}</div>
          {supplier.company && <div className="text-sm text-muted-foreground truncate">{supplier.company}</div>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
          <Phone className="size-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</p>
            <p className="font-medium truncate">{supplier.contact || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
          <MapPin className="size-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Address</p>
            <p className="font-medium truncate">{supplier.address || "—"}</p>
          </div>
        </div>
        {supplier.notes && (
          <div className="sm:col-span-2 flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
            <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="font-medium">{supplier.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
