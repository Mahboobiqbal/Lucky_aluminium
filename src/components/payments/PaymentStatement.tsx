import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { CompanyProfile } from "@/lib/print";
import { currency, dateShort, dateTime } from "@/lib/format";
import { addAppLogoToPdf } from "@/lib/brand";

export type PaymentStatementRow = {
  date: number;
  invoiceNumber: string;
  customerName: string;
  paymentMethod: string;
  amountPaid: number;
  remainingBalance: number;
  notes?: string;
};

export type PaymentStatementSummary = {
  totalPaymentsReceived: number;
  outstandingAmount: number;
  numberOfTransactions: number;
};

export type PaymentStatementMeta = {
  title: string;
  subtitle?: string;
  selectedDate?: string;
  month?: string;
  year?: string;
  generatedAt?: number;
};

type SummaryCard = {
  label: string;
  value: string;
  color?: [number, number, number];
};

const DARK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [75, 85, 99];
const GRID: [number, number, number] = [226, 232, 240];
const HEAD_FILL: [number, number, number] = [241, 245, 249];
const HEAD_TEXT: [number, number, number] = [15, 23, 42];

function withCompanyDefaults(company: CompanyProfile): Required<CompanyProfile> {
  return {
    companyName: company.companyName || "Lucky Aluminium",
    address: company.address || "Industrial Area, Phase 2",
    phone: company.phone || "+91 90000 00000",
    email: company.email || "contact@luckyaluminium.example",
    phones: company.phones || [],
    phoneEntries: company.phoneEntries || [],
    bankName: company.bankName || "",
    accountTitle: company.accountTitle || "",
    accountNumber: company.accountNumber || "",
    iban: company.iban || "",
    branchName: company.branchName || "",
    easypaisaAccountTitle: company.easypaisaAccountTitle || "",
    easypaisaAccountNumber: company.easypaisaAccountNumber || "",
  };
}

export function statementHeader(doc: jsPDF, company: CompanyProfile, title: string): number {
  const profile = withCompanyDefaults(company);
  const left = 40;
  const right = 555;
  const top = 44;
  const logoSize = 40;
  const textLeft = left + logoSize + 16;

  const logoPlaced = addAppLogoToPdf(doc, left, top, logoSize, logoSize);
  if (!logoPlaced) {
    doc.setFillColor(55, 65, 81);
    doc.roundedRect(left, top, logoSize, logoSize, 8, 8, "F");
    doc.setFontSize(20);
    doc.setTextColor("#ffffff");
    doc.text((profile.companyName.charAt(0) || "U").toUpperCase(), left + logoSize / 2, top + logoSize / 2 + 6, {
      align: "center",
    });
  }

  // Title on the right, wrapped so it never collides with company info
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(title, 160);
  doc.text(titleLines, right - 8, top + 16, { align: "right" });

  // Company block on the left, stacked with wrapping
  let y = top + 14;
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(profile.companyName, 300);
  doc.text(nameLines, textLeft, y);
  y += nameLines.length * 18;

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const addressLines = doc.splitTextToSize(profile.address.split("\n").join(" "), 300);
  doc.text(addressLines, textLeft, y);
  y += addressLines.length * 11;

  const phoneEntries = company.phoneEntries || [];
  if (phoneEntries.length > 0) {
    phoneEntries.forEach((entry) => {
      if (entry.number) {
        const label = entry.label ? entry.label + ": " : "";
        const lines = doc.splitTextToSize(label + entry.number, 300);
        doc.text(lines, textLeft, y);
        y += lines.length * 11;
      }
    });
  } else {
    const phones = company.phones?.filter(Boolean) || [];
    if (phones.length > 0) {
      phones.forEach((p) => {
        const lines = doc.splitTextToSize(p, 300);
        doc.text(lines, textLeft, y);
        y += lines.length * 11;
      });
    }
  }
  if (profile.email) {
    doc.text("Email: " + profile.email, textLeft, y);
    y += 11;
  }

  const dividerY = y + 6;
  doc.setDrawColor(...GRID);
  doc.setLineWidth(1);
  doc.line(left, dividerY, right, dividerY);

  return dividerY + 4;
}

export function statementSummaryCards(doc: jsPDF, startY: number, cards: SummaryCard[]) {
  const left = 40;
  const cardWidth = (555 - left - (cards.length - 1) * 12) / cards.length;
  const cardHeight = 56;
  const radius = 6;

  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + 12);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, startY, cardWidth, cardHeight, radius, radius, "F");
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, startY, cardWidth, cardHeight, radius, radius, "S");

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), x + 12, startY + 18);

    doc.setFontSize(13);
    doc.setTextColor(...(card.color ?? DARK));
    doc.text(card.value, x + 12, startY + 40);
  });

  return startY + cardHeight;
}

export function statementFooter(doc: jsPDF, generatedAt?: number) {
  const pageCount = doc.getNumberOfPages();
  const left = 40;
  const right = 555;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 28;

    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.5);
    doc.line(left, footerY - 8, right, footerY - 8);

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(generatedAt ? "Generated on " + dateTime(generatedAt) : "", left, footerY);
    doc.text("Page " + i + " of " + pageCount, right, footerY, { align: "right" });
  }
}

export function statementTable(
  doc: jsPDF,
  startY: number,
  rows: PaymentStatementRow[],
  opts?: { withNotes?: boolean; finalTotals?: { monthlyTotal: number; outstandingTotal: number } },
) {
  const head = opts?.withNotes
    ? ["Date", "Invoice #", "Customer", "Method", "Amount", "Remaining Balance", "Notes"]
    : ["Date", "Invoice #", "Customer", "Method", "Amount", "Remaining Balance"];
  const body =
    rows.length > 0
      ? rows.map((row) => [
          dateShort(row.date),
          row.invoiceNumber,
          row.customerName,
          row.paymentMethod,
          currency(row.amountPaid),
          currency(row.remainingBalance),
          ...(opts?.withNotes ? [row.notes || "-"] : []),
        ])
      : [[...head.map(() => "-")]];

  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: "grid",
    margin: { left: 40, right: 40, bottom: 52 },
    pageBreak: "auto",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: HEAD_TEXT,
      fontStyle: "bold",
      lineColor: GRID,
      lineWidth: 0.5,
    },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      lineColor: GRID,
      lineWidth: 0.5,
      textColor: DARK,
      overflow: "linebreak",
      valign: "middle",
    },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      ...(opts?.withNotes ? { 6: { cellWidth: 90 } } : {}),
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && rows.length === 0) {
        data.cell.styles.halign = "center";
        data.cell.styles.textColor = MUTED;
      }
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY ?? startY;

  if (opts?.finalTotals) {
    finalY += 20;
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text("Monthly Total:", 360, finalY);
    doc.text(currency(opts.finalTotals.monthlyTotal), 555, finalY, { align: "right" });
    doc.text("Outstanding Total:", 360, finalY + 18);
    doc.text(currency(opts.finalTotals.outstandingTotal), 555, finalY + 18, { align: "right" });
  }

  return finalY;
}

export type BuildStatementArgs = {
  company: CompanyProfile;
  meta: PaymentStatementMeta;
  summary: PaymentStatementSummary;
  rows: PaymentStatementRow[];
  withNotes?: boolean;
  finalTotals?: { monthlyTotal: number; outstandingTotal: number };
  cards?: SummaryCard[];
};

export function buildPaymentStatement({
  company,
  meta,
  summary,
  rows,
  withNotes = false,
  finalTotals,
  cards,
}: BuildStatementArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const generatedAt = meta.generatedAt ?? Date.now();

  const headerBottom = statementHeader(doc, company, meta.title) + 10;

  let y = headerBottom;
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const metaParts = [meta.subtitle, meta.selectedDate, meta.month && meta.year ? meta.month + " " + meta.year : ""].filter(Boolean);
  doc.text(metaParts.join(" | "), 40, y);

  y += 18;

  const defaultCards: SummaryCard[] = cards ?? [
    {
      label: "Total Payments Received",
      value: currency(summary.totalPaymentsReceived),
      color: [5, 150, 105],
    },
    {
      label: "Outstanding Amount",
      value: currency(summary.outstandingAmount),
      color: [225, 29, 72],
    },
    { label: "Transactions", value: String(summary.numberOfTransactions) },
  ];

  const tableStart = statementSummaryCards(doc, y, defaultCards) + 18;
  statementTable(doc, tableStart, rows, { withNotes, finalTotals });
  statementFooter(doc, generatedAt);

  return doc;
}
