import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  batchNumber: z.string().min(1).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  mrp: z.coerce.number().min(0).optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  expiryDate: z.coerce.date().optional(),
  manufacturingDate: z.coerce.date().optional().nullable(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { medicineId, expiringInDays, expired } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (medicineId) where.medicineId = medicineId;
  if (expired === 'true') {
    where.expiryDate = { lt: new Date() };
    where.quantity = { gt: 0 };
  } else if (expiringInDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + Number(expiringInDays));
    where.expiryDate = { gte: new Date(), lte: cutoff };
    where.quantity = { gt: 0 };
  }
  const batches = await prisma.batch.findMany({
    where,
    include: { medicine: true, supplier: true },
    orderBy: { expiryDate: 'asc' },
  });
  res.json({ success: true, data: batches });
}));

// Manual stock correction (ADMIN/PHARMACIST only) - always logged as an ADJUSTMENT stock movement.
const adjustSchema = z.object({
  quantityChange: z.coerce.number().int(),
  notes: z.string().min(1),
});

router.post('/:id/adjust', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
  if (!batch) throw notFound('Batch');
  const { quantityChange, notes } = adjustSchema.parse(req.body);
  const newQty = batch.quantity + quantityChange;
  if (newQty < 0) throw badRequest('Adjustment would result in negative stock');

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.batch.update({ where: { id: batch.id }, data: { quantity: newQty } });
    await tx.stockMovement.create({
      data: {
        batchId: batch.id,
        type: 'ADJUSTMENT',
        quantity: quantityChange,
        balanceAfter: newQty,
        reference: 'MANUAL_ADJUSTMENT',
        notes,
      },
    });
    return b;
  });

  await recordAudit({
    userId: req.user!.sub,
    action: 'UPDATE',
    module: 'Batch',
    recordId: updated.id,
    oldValue: { quantity: batch.quantity },
    newValue: { quantity: updated.quantity, notes },
  });
  res.json({ success: true, data: updated });
}));

router.put('/:id', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const existing = await prisma.batch.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Batch');
  const body = updateSchema.parse(req.body);
  const updated = await prisma.batch.update({ where: { id: req.params.id }, data: body });
  await recordAudit({ userId: req.user!.sub, action: 'UPDATE', module: 'Batch', recordId: updated.id, oldValue: existing, newValue: updated });
  res.json({ success: true, data: updated });
}));

router.get('/:id/movements', asyncHandler(async (req, res) => {
  const movements = await prisma.stockMovement.findMany({
    where: { batchId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: movements });
}));

export default router;
