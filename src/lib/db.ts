// Type definitions only — database is now handled by the FastAPI backend.

export interface Customer {
  id?: number;
  code: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  createdAt: number;
}

export interface Product {
  id?: number;
  code: string;
  name: string;
  category: string;
  openingType?: string;
  profileSeries?: string;
  glassType?: string;
  glassThickness?: string;
  frameColor?: string;
  handleType?: string;
  lockType?: string;
  unit: string;
  basePrice: number;
  description?: string;
  active: boolean;
  createdAt: number;
}

export interface QuotationItem {
  productId?: number;
  productName: string;
  width: number;
  height: number;
  sqft?: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string;
}

export interface Quotation {
  id?: number;
  number: string;
  customerId: number;
  customerName: string;
  date: number;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  extraCharges: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  notes?: string;
  createdAt: number;
}

export interface Order {
  id?: number;
  number: string;
  customerId: number;
  customerName: string;
  quotationId?: number;
  orderDate: number;
  deliveryDate?: number;
  items: QuotationItem[];
  total: number;
  paid: number;
  status: "pending" | "confirmed" | "in_production" | "ready" | "delivered" | "finished" | "cancelled";
  notes?: string;
  createdAt: number;
}

export interface Invoice {
  id?: number;
  number: string;
  orderId?: number;
  customerId: number;
  customerName: string;
  date: number;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  extraCharges: number;
  total: number;
  paid: number;
  createdAt: number;
}

export interface Payment {
  id?: number;
  invoiceId?: number;
  orderId?: number;
  customerId?: number;
  customerName?: string;
  supplierId?: number;
  supplierName?: string;
  amount: number;
  method: string;
  date: number;
  notes?: string;
  createdAt: number;
}

export interface Expense {
  id?: number;
  category: string;
  amount: number;
  date: number;
  description?: string;
  createdBy?: string;
  createdAt: number;
}

export interface Supplier {
  id?: number;
  name: string;
  company?: string;
  contact: string;
  mobile?: string;
  city?: string;
  email?: string;
  address?: string;
  products?: string;
  notes?: string;
  createdAt: number;
}

export interface PurchaseItem {
  productName: string;
  widthFt?: number;
  heightFt?: number;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  amount: number;
}

export interface Purchase {
  id?: number;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  items: PurchaseItem[];
  paymentType: string;
  totalAmount: number;
  date: number;
  notes?: string;
  createdAt: number;
}

export interface InventoryItem {
  id?: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  supplier?: string;
  widthFt?: number;
  heightFt?: number;
  stockQty?: number;
  createdAt: number;
}

export interface Measurement {
  id?: number;
  customerName: string;
  style: string;
  date: number;
  fields: string;
  notes?: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: string;
}

export interface User {
  id?: number;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  status: "active" | "inactive";
  role: "admin" | "user";
  createdAt: number;
}

export interface UserPermission {
  id?: number;
  userId: number;
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canExport: boolean;
}

export interface BackupRecord {
  id?: number;
  type: "snapshot" | "file";
  createdAt: number;
  size: number;
  path?: string;
  tables?: string;
  data?: string;
  filename?: string;
}

export const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "quotations", label: "Quotations" },
  { key: "orders", label: "Orders" },
  { key: "invoices", label: "Customer Invoices" },
  { key: "payments", label: "Payments" },
  { key: "paymentReceipts", label: "Payment Receipts" },
  { key: "purchase", label: "Purchase" },
  { key: "suppliers", label: "Suppliers" },
  { key: "products", label: "Products" },
  { key: "measurements", label: "Measurements" },
  { key: "inventory", label: "Inventory" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
  { key: "dailyPaymentStatement", label: "Daily Payment Statement" },
  { key: "settings", label: "Settings" },
  { key: "backup", label: "Backup" },
] as const;

export function createDefaultPermissions(userId: number): UserPermission[] {
  return MODULES.map((m) => ({
    userId,
    moduleKey: m.key,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canPrint: true,
    canExport: true,
  }));
}

export function nextCode(prefix: string, n: number, pad = 4) {
  return `${prefix}-${String(n + 1).padStart(pad, "0")}`;
}
