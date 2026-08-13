import { jsPDF } from "jspdf";
import { Download, Printer, Share2 } from "lucide-react";
import { downloadPdf, printPdf, sharePdf } from "@/lib/pdf";

export type PDFExporterProps = {
  build: () => jsPDF;
  fileName: string;
  downloadLabel?: string;
  disabled?: boolean;
};

export function PDFExporter({ build, fileName, downloadLabel = "Download PDF", disabled }: PDFExporterProps) {
  const handleDownload = async () => {
    try {
      const doc = build();
      await downloadPdf(doc, fileName);
    } catch (error) {
      console.error("PDF download failed", error);
    }
  };
  const handlePrint = async () => {
    try {
      const doc = build();
      await printPdf(doc);
    } catch (error) {
      console.error("PDF print failed", error);
    }
  };
  const handleShare = async () => {
    try {
      const doc = build();
      await sharePdf(doc, fileName);
    } catch (error) {
      console.error("PDF share failed", error);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={handleDownload}
        className="inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        <Download className="size-4" />
        {downloadLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={handlePrint}
        className="inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
      >
        <Printer className="size-4" />
        Print
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={handleShare}
        className="inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
      >
        <Share2 className="size-4" />
        Share
      </button>
    </div>
  );
}
