import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';
import { nextSequence } from '../utils/sequence';

const router = Router();
router.use(authenticate);

const returnItemSchema = z.object({
  medicineId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitAmount: z.coerce.number().min(0),
});

const returnSchema = z.object({
  type: z.enum(['SALE', 'PURCHASE']),
  saleId: z.string().uuid().optional(),
  purchaseId: z.string().uuid().optional(),
  reason: z.string().optional(),
  items: z.array(returnItemSchema).min(1),
});

router.get('/', asyncHandler(async (req, res) => {
  const { type, status } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;
  const returns = await prisma.return.findMany({
    where,
    include: { items: true, sale: true, purchase: { include: { supplier: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: returns });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const ret = await prisma.return.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      sale: { include: { customer: true } },
      purchase: { include: { supplier: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!ret) throw notFound('Return');
  res.json({ success: true, data: ret });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = returnSchema.parse(req.body);

  if (body.type === 'SALE') {
    if (!body.saleId) throw badRequest('saleId is required for a sales return');
    const sale = await prisma.sale.findUnique({ where: { id: body.saleId }, include: { items: true, returns: { include: { items: true } } } });
    if (!sale) throw notFound('Sale');

    for (const item of body.items) {
      const soldItem = sale.items.find((si) => si.batchId === item.batchId && si.medicineId === item.medicineId);
      if (!soldItem) throw badRequest('One of the return items was not part of the original sale');
      const alreadyReturned = sale.returns
        .flatMap((r) => r.items)
        .filter((ri) => ri.batchId === item.batchId)
        .reduce((sum, ri) => sum + ri.quantity, 0);
      if (alreadyReturned + item.quantity > soldItem.quantity) {
        throw badRequest(`Cannot return more than sold quantity for one of the items`);
      }
    }
  } else {
    if (!body.purchaseId) throw badRequest('purchaseId is required for a purchase return');
    const purchase = await prisma.purchase.findUnique({ where: { id: body.purchaseId } });
    if (!purchase) throw notFound('Purchase');
    for (const item of body.items) {
      const batch = await prisma.batch.findUnique({ where: { id: item.batchId } });
      if (!batch || batch.quantity < item.quantity) {
        throw badRequest('Cannot return more than the current available batch quantity');
      }
    }
  }

  const refundAmount = body.items.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  const autoApprove = req.user!.role === 'ADMIN' || req.user!.role === 'PHARMACIST';

  const created = await prisma.$transaction(async (tx) => {
    const returnNumber = await nextSequence(tx, 'RETURN', 'RET');
    const ret = await tx.return.create({
      data: {
        returnNumber,
        type: body.type,
        saleId: body.saleId,
        purchaseId: body.purchaseId,
        reason: body.reason,
        refundAmount,
        status: autoApprove ? 'REFUNDED' : 'REQUESTED',
        createdById: req.user!.sub,
        items: {
          create: body.items.map((i) => ({
            medicineId: i.medicineId,
            batchId: i.batchId,
            quantity: i.quantity,
            unitAmount: i.unitAmount,
            lineTotal: i.quantity * i.unitAmount,
          })),
        },
      },
      include: { items: true },
    });

    if (autoApprove) {
      await applyReturnStockChanges(tx, ret.type, ret.items, returnNumber);
    }

    return ret;
  });

  await recordAudit({ userId: req.user!.sub, action: 'RETURN', module: 'Return', recordId: created.id, newValue: created });
  res.status(201).json({ success: true, data: created });
}));

router.post('/:id/approve', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const ret = await prisma.return.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!ret) throw notFound('Return');
  if (ret.status !== 'REQUESTED') throw badRequest('Only requested returns can be approved');

  const updated = await prisma.$transaction(async (tx) => {
    await applyReturnStockChanges(tx, ret.type, ret.items, ret.returnNumber);
    return tx.return.update({ where: { id: ret.id }, data: { status: 'REFUNDED' } });
  });

  await recordAudit({ userId: req.user!.sub, action: 'UPDATE', module: 'Return', recordId: updated.id, oldValue: { status: ret.status }, newValue: { status: updated.status } });
  res.json({ success: true, data: updated });
}));

router.post('/:id/reject', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const ret = await prisma.return.findUnique({ where: { id: req.params.id } });
  if (!ret) throw notFound('Return');
  if (ret.status !== 'REQUESTED') throw badRequest('Only requested returns can be rejected');
  const updated = await prisma.return.update({ where: { id: ret.id }, data: { status: 'REJECTED' } });
  await recordAudit({ userId: req.user!.sub, action: 'UPDATE', module: 'Return', recordId: updated.id, oldValue: { status: ret.status }, newValue: { status: updated.status } });
  res.json({ success: true, data: updated });
}));

async function applyReturnStockChanges(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  type: 'SALE' | 'PURCHASE',
  items: { batchId: string; quantity: number }[],
  reference: string
) {
  for (const item of items) {
    if (type === 'SALE') {
      const batch = await tx.batch.update({ where: { id: item.batchId }, data: { quantity: { increment: item.quantity } } });
      await tx.stockMovement.create({
        data: { batchId: item.batchId, type: 'SALE_RETURN_IN', quantity: item.quantity, balanceAfter: batch.quantity, reference },
      });
    } else {
      const result = await tx.batch.updateMany({
        where: { id: item.batchId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (result.count === 0) throw badRequest('Insufficient batch stock to process the purchase return');
      const batch = await tx.batch.findUniqueOrThrow({ where: { id: item.batchId } });
      await tx.stockMovement.create({
        data: { batchId: item.batchId, type: 'PURCHASE_RETURN_OUT', quantity: -item.quantity, balanceAfter: batch.quantity, reference },
      });
    }
  }
}

export default router;
