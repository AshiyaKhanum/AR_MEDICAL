import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';
import { nextSequence } from '../utils/sequence';
import { computeBillTotals, computeLine } from '../services/billingService';
import { streamInvoicePdf } from '../services/pdfService';
import { PaymentStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const saleItemSchema = z.object({
  medicineId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
});

const saleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  walkInCustomerName: z.string().optional().nullable(),
  walkInCustomerPhone: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT']).default('CASH'),
  paidAmount: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1),
});

function computePaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0.009) return 'PENDING';
  if (paid + 0.009 >= total) return 'PAID';
  return 'PARTIAL';
}

async function buildLines(items: z.infer<typeof saleItemSchema>[]) {
  const lines = [];
  for (const item of items) {
    const batch = await prisma.batch.findUnique({ where: { id: item.batchId }, include: { medicine: true } });
    if (!batch) throw notFound(`Batch for item`);
    if (batch.medicineId !== item.medicineId) throw badRequest('Batch does not belong to the specified medicine');
    if (batch.quantity < item.quantity) {
      throw badRequest(`Insufficient stock for ${batch.medicine.name} (batch ${batch.batchNumber}): available ${batch.quantity}, requested ${item.quantity}`);
    }
    if (batch.expiryDate < new Date()) {
      throw badRequest(`Batch ${batch.batchNumber} of ${batch.medicine.name} has expired and cannot be sold`);
    }
    const line = computeLine({
      sellingPrice: Number(batch.sellingPrice),
      mrp: Number(batch.mrp),
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      gstPercent: Number(batch.gstPercent),
    });
    lines.push({ ...line, medicineId: item.medicineId, batchId: item.batchId, medicine: batch.medicine, batch });
  }
  return lines;
}

// Live preview of totals for the POS screen (no persistence, no stock mutation).
router.post('/preview', asyncHandler(async (req, res) => {
  const body = z.object({ items: z.array(saleItemSchema).min(1), discountAmount: z.coerce.number().min(0).default(0) }).parse(req.body);
  const lines = await buildLines(body.items);
  const totals = computeBillTotals(lines, body.discountAmount);
  res.json({
    success: true,
    data: {
      lines: lines.map((l) => ({
        medicineId: l.medicineId,
        batchId: l.batchId,
        medicineName: l.medicine.name,
        batchNumber: l.batch.batchNumber,
        quantity: l.quantity,
        mrp: l.mrp,
        sellingPrice: l.sellingPrice,
        discountPercent: l.discountPercent,
        gstPercent: l.gstPercent,
        lineTotal: l.lineTotal,
      })),
      ...totals,
    },
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { search, customerId, paymentStatus, paymentMethod, from, to } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (customerId) where.customerId = customerId;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (from || to) where.saleDate = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { walkInCustomerName: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  const sales = await prisma.sale.findMany({
    where,
    include: { customer: true, items: true, createdBy: { select: { name: true } } },
    orderBy: { saleDate: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: sales });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { medicine: true, batch: true } },
      payments: true,
      returns: { include: { items: true } },
    },
  });
  if (!sale) throw notFound('Sale');
  res.json({ success: true, data: sale });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = saleSchema.parse(req.body);
  if (!body.customerId && !body.walkInCustomerName) {
    throw badRequest('Provide either a registered customerId or a walk-in customer name');
  }

  const lines = await buildLines(body.items);
  const totals = computeBillTotals(lines, body.discountAmount);
  const paidAmount = body.paymentMethod === 'CREDIT' ? body.paidAmount ?? 0 : body.paidAmount ?? totals.totalAmount;
  const paymentStatus = computePaymentStatus(totals.totalAmount, paidAmount);

  const sale = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextSequence(tx, 'SALE', 'INV');

    const created = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId: body.customerId ?? null,
        walkInCustomerName: body.walkInCustomerName,
        walkInCustomerPhone: body.walkInCustomerPhone,
        saleDate: new Date(),
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        gstAmount: totals.gstAmount,
        totalAmount: totals.totalAmount,
        paidAmount,
        paymentMethod: body.paymentMethod,
        paymentStatus,
        notes: body.notes,
        createdById: req.user!.sub,
      },
    });

    for (const line of lines) {
      // Atomic, race-safe stock decrement.
      const result = await tx.batch.updateMany({
        where: { id: line.batchId, quantity: { gte: line.quantity } },
        data: { quantity: { decrement: line.quantity } },
      });
      if (result.count === 0) {
        throw badRequest(`Stock for batch ${line.batch.batchNumber} changed concurrently — please re-check availability`);
      }
      const updatedBatch = await tx.batch.findUniqueOrThrow({ where: { id: line.batchId } });

      await tx.saleItem.create({
        data: {
          saleId: created.id,
          medicineId: line.medicineId,
          batchId: line.batchId,
          quantity: line.quantity,
          mrp: line.mrp,
          sellingPrice: line.sellingPrice,
          discountPercent: line.discountPercent,
          gstPercent: line.gstPercent,
          lineTotal: line.lineTotal,
        },
      });

      await tx.stockMovement.create({
        data: {
          batchId: line.batchId,
          type: 'SALE_OUT',
          quantity: -line.quantity,
          balanceAfter: updatedBatch.quantity,
          reference: invoiceNumber,
        },
      });
    }

    if (paidAmount > 0) {
      await tx.payment.create({
        data: {
          saleId: created.id,
          amount: paidAmount,
          method: body.paymentMethod,
          status: paymentStatus,
          reference: invoiceNumber,
        },
      });
    }

    return tx.sale.findUniqueOrThrow({
      where: { id: created.id },
      include: { customer: true, items: { include: { medicine: true, batch: true } }, createdBy: { select: { name: true } } },
    });
  });

  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Sale', recordId: sale.id, newValue: sale });
  res.status(201).json({ success: true, data: sale });
}));

const paymentUpdateSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT']),
  reference: z.string().optional(),
});

router.post('/:id/payment', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!sale) throw notFound('Sale');
  const { amount, method, reference } = paymentUpdateSchema.parse(req.body);
  const newPaid = Number(sale.paidAmount) + amount;
  if (newPaid > Number(sale.totalAmount) + 0.01) throw badRequest('Payment exceeds the outstanding balance');
  const paymentStatus = computePaymentStatus(Number(sale.totalAmount), newPaid);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.sale.update({ where: { id: sale.id }, data: { paidAmount: newPaid, paymentStatus } });
    await tx.payment.create({
      data: { saleId: sale.id, amount, method, status: paymentStatus, reference: reference ?? sale.invoiceNumber },
    });
    return u;
  });

  await recordAudit({
    userId: req.user!.sub,
    action: 'PAYMENT',
    module: 'Sale',
    recordId: updated.id,
    oldValue: { paidAmount: sale.paidAmount, paymentStatus: sale.paymentStatus },
    newValue: { paidAmount: updated.paidAmount, paymentStatus: updated.paymentStatus },
  });
  res.json({ success: true, data: updated });
}));

// ---- Invoice (view / print / PDF / reprint) ----
router.get('/:id/invoice', asyncHandler(async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { customer: true, createdBy: { select: { name: true } }, items: { include: { medicine: true, batch: true } } },
  });
  if (!sale) throw notFound('Sale');
  res.json({ success: true, data: sale });
}));

router.get('/:id/invoice/pdf', asyncHandler(async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { customer: true, createdBy: { select: { name: true } }, items: { include: { medicine: true, batch: true } } },
  });
  if (!sale) throw notFound('Sale');

  await recordAudit({ userId: req.user!.sub, action: 'EXPORT', module: 'Invoice', recordId: sale.id });

  streamInvoicePdf(res, {
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate,
    customerName: sale.customer?.name ?? sale.walkInCustomerName ?? 'Walk-in Customer',
    customerPhone: sale.customer?.phone ?? sale.walkInCustomerPhone,
    items: sale.items.map((i) => ({
      medicineName: i.medicine.name,
      batchNumber: i.batch.batchNumber,
      quantity: i.quantity,
      mrp: Number(i.mrp),
      sellingPrice: Number(i.sellingPrice),
      discountPercent: Number(i.discountPercent),
      gstPercent: Number(i.gstPercent),
      lineTotal: Number(i.lineTotal),
    })),
    subTotal: Number(sale.subTotal),
    discountAmount: Number(sale.discountAmount),
    gstAmount: Number(sale.gstAmount),
    totalAmount: Number(sale.totalAmount),
    paidAmount: Number(sale.paidAmount),
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    createdByName: sale.createdBy.name,
  });
}));

export default router;
