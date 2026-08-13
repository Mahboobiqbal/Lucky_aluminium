import { Button } from "@/components/ui/button";
import { FileText, ShoppingCart, CreditCard, ListChecks, ArrowLeft } from "lucide-react";

export function SupplierActions({
  onBack,
  onNewPurchase,
  onMakePayment,
  onViewHistory,
  onGenerateStatement,
  onExportPdf,
}: {
  onBack: () => void;
  onNewPurchase: () => void;
  onMakePayment: () => void;
  onViewHistory: () => void;
  onGenerateStatement: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-3.5 mr-1" /> Back
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onNewPurchase}>
          <ShoppingCart className="size-3.5 mr-1" /> New Purchase
        </Button>
        <Button size="sm" onClick={onMakePayment}>
          <CreditCard className="size-3.5 mr-1" /> Make Payment
        </Button>
        <Button size="sm" onClick={onViewHistory}>
          <ListChecks className="size-3.5 mr-1" /> View History
        </Button>
        <Button size="sm" onClick={onGenerateStatement}>
          <FileText className="size-3.5 mr-1" /> Generate Statement
        </Button>
        <Button size="sm" variant="outline" onClick={onExportPdf}>
          Export PDF
        </Button>
      </div>
    </div>
  );
}
