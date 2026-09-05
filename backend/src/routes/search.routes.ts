import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Global search across medicines, sales, purchases, customers, suppliers, returns.
router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ success: true, data: { medicines: [], sales: [], purchases: [], customers: [], suppliers: [], returns: [] } });

  const insensitive = { contains: q, mode: 'insensitive' as const };

  const [medicines, sales, purchases, customers, suppliers, returns] = await Promise.all([
    prisma.medicine.findMany({
      where: { OR: [{ name: insensitive }, { genericName: insensitive }, { sku: insensitive }, { barcode: insensitive }] },
      take: 10,
    }),
    prisma.sale.findMany({
      where: { OR: [{ invoiceNumber: insensitive }, { walkInCustomerName: insensitive }] },
      take: 10,
      include: { customer: true },
    }),
    prisma.purchase.findMany({
      where: { OR: [{ purchaseNumber: insensitive }, { invoiceNumber: insensitive }] },
      take: 10,
      include: { supplier: true },
    }),
    prisma.customer.findMany({ where: { OR: [{ name: insensitive }, { phone: insensitive }] }, take: 10 }),
    prisma.supplier.findMany({ where: { OR: [{ name: insensitive }, { phone: insensitive }] }, take: 10 }),
    prisma.return.findMany({ where: { returnNumber: insensitive }, take: 10 }),
  ]);

  res.json({ success: true, data: { medicines, sales, purchases, customers, suppliers, returns } });
}));

export default router;
