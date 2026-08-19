import { jsPDF } from "jspdf";
import { autoTable, type UserOptions } from "jspdf-autotable";
import type { CompanyProfile } from "@/lib/print";
import { phoneDisplay, hasBankDetails } from "@/lib/print";
import { currency, dateShort } from "@/lib/format";
import { addAppLogoToPdf } from "@/lib/brand";
import {
  buildPaymentStatement,
  type PaymentStatementRow,
} from "@/components/payments/PaymentStatement";

type SupplierInfo = {
  name: string;
  company?: string;
  contact?: string;
  address?: string;
};

type InvoiceItem = {
  productName: string;
  quantity: number;
  purchasePrice: number;
  amount: number;
};

export type PurchaseInvoiceData = {
  invoiceNumber: string;
  date: number;
  supplier: SupplierInfo;
  items: InvoiceItem[];
  paymentType: string;
  subtotal: number;
  totalQuantity: number;
  outstandingBalance: number;
};

export type PaymentReceiptData = {
  receiptNumber: string;
  paymentDate: number;
  method: string;
  amountPaid: number;
  previousBalance: number;
  remainingBalance: number;
  notes?: string;
  supplier: SupplierInfo;
};

export type SupplierStatementData = {
  statementDate: number;
  openingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  closingBalance: number;
  supplier: SupplierInfo;
  rows: Array<{
    date?: number;
    reference: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
};

type CustomerInvoiceCustomer = {
  name: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
};

type CustomerInvoiceItem = {
  productName: string;
  itemType?: "window" | "other";
  width: number;
  height: number;
  length?: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string;
};

export type CustomerInvoiceData = {
  invoiceNumber: string;
  orderNumber: string;
  orderDate: number;
  deliveryDate?: number;
  status: string;
  customer: CustomerInvoiceCustomer;
  items: CustomerInvoiceItem[];
  subtotal: number;
  discountPercent: number;
  total: number;
  paid: number;
  balance: number;
  notes?: string;
};

function addCompanyHeader(doc: jsPDF, company: CompanyProfile, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 40;
  const top = 48;
  const logoSize = 42;
  const logoPlaced = addAppLogoToPdf(doc, left, top, logoSize, logoSize);
if (!logoPlaced) {
    doc.setFillColor(55, 65, 81);
    doc.roundedRect(left, top, logoSize, logoSize, 8, 8, "F");
    doc.setFontSize(20);
    doc.setTextColor("#ffffff");
    doc.text((company.companyName?.charAt(0) || "U").toUpperCase(), left + logoSize / 2, top + logoSize / 2 + 6, {
      align: "center",
    });
  }
  doc.setTextColor("#1f2937");
  doc.setFontSize(16);
  doc.text(company.companyName || "Lucky Aluminium uPVC Works", left + logoSize + 16, top + 16, { maxWidth: 300 });
  doc.setFontSize(10);
  doc.setTextColor("#4b5563");
  const address = company.address || "";
  doc.text(address, left + logoSize + 16, top + 34, { maxWidth: 300 });

  // Phone entries vertically with labels
  const phoneEntries = company.phoneEntries || [];
  let py = top + 48;
  if (phoneEntries.length > 0) {
    phoneEntries.forEach((entry) => {
      if (entry.number) {
        const label = entry.label ? entry.label + ": " : "";
        doc.text(label + entry.number, left + logoSize + 16, py);
        py += 12;
      }
    });
  } else {
    const phones = company.phones?.filter(Boolean) || [];
    if (phones.length > 0) {
      phones.forEach((p) => {
        doc.text(p, left + logoSize + 16, py);
        py += 12;
      });
    }
  }
  if (company.email) {
    doc.text("Email: " + company.email, left + logoSize + 16, py, { maxWidth: 300 });
  }

  doc.setFontSize(22);
  doc.setTextColor("#111827");
  const titleLines = doc.splitTextToSize(title, 170);
  doc.text(titleLines, pageWidth - 40, top + 16, { align: "right" });

  // Return the bottom Y of the header content with some padding
  return py + 4;
}

function savePdf(doc: jsPDF, filename: string) {
  const blob = getOutputBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function getOutputBlob(doc: jsPDF) {
  return doc.output("blob");
}

function addAutoTable(doc: jsPDF, options: UserOptions) {
  autoTable(doc, options);
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

export async function downloadPdf(doc: jsPDF, filename: string) {
  savePdf(doc, filename);
}

export function openPdfPreview(doc: jsPDF) {
  const previewWindow = window.open("", "_blank");
  const blob = getOutputBlob(doc);
  const url = URL.createObjectURL(blob);
  if (previewWindow) {
    previewWindow.location.href = url;
    previewWindow.focus();
  } else {
    window.open(url, "_blank");
  }
}

export async function printPdf(doc: jsPDF) {
  (doc as any).autoPrint?.();
  const blob = getOutputBlob(doc);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    await downloadPdf(doc, "payment-statement.pdf");
  }
}

export async function sharePdf(doc: jsPDF, filename: string) {
  const blob = getOutputBlob(doc);
  const file = new File([blob], filename, { type: "application/pdf" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename, text: "PDF document" });
      return;
    }
  } catch (error) {
    console.warn("Share failed, falling back to download", error);
  }

  await downloadPdf(doc, filename);
}

function formatNumber(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function addCustomerInvoiceFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const generated = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(209, 213, 219);
    doc.line(40, 806, 555, 806);
    doc.setFontSize(8);
    doc.setTextColor("#6b7280");
    doc.text("Generated: " + generated, 40, 822);
    doc.text("Page " + page + " of " + pageCount, 555, 822, { align: "right" });
  }
}

export function createCustomerInvoicePdf(data: CustomerInvoiceData, company: CompanyProfile) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 40;
  const right = pageWidth - 40;
  const usableWidth = right - left;
  const companyName = company.companyName || "Lucky Aluminium uPVC Works";

  // No dark header background - transparent

  // Try to add actual logo image
  const logoPlaced = addAppLogoToPdf(doc, left + 4, 30, 40, 40);

  // Dark gray fallback initial badge (only if logo was not placed)
  if (!logoPlaced) {
    doc.setFillColor(55, 65, 81);
    doc.roundedRect(left, 28, 48, 48, 8, 8, "F");
    doc.setFontSize(22);
    doc.setTextColor("#ffffff");
    doc.text((companyName.charAt(0) || "U").toUpperCase(), left + 24, 60, { align: "center" });
  }

  doc.setTextColor("#111827");
  doc.setFontSize(18);
  doc.text(companyName, left + 56, 44);
  doc.setFontSize(8.5);
  doc.setTextColor("#4b5563");
  const address = company.address || "Industrial Area, Phase 2";
  doc.text(address, left + 56, 58, { maxWidth: 285 });

  // Phone entries vertically with labels (in invoice header)
  const phoneEntries = company.phoneEntries || [];
  let py = 70;
  if (phoneEntries.length > 0) {
    phoneEntries.forEach((entry) => {
      if (entry.number) {
        const label = entry.label ? entry.label + ": " : "";
        doc.text(label + entry.number, left + 56, py, { maxWidth: 285 });
        py += 10;
      }
    });
  } else {
    const phones = company.phones?.filter(Boolean) || [];
    if (phones.length > 0) {
      phones.forEach((p) => {
        doc.text(p, left + 56, py, { maxWidth: 285 });
        py += 10;
      });
    }
  }
  if (company.email) {
    doc.text("Email: " + company.email, left + 56, py, { maxWidth: 285 });
    py += 10;
  }
  const headerBottom = Math.max(py + 6, 110);

  doc.setFontSize(20);
  doc.setTextColor("#111827");
  doc.text("INVOICE", right, 50, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor("#6b7280");
  doc.text("#" + data.invoiceNumber, right, 64, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(left, headerBottom, usableWidth, 84, 6, 6, "FD");

  doc.setFontSize(9);
  doc.setTextColor("#64748b");
  doc.text("BILL TO", left + 16, headerBottom + 18);
  doc.setFontSize(13);
  doc.setTextColor("#111827");
  doc.text(data.customer.name || "-", left + 16, headerBottom + 36);
  doc.setFontSize(8.5);
  doc.setTextColor("#475569");
  const customerLines = [
    data.customer.address,
    data.customer.city ? data.customer.city : undefined,
    data.customer.mobile ? "M: " + data.customer.mobile : undefined,
    undefined,
    data.customer.email ? data.customer.email : undefined,
  ].filter(Boolean) as string[];
  doc.text(customerLines.length ? customerLines : ["-"], left + 16, headerBottom + 52, { maxWidth: 260, lineHeightFactor: 1.35 });

  const infoLeft = 355;
  const info = [
    ["Order #", data.orderNumber],
    ["Invoice Date", dateShort(data.orderDate)],
    ["Delivery Date", dateShort(data.deliveryDate)],
    ["Status", data.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())],
  ];
  info.forEach(([label, value], index) => {
    const y = headerBottom + 18 + index * 18;
    doc.setFontSize(9);
    doc.setTextColor("#64748b");
    doc.text(label, infoLeft, y);
    doc.setTextColor("#111827");
    doc.text(value, right - 10, y, { align: "right" });
  });

  const tableStartY = headerBottom + 84 + 26;

  const body = data.items.map((item, index) => {
    const isWindow = item.itemType === "window";
    const dimensions = isWindow ? `${item.length || 0} Length` : `${item.width} × ${item.height} = ${formatNumber(item.width * item.height)} Sq Ft`;
    return [
      String(index + 1),
      item.productName,
      item.notes || "",
      dimensions,
      formatNumber(item.quantity),
      currency(item.unitPrice),
      currency(item.amount),
    ];
  });

  addAutoTable(doc, {
    startY: tableStartY,
    head: [["#", "Item", "Description", "Dimensions", "Qty", "Price", "Amount"]],
    body,
    theme: "grid",
    margin: { left, right: 30, bottom: 54 },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [30, 30, 40],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      lineColor: [203, 213, 225],
      lineWidth: 0.6,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20 },
      1: { cellWidth: 80 },
      2: { cellWidth: 100 },
      3: { cellWidth: 155 },
      4: { halign: "center", cellWidth: 35 },
      5: { halign: "right", cellWidth: 60 },
      6: { halign: "right", cellWidth: 70 },
    },
  });

  let y = lastTableY(doc, 246) + 20;
  if (y > 620) {
    doc.addPage();
    y = 56;
  }

  const totalWidth = 205;
  const totalLeft = right - totalWidth;
  const totals: Array<[string, string, boolean]> = [
    ["Subtotal", currency(data.subtotal), false],
    ...(data.discountPercent > 0 ? [["Discount (" + data.discountPercent + "%)", "-" + currency(data.subtotal * data.discountPercent / 100), false] as [string, string, boolean]] : []),
    ["Grand Total", currency(data.total), true],
    ["Paid / Advance", currency(data.paid), false],
    ["Remaining Balance", currency(data.balance), false],
  ];
  totals.forEach(([label, value, isGrand], index) => {
    const rowY = y + index * 26;
    doc.setFillColor(isGrand ? 239 : 248, isGrand ? 246 : 250, isGrand ? 255 : 252);
    doc.rect(totalLeft, rowY, totalWidth, 26, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(totalLeft, rowY, totalWidth, 26);
    doc.setFontSize(isGrand ? 12 : 9);
    doc.setFont("helvetica", isGrand ? "bold" : "normal");
    doc.setTextColor("#111827");
    doc.text(label, totalLeft + 10, rowY + 17);
    doc.setFontSize(isGrand ? 13 : 10);
    doc.setTextColor(isGrand ? "#2563eb" : "#111827");
    doc.text(value, right - 10, rowY + 17, { align: "right" });
  });

  // --- BANK DETAILS (only if any bank info is filled) ---
  let nextY = y + totals.length * 26 + 16;
  let bankSectionHeight = 0;
  if (hasBankDetails(company)) {
    const bankLines = [
      company.bankName ? "Bank: " + company.bankName : undefined,
      company.accountTitle ? "Title: " + company.accountTitle : undefined,
      company.accountNumber ? "A/C: " + company.accountNumber : undefined,
      company.iban ? "IBAN: " + company.iban : undefined,
      company.branchName ? "Branch: " + company.branchName : undefined,
    ].filter(Boolean) as string[];

    if (bankLines.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor("#111827");
      doc.text("Bank Details", left, nextY);
      doc.setFontSize(8.5);
      doc.setTextColor("#475569");
      doc.text(bankLines, left, nextY + 14, { maxWidth: 310, lineHeightFactor: 1.35 });
      bankSectionHeight = 14 + bankLines.length * 12 + 6;
      nextY += bankSectionHeight;
    }
  }

  // --- TERMS & CONDITIONS ---
  doc.setFontSize(10);
  doc.setTextColor("#111827");
  doc.text("Terms and Conditions", left, nextY);
  nextY += 4;
  doc.setFontSize(8.5);
  doc.setTextColor("#475569");
  const terms = [
    "1. Prices are valid for the agreed quotation period.",
    "2. Work starts after advance payment confirmation.",
    "3. Any glass, design, site measurement, or hardware change may change the final amount.",
    "4. Remaining balance is payable after delivery or installation as agreed.",
  ];
  doc.text(terms, left, nextY + 12, { maxWidth: 310, lineHeightFactor: 1.35 });
  const termsSectionHeight = 12 + terms.length * 4 + 8;
  nextY += termsSectionHeight;

  // --- NOTES ---
  if (data.notes) {
    doc.setFontSize(10);
    doc.setTextColor("#111827");
    doc.text("Notes", left, nextY);
    nextY += 4;
    doc.setFontSize(8.5);
    doc.setTextColor("#475569");
    doc.text(data.notes, left, nextY + 12, { maxWidth: 310, lineHeightFactor: 1.35 });
    nextY += 12 + 20;
  }

  doc.text("Thank you for your business.", left, 786);

  addCustomerInvoiceFooter(doc);
  return doc;
}

export function createPurchaseInvoicePdf(data: PurchaseInvoiceData, company: CompanyProfile) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const headerBottom = addCompanyHeader(doc, company, "Purchase Invoice");
  doc.setFontSize(10);

  const summaryTop = headerBottom + 16;
  doc.setFontSize(12);
  doc.setTextColor("#111827");
  doc.text("Invoice #:", 40, summaryTop);
  doc.setFontSize(12);
  doc.text(data.invoiceNumber, 120, summaryTop);
  doc.text("Purchase Date:", 40, summaryTop + 18);
  doc.text(dateShort(data.date), 120, summaryTop + 18);

  doc.setFontSize(11);
  doc.setTextColor("#4b5563");
  doc.text("Supplier", 40, summaryTop + 54);
  doc.setFontSize(10);
  doc.text(data.supplier.name, 40, summaryTop + 70);
  doc.text(data.supplier.company || "---", 40, summaryTop + 84);
  doc.text(data.supplier.contact || "---", 40, summaryTop + 98);
  doc.text(data.supplier.address || "---", 40, summaryTop + 112);

  const tableTop = summaryTop + 130;
  addAutoTable(doc, {
    startY: tableTop,
    head: [["Product Name", "Quantity", "Purchase Price", "Amount"]],
    body: data.items.map((item) => [item.productName, String(item.quantity), currency(item.purchasePrice), currency(item.amount)]),
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  const finalY = lastTableY(doc, tableTop) + 20;
  doc.setFontSize(11);
  doc.text("Total Quantity:", 350, finalY);
  doc.text(String(data.totalQuantity), 520, finalY, { align: "right" });
  doc.text("Subtotal:", 350, finalY + 16);
  doc.text(currency(data.subtotal), 520, finalY + 16, { align: "right" });
  doc.text("Grand Total:", 350, finalY + 32);
  doc.text(currency(data.subtotal), 520, finalY + 32, { align: "right" });
  doc.text("Payment Type:", 350, finalY + 48);
  doc.text(data.paymentType, 520, finalY + 48, { align: "right" });
  doc.text("Outstanding Balance:", 350, finalY + 64);
  doc.text(currency(data.outstandingBalance), 520, finalY + 64, { align: "right" });

  return doc;
}

export function createPaymentReceiptPdf(data: PaymentReceiptData, company: CompanyProfile) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - 40;
  const headerBottom = addCompanyHeader(doc, company, "Payment Receipt");

  // Receipt Info (right side, below title)
  const infoTop = headerBottom + 16;
  doc.setFontSize(12);
  doc.setTextColor("#111827");
  doc.text("Receipt #:", right - 200, infoTop);
  doc.text(data.receiptNumber, right, infoTop, { align: "right" });
  doc.text("Payment Date:", right - 200, infoTop + 20);
  doc.text(dateShort(data.paymentDate), right, infoTop + 20, { align: "right" });

  // Supplier Details (left side)
  const supplierTop = infoTop + 50;
  doc.setFontSize(11);
  doc.setTextColor("#4b5563");
  doc.text("Supplier", 40, supplierTop);
  doc.setFontSize(10);
  doc.setTextColor("#111827");
  doc.text(data.supplier.name, 40, supplierTop + 16);
  doc.text(data.supplier.company || "---", 40, supplierTop + 30);
  doc.text(data.supplier.contact || "---", 40, supplierTop + 44);
  doc.text(data.supplier.address || "---", 40, supplierTop + 58);

  // Payment Summary (left side, label: value pairs with aligned values)
  const summaryTop = supplierTop + 90;
  const valueX = 160;
  const rowHeight = 18;
  const summaryItems = [
    ["Payment Method:", data.method],
    ["Amount Paid:", currency(data.amountPaid)],
    ["Previous Balance:", currency(data.previousBalance)],
    ["Remaining Balance:", currency(data.remainingBalance)],
  ];

  doc.setFontSize(10);
  summaryItems.forEach(([label, value], index) => {
    const y = summaryTop + index * rowHeight;
    doc.setTextColor("#4b5563");
    doc.text(label, 40, y);
    doc.setTextColor("#111827");
    doc.text(value, valueX, y);
  });

  // Notes
  const notesTop = summaryTop + summaryItems.length * rowHeight + 8;
  doc.setTextColor("#4b5563");
  doc.text("Notes:", 40, notesTop);
  doc.setTextColor("#111827");
  doc.text(data.notes || "-", 40, notesTop + 16);

  return doc;
}

export function createSupplierStatementPdf(data: SupplierStatementData, company: CompanyProfile) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const headerBottom = addCompanyHeader(doc, company, "Supplier Statement");

  const infoTop = headerBottom + 16;
  doc.setFontSize(11);
  doc.setTextColor("#4b5563");
  doc.text("Statement Date:", 40, infoTop);
  doc.setFontSize(10);
  doc.text(dateShort(data.statementDate), 120, infoTop);
  doc.text("Supplier:", 40, infoTop + 18);
  doc.text(data.supplier.name, 120, infoTop + 18);
  doc.text(data.supplier.company || "---", 120, infoTop + 32);
  doc.text(data.supplier.contact || "---", 120, infoTop + 46);
  doc.text(data.supplier.address || "---", 120, infoTop + 60);

  const rows = data.rows.map((row) => [
    row.date ? dateShort(row.date) : "",
    row.reference,
    row.type,
    row.description,
    row.debit ? currency(row.debit) : "",
    row.credit ? currency(row.credit) : "",
    currency(row.balance),
  ]);

  addAutoTable(doc, {
    startY: infoTop + 76,
    head: [["Date", "Reference No", "Type", "Description", "Debit", "Credit", "Balance"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  const footerTop = lastTableY(doc, infoTop + 76) + 24;
  doc.setFontSize(11);
  doc.text("Total Purchases:", 40, footerTop);
  doc.text(currency(data.totalPurchases), 160, footerTop);
  doc.text("Total Payments:", 40, footerTop + 16);
  doc.text(currency(data.totalPayments), 160, footerTop + 16);
  doc.text("Outstanding Balance:", 40, footerTop + 32);
  doc.text(currency(data.outstandingBalance), 160, footerTop + 32);
  doc.text("Closing Balance:", 40, footerTop + 48);
  doc.text(currency(data.closingBalance), 160, footerTop + 48);

  return doc;
}

export type PaymentStatementInput = {
  rows: PaymentStatementRow[];
  totalPaymentsReceived: number;
  outstandingAmount: number;
  numberOfTransactions: number;
};

export function createDailyPaymentStatementPdf(data: PaymentStatementInput, company: CompanyProfile, dateStr: string) {
  return buildPaymentStatement({
    company,
    meta: {
      title: "Daily Payment Statement",
      subtitle: "Payment Statement",
      selectedDate: dateStr,
      generatedAt: Date.now(),
    },
    summary: {
      totalPaymentsReceived: data.totalPaymentsReceived,
      outstandingAmount: data.outstandingAmount,
      numberOfTransactions: data.numberOfTransactions,
    },
    rows: data.rows,
    withNotes: true,
  });
}

export function createMonthlyPaymentStatementPdf(
  data: PaymentStatementInput,
  company: CompanyProfile,
  monthLabel: string,
  year: string,
) {
  return buildPaymentStatement({
    company,
    meta: {
      title: "Monthly Payment Statement",
      subtitle: "Payment Statement",
      month: monthLabel,
      year,
      generatedAt: Date.now(),
    },
    summary: {
      totalPaymentsReceived: data.totalPaymentsReceived,
      outstandingAmount: data.outstandingAmount,
      numberOfTransactions: data.numberOfTransactions,
    },
    rows: data.rows,
    finalTotals: {
      monthlyTotal: data.totalPaymentsReceived,
      outstandingTotal: data.outstandingAmount,
    },
  });
}

export function createAllPaymentsStatementPdf(data: PaymentStatementInput, company: CompanyProfile) {
  return buildPaymentStatement({
    company,
    meta: {
      title: "All Payments Statement",
      subtitle: "Complete Payment History",
      generatedAt: Date.now(),
    },
    summary: {
      totalPaymentsReceived: data.totalPaymentsReceived,
      outstandingAmount: data.outstandingAmount,
      numberOfTransactions: data.numberOfTransactions,
    },
    rows: data.rows,
  });
}
