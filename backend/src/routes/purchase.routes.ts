import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';
import { nextSequence } from '../utils/sequence';
import { PaymentStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const purchaseItemSchema = z.object({
  medicineId: z.string().uuid(),
  batchNumber: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  manufacturingDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date(),
});

const purchaseSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1),
});

function computePaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return 'PENDING';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}

router.get('/', asyncHandler(async (req, res) => {
  const { search, supplierId, paymentStatus, from, to } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (supplierId) where.supplierId = supplierId;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (from || to) where.purchaseDate = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  if (search) {
    where.OR = [
      { purchaseNumber: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  const purchases = await prisma.purchase.findMany({
    where,
    include: { supplier: true, items: true, createdBy: { select: { name: true } } },
    orderBy: { purchaseDate: 'desc' },
  });
  res.json({ success: true, data: purchases });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { medicine: true, batch: true } },
      returns: true,
    },
  });
  if (!purchase) throw notFound('Purchase');
  res.json({ success: true, data: purchase });
}));

router.post('/', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const body = purchaseSchema.parse(req.body);
  const supplier = await prisma.supplier.findUnique({ where: { id: body.supplierId } });
  if (!supplier) throw notFound('Supplier');

  for (const item of body.items) {
    if (item.expiryDate <= new Date()) {
      throw badRequest(`Expiry date for one of the items must be in the future`);
    }
  }

  const subTotal = body.items.reduce((sum, i) => sum + i.purchasePrice * i.quantity, 0);
  const gstAmount = body.items.reduce((sum, i) => sum + (i.purchasePrice * i.quantity * i.gstPercent) / 100, 0);
  const totalAmount = subTotal + gstAmount - body.discountAmount;
  if (totalAmount < 0) throw badRequest('Discount cannot exceed the purchase subtotal + GST');
  const paymentStatus = computePaymentStatus(totalAmount, body.paidAmount);

  const purchase = await prisma.$transaction(async (tx) => {
    const purchaseNumber = await nextSequence(tx, 'PURCHASE', 'PUR');

    const created = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: body.supplierId,
        invoiceNumber: body.invoiceNumber,
        purchaseDate: body.purchaseDate ?? new Date(),
        subTotal,
        discountAmount: body.discountAmount,
        gstAmount,
        totalAmount,
        paidAmount: body.paidAmount,
        paymentStatus,
        notes: body.notes,
        createdById: req.user!.sub,
      },
    });

    for (const item of body.items) {
      let batch = await tx.batch.findUnique({
        where: { medicineId_batchNumber: { medicineId: item.medicineId, batchNumber: item.batchNumber } },
      });

      if (batch) {
        batch = await tx.batch.update({
          where: { id: batch.id },
          data: {
            quantity: { increment: item.quantity },
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            mrp: item.mrp,
            gstPercent: item.gstPercent,
            expiryDate: item.expiryDate,
            supplierId: body.supplierId,
          },
        });
      } else {
        batch = await tx.batch.create({
          data: {
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            supplierId: body.supplierId,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            mrp: item.mrp,
            gstPercent: item.gstPercent,
            quantity: item.quantity,
            initialQuantity: item.quantity,
            manufacturingDate: item.manufacturingDate,
            expiryDate: item.expiryDate,
          },
        });
      }

      await tx.purchaseItem.create({
        data: {
          purchaseId: created.id,
          medicineId: item.medicineId,
          batchId: batch.id,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          gstPercent: item.gstPercent,
          lineTotal: item.purchasePrice * item.quantity * (1 + item.gstPercent / 100),
        },
      });

      await tx.stockMovement.create({
        data: {
          batchId: batch.id,
          type: 'PURCHASE_IN',
          quantity: item.quantity,
          balanceAfter: batch.quantity,
          reference: purchaseNumber,
        },
      });
    }

    if (body.paidAmount > 0) {
      await tx.payment.create({
        data: {
          amount: body.paidAmount,
          method: 'CASH',
          status: paymentStatus,
          reference: purchaseNumber,
        },
      });
    }

    return tx.purchase.findUniqueOrThrow({
      where: { id: created.id },
      include: { supplier: true, items: { include: { medicine: true, batch: true } } },
    });
  });

  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Purchase', recordId: purchase.id, newValue: purchase });
  res.status(201).json({ success: true, data: purchase });
}));

const paymentUpdateSchema = z.object({ paidAmount: z.coerce.number().min(0) });

router.post('/:id/payment', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id } });
  if (!purchase) throw notFound('Purchase');
  const { paidAmount } = paymentUpdateSchema.parse(req.body);
  const newPaid = Number(purchase.paidAmount) + paidAmount;
  const paymentStatus = computePaymentStatus(Number(purchase.totalAmount), newPaid);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.purchase.update({
      where: { id: purchase.id },
      data: { paidAmount: newPaid, paymentStatus },
    });
    await tx.payment.create({
      data: { amount: paidAmount, method: 'CASH', status: paymentStatus, reference: purchase.purchaseNumber },
    });
    return u;
  });

  await recordAudit({
    userId: req.user!.sub,
    action: 'PAYMENT',
    module: 'Purchase',
    recordId: updated.id,
    oldValue: { paidAmount: purchase.paidAmount },
    newValue: { paidAmount: updated.paidAmount },
  });
  res.json({ success: true, data: updated });
}));

export default router;
