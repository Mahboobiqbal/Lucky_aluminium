import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { Quotation } from "@/lib/db";
import type { CompanyProfile } from "@/lib/print";
import { phoneDisplay } from "@/lib/print";
import { currency, dateShort } from "@/lib/format";
import { addAppLogoToPdf } from "@/lib/brand";

export function createQuotationPdf(data: Quotation, company?: CompanyProfile): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 297
  const m = 16;
  const l = m;
  const r = pw - m;
  const uw = r - l; // 178

  const safeCompany: CompanyProfile = company || {};

  // --- TOP HEADER (transparent background, dark text, no blue) ---
  // Logo
  const logoSize = 11;
  const logoAdded = addAppLogoToPdf(doc, l, 9, logoSize, logoSize);
  const logoOffset = logoAdded ? logoSize + 4 : 0;

  // Company name
  doc.setTextColor("#111827");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(safeCompany.companyName || "Lucky Aluminium", l + logoOffset, 16);

  // Company details - address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor("#4b5563");
  const address = (safeCompany.address || "").replace(/\n/g, ", ");
  let ly = 23.5;
  if (address) {
    doc.text(address, l + logoOffset, ly);
    ly += 3.8;
  }

  // Phone entries vertically with labels
  const phoneEntries = safeCompany.phoneEntries || [];
  if (phoneEntries.length > 0) {
    phoneEntries.forEach((entry) => {
      if (entry.number) {
        const label = entry.label ? entry.label + ": " : "";
        doc.text(label + entry.number, l + logoOffset, ly);
        ly += 3.6;
      }
    });
  } else {
    // Fallback: use flat phones or single phone
    const phones = safeCompany.phones?.filter(Boolean) || [];
    if (phones.length > 0) {
      phones.forEach((p) => {
        doc.text(p, l + logoOffset, ly);
        ly += 3.6;
      });
    }
  }

  // Email
  if (safeCompany.email) {
    doc.text("Email: " + safeCompany.email, l + logoOffset, ly);
  }

  // QUOTATION title + meta (right side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor("#111827");
  doc.text("QUOTATION", r, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor("#6b7280");
  doc.text("Reference: " + data.number, r, 23, { align: "right" });
  doc.text("Date: " + dateShort(data.date), r, 28, { align: "right" });

  // --- SEPARATOR line below header ---
  let y = 46;
  doc.setDrawColor(200, 210, 220);
  doc.line(l, y, r, y);
  y += 4;

  // --- BILL TO ---
  y = 52;
  doc.setDrawColor(200, 210, 220);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(l, y, uw, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor("#475569");
  doc.text("TO", l + 6, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#111827");
  doc.text(data.customerName || "-", l + 6, y + 15);

  y += 24;

  // --- SEPARATOR ---
  doc.setDrawColor(220, 225, 235);
  doc.line(l, y, r, y);
  y += 4;

  // --- ITEMS TABLE ---
  const thead = [["#", "Product", "Description", "Type", "Measurement", "Qty", "Rate", "Amount"]];
  const tbody = data.items.map((item, i) => {
    const isWindow = (item as any).itemType === "window";
    const measurement = isWindow
      ? `${(item as any).length || 0} ft`
      : (item.sqft && item.sqft > 0) ? `${item.sqft} sqft` : (item.width && item.height ? `${item.width}x${item.height} = ${(item.width * item.height).toFixed(2)} sqft` : "-");
    return [
      String(i + 1),
      item.productName || "-",
      item.notes || "-",
      isWindow ? "Window" : "Other",
      measurement,
      String(item.quantity),
      currency(item.unitPrice),
      currency(item.amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: thead,
    body: tbody,
    theme: "grid",
    margin: { left: m, right: m, bottom: 25 },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [30, 30, 40],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      valign: "middle",
    },
    styles: {
      lineColor: [210, 215, 225],
      lineWidth: 0.3,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 36 },
      2: { cellWidth: 28 },
      3: { halign: "center", cellWidth: 16 },
      4: { cellWidth: 30 },
      5: { halign: "center", cellWidth: 10 },
      6: { halign: "right", cellWidth: 24 },
      7: { halign: "right", cellWidth: 32 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body" && cellData.column.index === 0) {
        cellData.cell.styles.valign = "middle";
      }
    },
  });

  let fy = (doc as any).lastAutoTable?.finalY || y + 8;

  // --- TOTALS SECTION (right-aligned box) ---
  const totalMeasurement = data.items.reduce((sum, item) => {
    const isWindow = (item as any).itemType === "window";
    if (isWindow) {
      return sum + ((item as any).length || 0) * item.quantity;
    }
    const area = (item.sqft && item.sqft > 0) ? item.sqft : (item.width * item.height);
    return sum + area * item.quantity;
  }, 0);

  const discountAmount = data.subtotal * data.discount / 100;

  const totalsRows: Array<[string, string]> = [
    ["Total Measurement", totalMeasurement.toFixed(2)],
    ...(data.discount > 0 || data.extraCharges > 0 ? [["Subtotal", currency(data.subtotal)]] as [string, string][] : []),
    ...(data.discount > 0 ? [["Discount (" + data.discount + "%)", "- " + currency(discountAmount)]] as [string, string][] : []),
    ...(data.extraCharges > 0 ? [["Extra Charges", currency(data.extraCharges)]] as [string, string][] : []),
    ["Grand Total", currency(data.total)],
  ];

  // Calculate the totals box width to align with the right edge of the items table
  // Items table columns 1-6: 54 + 18 + 18 + 14 + 28 + 36 = 168mm
  // We use a 2-column table: col0=label (90mm), col1=value (36mm) = 126mm total
  // Position so right edge = r (194mm), left edge = 194 - 126 = 68mm
  const totalsColWidths = [90, 36];
  const totalsTotalWidth = totalsColWidths[0] + totalsColWidths[1];
  const totalsMarginLeft = r - totalsTotalWidth; // aligns right edge with items table

  autoTable(doc, {
    startY: fy + 2,
    body: totalsRows,
    theme: "grid",
    margin: { left: totalsMarginLeft, right: m, bottom: 25 },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 4 },
    },
    styles: {
      lineColor: [210, 215, 225],
      lineWidth: 0.3,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: totalsColWidths[0], fontStyle: "bold" },
      1: { halign: "right", cellWidth: totalsColWidths[1], fontStyle: "bold" },
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body" && cellData.row.index === totalsRows.length - 1) {
        // Grand Total row: highlight the entire row
        cellData.cell.styles.fillColor = [254, 242, 242];
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.fontSize = 9;
        cellData.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  fy = (doc as any).lastAutoTable?.finalY || fy + 8;
  fy += 6;

  // --- TERMS & CONDITIONS ---
  if (fy + 20 > ph - 22) {
    doc.addPage();
    fy = m + 10;
  }

  doc.setDrawColor(210, 215, 225);
  doc.line(l, fy, r, fy);
  fy += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor("#374151");
  doc.text("Terms & Conditions", l, fy);
  fy += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor("#6b7280");
  const terms = [
    "1. This quotation is valid for 7 days from the date of issue.",
    "2. 70% advance payment is required to confirm the order.",
    "3. The remaining 30% payment must be paid before delivery.",
    "4. Work will start after order confirmation and advance payment.",
    "5. Estimated completion time is 20 working days, depending on the project size.",
    "6. Any changes in design or measurements may affect the final price and delivery time.",
    "7. Please review the quotation carefully before confirming the order.",
  ];
  terms.forEach((t, i) => {
    doc.text(t, l, fy + i * 3.5);
  });

  // --- FOOTER ---
  doc.setDrawColor(210, 215, 225);
  doc.line(l, ph - 16, r, ph - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor("#9ca3af");
  const gen = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.text("Generated: " + gen, l, ph - 10);
  doc.text("Thank you for your business!", r, ph - 10, { align: "right" });

  return doc;
}

export function viewQuotationPdf(doc: jsPDF) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function downloadQuotationPdf(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function printQuotationPdf(doc: jsPDF) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(`
      <!doctype html>
      <html><head><title>Quotation</title>
      <style>body{margin:0;display:flex}embed{width:100%;height:98vh}</style>
      </head><body>
      <embed src="${url}" type="application/pdf" />
      <script>setTimeout(()=>{document.querySelector('embed').focus();window.print()},600)</script>
      </body></html>
    `);
    w.document.close();
    w.focus();
  }
}
