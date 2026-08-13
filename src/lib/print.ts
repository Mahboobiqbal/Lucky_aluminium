import { currency, dateShort } from "@/lib/format";
import type { Customer, Expense, InventoryItem, Order } from "@/lib/db";
import { APP_LOGO_URL } from "@/lib/brand";

export type PhoneEntry = {
  label: string;
  number: string;
};

export type CompanyProfile = {
  companyName?: string;
  address?: string;
  phone?: string;
  phones?: string[];
  phoneEntries?: PhoneEntry[];
  email?: string;
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  branchName?: string;
};

const defaultCompany: Required<Omit<CompanyProfile, "phones" | "phoneEntries" | "bankName" | "accountTitle" | "accountNumber" | "iban" | "branchName">> = {
  companyName: "UDYANA uPVC Works",
  address: "Industrial Area, Phase 2",
  phone: "+91 90000 00000",
  email: "contact@udyana.example",
};

export function companyFromSettings(settings: { key: string; value: string }[]): CompanyProfile {
  const raw: Record<string, string> = {};
  settings.forEach((s) => { raw[s.key] = s.value; });

  const profile: CompanyProfile = {
    companyName: raw.companyName,
    address: raw.address,
    phone: raw.phone,
    email: raw.email,
    bankName: raw.bankName,
    accountTitle: raw.accountTitle,
    accountNumber: raw.accountNumber,
    iban: raw.iban,
    branchName: raw.branchName,
  };

  // Parse phones from JSON array (backward compatible with single phone string)
  try {
    const parsed = JSON.parse(raw.phone || "[]");
    // Check if it's an array of {label, number} objects
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "label" in parsed[0]) {
      profile.phoneEntries = parsed as PhoneEntry[];
      // Also provide flat phones array for backward compat
      profile.phones = parsed.map((p: PhoneEntry) => p.number).filter(Boolean);
    } else {
      profile.phones = Array.isArray(parsed) ? parsed : [raw.phone].filter(Boolean);
    }
  } catch {
    profile.phones = raw.phone ? [raw.phone] : [];
  }

  return profile;
}

export function hasBankDetails(company: CompanyProfile): boolean {
  return !!(company.bankName || company.accountTitle || company.accountNumber);
}

export function phoneDisplay(company: CompanyProfile): string {
  return company.phones?.filter(Boolean).join(" | ") || company.phone || "";
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openPrintDocument(title: string, body: string, company?: CompanyProfile) {
  const profile = { ...defaultCompany, ...company };
  const printWindow = window.open("", "", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          .brand { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 22px; }
          .logo { width: 54px; height: 54px; border-radius: 52px; object-fit: contain; border: 1px solid #d1d5db; padding: 3px; background: white; }
          .company { font-size: 22px; font-weight: 800; }
          .muted { color: #6b7280; font-size: 12px; line-height: 1.5; }
          h1 { font-size: 20px; margin: 0 0 10px; }
          h2 { font-size: 15px; margin: 18px 0 8px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 22px; margin-bottom: 16px; }
          .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
          .value { font-weight: 700; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; color: #374151; }
          .right { text-align: right; }
          .total { font-weight: 800; background: #f9fafb; }
          .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #d1d5db; text-align: center; }
          @media print { body { margin: 18mm; } button { display: none; } }
        </style>
      </head>
<body>
        <div class="brand">
          <img class="logo" src="${esc(APP_LOGO_URL)}" alt="${esc(profile.companyName)} logo" />
          <div>
            <div class="company">${esc(profile.companyName)}</div>
            <div class="muted">${esc(profile.address)}</div>
            <div class="muted" style="color:#4b5563">
              ${profile.phoneEntries && profile.phoneEntries.length > 0
                ? profile.phoneEntries
                    .filter((p) => p.number)
                    .map((p) => esc(p.label ? p.label + ": " + p.number : p.number))
                    .join("<br />")
                : esc(phoneDisplay(profile))}
              ${profile.email ? "<br />Email: " + esc(profile.email) : ""}
            </div>
          </div>
        </div>
        ${body}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function printCustomer(
  customer: Customer,
  company?: CompanyProfile,
  orders?: Order[],
  totals?: { total: number; paid: number },
) {
  const totalBilled = totals?.total ?? 0;
  const totalPaid = totals?.paid ?? 0;
  const totalBalance = Math.max(0, totalBilled - totalPaid);
  const customerOrders = orders ?? [];

  openPrintDocument(
    `Customer ${customer.code}`,
    `
      <h1>Customer Profile</h1>
      <div class="grid">
        <div><div class="label">Code</div><div class="value">${esc(customer.code)}</div></div>
        <div><div class="label">Name</div><div class="value">${esc(customer.name)}</div></div>
        <div><div class="label">Mobile</div><div class="value">${esc(customer.mobile)}</div></div>
        
        <div><div class="label">Email</div><div class="value">${esc(customer.email || "-")}</div></div>
        <div><div class="label">City</div><div class="value">${esc(customer.city || "-")}</div></div>
        <div><div class="label">Added</div><div class="value">${esc(dateShort(customer.createdAt))}</div></div>
      </div>
      <h2>Address</h2>
      <p>${esc(customer.address || "-")}</p>
      <h2>Notes</h2>
      <p>${esc(customer.notes || "-")}</p>

      <h2>Payment Summary</h2>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div style="border:1px solid #d1d5db;border-radius:6px;padding:10px">
          <div class="label">Total Billed</div>
          <div class="value">${esc(currency(totalBilled))}</div>
          <div style="font-size:11px;color:#6b7280">${customerOrders.length} order(s)</div>
        </div>
        <div style="border:1px solid #d1d5db;border-radius:6px;padding:10px">
          <div class="label">Total Paid</div>
          <div class="value" style="color:#059669">${esc(currency(totalPaid))}</div>
        </div>
        <div style="border:1px solid #d1d5db;border-radius:6px;padding:10px">
          <div class="label">Remaining Balance</div>
          <div class="value" style="color:#dc2626">${esc(currency(totalBalance))}</div>
        </div>
      </div>

      ${customerOrders.length > 0 ? `
        <h2>Order History</h2>
        <table>
          <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Remaining Balance</th><th>Status</th></tr></thead>
          <tbody>
            ${customerOrders
              .map(
                (o) =>
                  `<tr>
                    <td>${esc(o.number)}</td>
                    <td>${esc(dateShort(o.orderDate))}</td>
                    <td>${esc(o.items.length)}</td>
                    <td class="right">${esc(currency(o.total))}</td>
                    <td class="right">${esc(currency(o.paid))}</td>
                    <td class="right">${esc(currency(Math.max(0, o.total - o.paid)))}</td>
                    <td>${esc(o.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}</td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      ` : '<p style="color:#6b7280;font-size:13px">No orders yet.</p>'}
    `,
    company,
  );
}

export function printCustomers(
  customers: Customer[],
  company?: CompanyProfile,
  paymentMap?: Record<number, { total: number; paid: number }>,
) {
  openPrintDocument(
    "Customers",
    `
      <h1>Customer List</h1>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Mobile</th><th>City</th><th>Email</th><th class="right">Paid</th><th class="right">Remaining Balance</th></tr></thead>
        <tbody>
          ${customers
            .map((c) => {
              const pmt = c.id && paymentMap ? paymentMap[c.id] : undefined;
              const paid = pmt?.paid ?? 0;
              const balance = pmt ? pmt.total - pmt.paid : 0;
              return `<tr>
                <td>${esc(c.code)}</td>
                <td>${esc(c.name)}</td>
                <td>${esc(c.mobile)}</td>
                <td>${esc(c.city || "-")}</td>
                <td>${esc(c.email || "-")}</td>
                <td class="right">${paid > 0 ? esc(currency(paid)) : "—"}</td>
                <td class="right">${balance > 0 ? esc(currency(balance)) : "—"}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `,
    company,
  );
}

export function printInvoice(order: Order, company?: CompanyProfile) {
  openPrintDocument(
    `Invoice INV-${String(order.id).padStart(4, "0")}`,
    `
      <h1>Invoice INV-${String(order.id).padStart(4, "0")}</h1>
      <div class="grid">
        <div><div class="label">Order</div><div class="value">${esc(order.number)}</div></div>
        <div><div class="label">Customer</div><div class="value">${esc(order.customerName)}</div></div>
        <div><div class="label">Order date</div><div class="value">${esc(dateShort(order.orderDate))}</div></div>
        <div><div class="label">Delivery date</div><div class="value">${esc(dateShort(order.deliveryDate))}</div></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th>Description</th><th>Dimensions</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          ${order.items
            .map(
              (item) => {
                const isWindow = item.itemType === "window";
                const dims = isWindow ? `${item.length} ft` : `${item.width} × ${item.height} = ${(item.width * item.height).toFixed(2)} sq ft`;
                return `<tr><td>${esc(item.productName)}</td><td>${esc(item.notes || "")}</td><td>${esc(dims)}</td><td class="right">${esc(item.quantity)}</td><td class="right">${esc(currency(item.unitPrice))}</td><td class="right">${esc(currency(item.amount))}</td></tr>`;
              }
            )
            .join("")}
          <tr class="total"><td colspan="5" class="right">Total</td><td class="right">${esc(currency(order.total))}</td></tr>
          <tr class="total"><td colspan="5" class="right">Paid</td><td class="right">${esc(currency(order.paid))}</td></tr>
          <tr class="total"><td colspan="5" class="right">Remaining Balance</td><td class="right">${esc(currency(order.total - order.paid))}</td></tr>
        </tbody>
      </table>
      <div class="footer muted">Thank you for your business.</div>
    `,
    company,
  );
}

export function printReport(title: string, rows: string[][], company?: CompanyProfile) {
  const [head = [], ...body] = rows;
  openPrintDocument(
    title,
    `
      <h1>${esc(title)}</h1>
      <table>
        <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    `,
    company,
  );
}

export function reportRowsForInventory(items: InventoryItem[]) {
  return [
    ["Item", "Category", "Stock", "Minimum", "Cost"],
    ...items.map((i) => [i.name, i.category, `${i.currentStock} ${i.unit}`, `${i.minStock} ${i.unit}`, currency(i.costPrice)]),
  ];
}

export function reportRowsForExpenses(expenses: Expense[]) {
  return [
    ["Date", "Category", "Description", "Amount"],
    ...expenses.map((e) => [dateShort(e.date), e.category, e.description || "-", currency(e.amount)]),
  ];
}
