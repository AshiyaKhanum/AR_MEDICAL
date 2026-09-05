import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
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
  const customers = await prisma.customer.findMany({
    where,
    include: { sales: { select: { totalAmount: true, paidAmount: true } } },
    orderBy: { name: 'asc' },
  });
  const data = customers.map((c) => {
    const totalBilled = c.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const outstanding = c.sales.reduce((sum, s) => sum + (Number(s.totalAmount) - Number(s.paidAmount)), 0);
    const { sales, ...rest } = c;
    return { ...rest, totalBilled, outstanding, salesCount: sales.length };
  });
  res.json({ success: true, data });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      sales: {
        include: { items: { include: { medicine: true } }, payments: true },
        orderBy: { saleDate: 'desc' },
      },
    },
  });
  if (!customer) throw notFound('Customer');
  const totalBilled = customer.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const outstanding = customer.sales.reduce((sum, s) => sum + (Number(s.totalAmount) - Number(s.paidAmount)), 0);
  res.json({ success: true, data: { ...customer, totalBilled, outstanding } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ data: body as any });
  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Customer', recordId: customer.id, newValue: customer });
  res.status(201).json({ success: true, data: customer });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Customer');
  const body = customerSchema.partial().parse(req.body);
  const updated = await prisma.customer.update({ where: { id: req.params.id }, data: body as any });
  await recordAudit({ userId: req.user!.sub, action: 'UPDATE', module: 'Customer', recordId: updated.id, oldValue: existing, newValue: updated });
  res.json({ success: true, data: updated });
}));

router.delete('/:id', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Customer');
  const updated = await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
  await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'Customer', recordId: updated.id, oldValue: existing });
  res.json({ success: true, message: 'Customer deactivated' });
}));

export default router;
