import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { respondWithExport } from '../services/exportService';
import { streamTablePdf } from '../services/pdfService';
import { recordAudit } from '../services/auditService';

const router = Router();
router.use(authenticate);

function dateRange(req: any) {
  const { from, to } = req.query as Record<string, string | undefined>;
  const gte = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
  const lte = to ? new Date(to) : new Date();
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

async function exportOrJson(req: any, res: any, filename: string, title: string, columns: any[], rows: any[]) {
  const format = req.query.format as string | undefined;
  if (format === 'pdf') {
    await recordAudit({ userId: req.user!.sub, action: 'EXPORT', module: title });
    return streamTablePdf(
      res,
      filename,
      title,
      columns.map((c) => ({ ...c, width: c.width ?? 90 })),
      rows
    );
  }
  if (format === 'csv' || format === 'excel' || format === 'xlsx') {
    await recordAudit({ userId: req.user!.sub, action: 'EXPORT', module: title });
  }
  return respondWithExport(res, format, filename, columns, rows);
}

// ---- Sales report ----
router.get('/sales', asyncHandler(async (req, res) => {
  const range = dateRange(req);
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: range.gte, lte: range.lte } },
    include: { customer: true, createdBy: { select: { name: true } } },
    orderBy: { saleDate: 'desc' },
  });
  const rows = sales.map((s) => ({
    invoiceNumber: s.invoiceNumber,
    date: s.saleDate.toISOString().slice(0, 10),
    customer: s.customer?.name ?? s.walkInCustomerName ?? 'Walk-in',
    subTotal: Number(s.subTotal).toFixed(2),
    discount: Number(s.discountAmount).toFixed(2),
    gst: Number(s.gstAmount).toFixed(2),
    total: Number(s.totalAmount).toFixed(2),
    paid: Number(s.paidAmount).toFixed(2),
    status: s.paymentStatus,
    method: s.paymentMethod,
    billedBy: s.createdBy.name,
  }));
  const columns = [
    { header: 'Invoice #', key: 'invoiceNumber' }, { header: 'Date', key: 'date' }, { header: 'Customer', key: 'customer' },
    { header: 'Subtotal', key: 'subTotal' }, { header: 'Discount', key: 'discount' }, { header: 'GST', key: 'gst' },
    { header: 'Total', key: 'total' }, { header: 'Paid', key: 'paid' }, { header: 'Status', key: 'status' },
    { header: 'Method', key: 'method' }, { header: 'Billed By', key: 'billedBy' },
  ];
  await exportOrJson(req, res, 'sales-report', 'Sales Report', columns, rows);
}));

// ---- Purchases report ----
router.get('/purchases', asyncHandler(async (req, res) => {
  const range = dateRange(req);
  const purchases = await prisma.purchase.findMany({
    where: { purchaseDate: { gte: range.gte, lte: range.lte } },
    include: { supplier: true },
    orderBy: { purchaseDate: 'desc' },
  });
  const rows = purchases.map((p) => ({
    purchaseNumber: p.purchaseNumber,
    date: p.purchaseDate.toISOString().slice(0, 10),
    supplier: p.supplier.name,
    subTotal: Number(p.subTotal).toFixed(2),
    discount: Number(p.discountAmount).toFixed(2),
    gst: Number(p.gstAmount).toFixed(2),
    total: Number(p.totalAmount).toFixed(2),
    paid: Number(p.paidAmount).toFixed(2),
    status: p.paymentStatus,
  }));
  const columns = [
    { header: 'Purchase #', key: 'purchaseNumber' }, { header: 'Date', key: 'date' }, { header: 'Supplier', key: 'supplier' },
    { header: 'Subtotal', key: 'subTotal' }, { header: 'Discount', key: 'discount' }, { header: 'GST', key: 'gst' },
    { header: 'Total', key: 'total' }, { header: 'Paid', key: 'paid' }, { header: 'Status', key: 'status' },
  ];
  await exportOrJson(req, res, 'purchases-report', 'Purchases Report', columns, rows);
}));

// ---- Inventory / stock valuation report ----
router.get('/inventory', asyncHandler(async (req, res) => {
  const batches = await prisma.batch.findMany({
    where: { quantity: { gt: 0 } },
    include: { medicine: true, supplier: true },
    orderBy: { expiryDate: 'asc' },
  });
  const rows = batches.map((b) => ({
    medicine: b.medicine.name,
    batch: b.batchNumber,
    supplier: b.supplier?.name ?? '-',
    quantity: b.quantity,
    purchasePrice: Number(b.purchasePrice).toFixed(2),
    mrp: Number(b.mrp).toFixed(2),
    valueAtCost: (b.quantity * Number(b.purchasePrice)).toFixed(2),
    valueAtMrp: (b.quantity * Number(b.mrp)).toFixed(2),
    expiry: b.expiryDate.toISOString().slice(0, 10),
  }));
  const columns = [
    { header: 'Medicine', key: 'medicine' }, { header: 'Batch', key: 'batch' }, { header: 'Supplier', key: 'supplier' },
    { header: 'Qty', key: 'quantity' }, { header: 'Cost Price', key: 'purchasePrice' }, { header: 'MRP', key: 'mrp' },
    { header: 'Value @ Cost', key: 'valueAtCost' }, { header: 'Value @ MRP', key: 'valueAtMrp' }, { header: 'Expiry', key: 'expiry' },
  ];
  await exportOrJson(req, res, 'inventory-report', 'Inventory & Stock Valuation Report', columns, rows);
}));

// ---- Profit report (revenue - COGS, approximated via current batch purchase price) ----
router.get('/profit', asyncHandler(async (req, res) => {
  const range = dateRange(req);
  const saleItems = await prisma.saleItem.findMany({
    where: { sale: { saleDate: { gte: range.gte, lte: range.lte } } },
    include: { medicine: true, batch: true, sale: true },
  });
  const byMedicine = new Map<string, { medicine: string; qty: number; revenue: number; cost: number }>();
  for (const item of saleItems) {
    const key = item.medicineId;
    const revenue = Number(item.lineTotal);
    const cost = Number(item.batch.purchasePrice) * item.quantity;
    const entry = byMedicine.get(key) ?? { medicine: item.medicine.name, qty: 0, revenue: 0, cost: 0 };
    entry.qty += item.quantity;
    entry.revenue += revenue;
    entry.cost += cost;
    byMedicine.set(key, entry);
  }
  const rows = Array.from(byMedicine.values()).map((e) => ({
    medicine: e.medicine,
    quantitySold: e.qty,
    revenue: e.revenue.toFixed(2),
    cost: e.cost.toFixed(2),
    profit: (e.revenue - e.cost).toFixed(2),
    margin: e.revenue > 0 ? (((e.revenue - e.cost) / e.revenue) * 100).toFixed(1) + '%' : '0%',
  }));
  const columns = [
    { header: 'Medicine', key: 'medicine' }, { header: 'Qty Sold', key: 'quantitySold' }, { header: 'Revenue', key: 'revenue' },
    { header: 'Cost', key: 'cost' }, { header: 'Profit', key: 'profit' }, { header: 'Margin', key: 'margin' },
  ];
  await exportOrJson(req, res, 'profit-report', 'Profit Report', columns, rows);
}));

// ---- GST report ----
router.get('/gst', asyncHandler(async (req, res) => {
  const range = dateRange(req);
  const [sales, purchases] = await Promise.all([
    prisma.sale.findMany({ where: { saleDate: { gte: range.gte, lte: range.lte } } }),
    prisma.purchase.findMany({ where: { purchaseDate: { gte: range.gte, lte: range.lte } } }),
  ]);
  const outputGst = sales.reduce((s, x) => s + Number(x.gstAmount), 0);
  const inputGst = purchases.reduce((s, x) => s + Number(x.gstAmount), 0);
  const rows = [
    { particular: 'Output GST (collected on sales)', amount: outputGst.toFixed(2) },
    { particular: 'Input GST (paid on purchases)', amount: inputGst.toFixed(2) },
    { particular: 'Net GST Payable', amount: (outputGst - inputGst).toFixed(2) },
  ];
  const columns = [{ header: 'Particular', key: 'particular', width: 260 }, { header: 'Amount (Rs.)', key: 'amount' }];
  await exportOrJson(req, res, 'gst-report', 'GST Report', columns, rows);
}));

// ---- Customer payments (outstanding) ----
router.get('/customer-payments', asyncHandler(async (req, res) => {
  const customers = await prisma.customer.findMany({ include: { sales: true } });
  const rows = customers
    .map((c) => {
      const totalBilled = c.sales.reduce((s, x) => s + Number(x.totalAmount), 0);
      const totalPaid = c.sales.reduce((s, x) => s + Number(x.paidAmount), 0);
      return { customer: c.name, phone: c.phone ?? '-', totalBilled: totalBilled.toFixed(2), totalPaid: totalPaid.toFixed(2), outstanding: (totalBilled - totalPaid).toFixed(2) };
    })
    .filter((r) => Number(r.outstanding) > 0.009);
  const columns = [
    { header: 'Customer', key: 'customer' }, { header: 'Phone', key: 'phone' }, { header: 'Total Billed', key: 'totalBilled' },
    { header: 'Total Paid', key: 'totalPaid' }, { header: 'Outstanding', key: 'outstanding' },
  ];
  await exportOrJson(req, res, 'customer-payments-report', 'Customer Outstanding Payments', columns, rows);
}));

// ---- Supplier payments (pending) ----
router.get('/supplier-payments', asyncHandler(async (req, res) => {
  const suppliers = await prisma.supplier.findMany({ include: { purchases: true } });
  const rows = suppliers
    .map((s) => {
      const totalPurchased = s.purchases.reduce((sum, x) => sum + Number(x.totalAmount), 0);
      const totalPaid = s.purchases.reduce((sum, x) => sum + Number(x.paidAmount), 0);
      return { supplier: s.name, phone: s.phone ?? '-', totalPurchased: totalPurchased.toFixed(2), totalPaid: totalPaid.toFixed(2), pending: (totalPurchased - totalPaid).toFixed(2) };
    })
    .filter((r) => Number(r.pending) > 0.009);
  const columns = [
    { header: 'Supplier', key: 'supplier' }, { header: 'Phone', key: 'phone' }, { header: 'Total Purchased', key: 'totalPurchased' },
    { header: 'Total Paid', key: 'totalPaid' }, { header: 'Pending', key: 'pending' },
  ];
  await exportOrJson(req, res, 'supplier-payments-report', 'Supplier Pending Payments', columns, rows);
}));

// ---- Expiry report ----
router.get('/expiry', asyncHandler(async (req, res) => {
  const days = Number(req.query.days ?? 90);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const batches = await prisma.batch.findMany({
    where: { quantity: { gt: 0 }, expiryDate: { lte: cutoff } },
    include: { medicine: true, supplier: true },
    orderBy: { expiryDate: 'asc' },
  });
  const today = new Date();
  const rows = batches.map((b) => ({
    medicine: b.medicine.name,
    batch: b.batchNumber,
    supplier: b.supplier?.name ?? '-',
    quantity: b.quantity,
    expiry: b.expiryDate.toISOString().slice(0, 10),
    status: b.expiryDate < today ? 'EXPIRED' : 'EXPIRING SOON',
    daysLeft: Math.ceil((b.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  }));
  const columns = [
    { header: 'Medicine', key: 'medicine' }, { header: 'Batch', key: 'batch' }, { header: 'Supplier', key: 'supplier' },
    { header: 'Qty', key: 'quantity' }, { header: 'Expiry', key: 'expiry' }, { header: 'Status', key: 'status' }, { header: 'Days Left', key: 'daysLeft' },
  ];
  await exportOrJson(req, res, 'expiry-report', `Expiry Report (within ${days} days)`, columns, rows);
}));

// ---- Stock valuation (alias of inventory, kept for clarity of nav) ----
router.get('/stock-valuation', asyncHandler(async (req, res) => {
  res.redirect(307, `/api/reports/inventory${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
}));

export default router;
