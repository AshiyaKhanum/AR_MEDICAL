import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const supplierSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { search, status } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (status !== 'all') where.isActive = status === 'inactive' ? false : true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  const suppliers = await prisma.supplier.findMany({
    where,
    include: { purchases: { select: { totalAmount: true, paidAmount: true, paymentStatus: true } } },
    orderBy: { name: 'asc' },
  });
  const data = suppliers.map((s) => {
    const totalPurchased = s.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
    const pendingAmount = s.purchases.reduce((sum, p) => sum + (Number(p.totalAmount) - Number(p.paidAmount)), 0);
    const { purchases, ...rest } = s;
    return { ...rest, totalPurchased, pendingAmount, purchaseCount: purchases.length };
  });
  res.json({ success: true, data });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      purchases: {
        include: { items: { include: { medicine: true } } },
        orderBy: { purchaseDate: 'desc' },
      },
    },
  });
  if (!supplier) throw notFound('Supplier');
  const totalPurchased = supplier.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  const pendingAmount = supplier.purchases.reduce((sum, p) => sum + (Number(p.totalAmount) - Number(p.paidAmount)), 0);
  res.json({ success: true, data: { ...supplier, totalPurchased, pendingAmount } });
}));

router.post('/', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const body = supplierSchema.parse(req.body);
  const supplier = await prisma.supplier.create({ data: body as any });
  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Supplier', recordId: supplier.id, newValue: supplier });
  res.status(201).json({ success: true, data: supplier });
}));

router.put('/:id', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Supplier');
  const body = supplierSchema.partial().parse(req.body);
  const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: body as any });
  await recordAudit({ userId: req.user!.sub, action: 'UPDATE', module: 'Supplier', recordId: updated.id, oldValue: existing, newValue: updated });
  res.json({ success: true, data: updated });
}));

router.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Supplier');
  const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
  await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'Supplier', recordId: updated.id, oldValue: existing });
  res.json({ success: true, message: 'Supplier deactivated' });
}));

export default router;
