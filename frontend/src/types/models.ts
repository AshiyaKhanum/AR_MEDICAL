export type Role = 'ADMIN' | 'PHARMACIST' | 'STAFF';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'REFUNDED';
export type ReturnType = 'SALE' | 'PURCHASE';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

export interface Category {
  id: string;
  name: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  contact?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  isActive: boolean;
  totalPurchased?: number;
  pendingAmount?: number;
  purchaseCount?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  totalBilled?: number;
  outstanding?: number;
  salesCount?: number;
}

export interface Batch {
  id: string;
  medicineId: string;
  medicine?: Medicine;
  batchNumber: string;
  supplierId?: string | null;
  supplier?: Supplier | null;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gstPercent: number;
  quantity: number;
  initialQuantity: number;
  manufacturingDate?: string | null;
  expiryDate: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  manufacturerId?: string | null;
  manufacturer?: Manufacturer | null;
  sku: string;
  barcode?: string | null;
  hsnCode?: string | null;
  gstPercent: number;
  unit: string;
  minStockLevel: number;
  isActive: boolean;
  batches?: Batch[];
  totalStock?: number;
  nearestExpiry?: string | null;
  hasExpiredStock?: boolean;
}

export interface SaleItem {
  id: string;
  medicineId: string;
  medicine?: Medicine;
  batchId: string;
  batch?: Batch;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  gstPercent: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customer?: Customer | null;
  walkInCustomerName?: string | null;
  walkInCustomerPhone?: string | null;
  saleDate: string;
  subTotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  createdBy?: { name: string };
  items: SaleItem[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  saleId?: string | null;
  sale?: Sale | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
  paidAt: string;
}

export interface PurchaseItem {
  id: string;
  medicineId: string;
  medicine?: Medicine;
  batchId: string;
  batch?: Batch;
  quantity: number;
  purchasePrice: number;
  gstPercent: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplier?: Supplier;
  invoiceNumber?: string | null;
  purchaseDate: string;
  subTotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  createdBy?: { name: string };
  items: PurchaseItem[];
}

export interface ReturnItem {
  id: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  type: ReturnType;
  saleId?: string | null;
  sale?: Sale | null;
  purchaseId?: string | null;
  purchase?: Purchase | null;
  reason?: string | null;
  refundAmount: number;
  status: ReturnStatus;
  createdBy?: { name: string };
  items: ReturnItem[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: { name: string; email: string; role: Role } | null;
  action: string;
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  todaySales: number;
  todaySalesCount: number;
  totalSales: number;
  totalSalesCount: number;
  todayPurchases: number;
  totalPurchases: number;
  pendingReceivables: number;
  pendingPayables: number;
  profitLast30Days: number;
  inventory: {
    totalMedicines: number;
    totalBatches: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiring30Count: number;
    expiredCount: number;
    stockValueAtCost: number;
    stockValueAtMrp: number;
  };
  chartSeries: { date: string; sales: number; purchases: number }[];
  recentSales: Sale[];
  recentPurchases: Purchase[];
}
