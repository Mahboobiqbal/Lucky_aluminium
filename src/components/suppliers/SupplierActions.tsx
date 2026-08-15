import { Button } from "@/components/ui/button";
import { FileText, ShoppingCart, CreditCard, ListChecks, ArrowLeft, Download } from "lucide-react";

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
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="size-3.5 mr-1.5" /> Back to Suppliers
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onNewPurchase} className="bg-blue-600 hover:bg-blue-700 text-white">
          <ShoppingCart className="size-3.5 mr-1.5" /> New Purchase
        </Button>
        <Button size="sm" onClick={onMakePayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <CreditCard className="size-3.5 mr-1.5" /> Make Payment
        </Button>
        <Button size="sm" variant="outline" onClick={onViewHistory}>
          <ListChecks className="size-3.5 mr-1.5" /> History
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerateStatement}>
          <FileText className="size-3.5 mr-1.5" /> Statement
        </Button>
        <Button size="sm" variant="outline" onClick={onExportPdf}>
          <Download className="size-3.5 mr-1.5" /> Export PDF
        </Button>
      </div>
    </div>
  );
}
