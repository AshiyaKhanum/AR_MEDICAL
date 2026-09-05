import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const medicineSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  manufacturerId: z.string().uuid().optional().nullable(),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  unit: z.string().default('STRIP'),
  minStockLevel: z.coerce.number().int().min(0).default(10),
});

function withStock<T extends { batches: { quantity: number; expiryDate: Date }[] }>(m: T) {
  const today = new Date();
  const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
  const nearestExpiry = m.batches
    .filter((b) => b.quantity > 0)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())[0]?.expiryDate ?? null;
  const hasExpiredStock = m.batches.some((b) => b.quantity > 0 && b.expiryDate < today);
  return { ...m, totalStock, nearestExpiry, hasExpiredStock };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, categoryId, manufacturerId, status } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (status !== 'all') where.isActive = status === 'inactive' ? false : true;
    if (categoryId) where.categoryId = categoryId;
    if (manufacturerId) where.manufacturerId = manufacturerId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const medicines = await prisma.medicine.findMany({
      where,
      include: { category: true, manufacturer: true, batches: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: medicines.map(withStock) });
  })
);

router.get(
  '/barcode/:code',
  asyncHandler(async (req, res) => {
    const medicine = await prisma.medicine.findFirst({
      where: { OR: [{ barcode: req.params.code }, { sku: req.params.code }], isActive: true },
      include: {
        category: true,
        manufacturer: true,
        batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
      },
    });
    if (!medicine) throw notFound('Medicine with this barcode/SKU');
    res.json({ success: true, data: withStock(medicine) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const medicine = await prisma.medicine.findUnique({
      where: { id: req.params.id },
      include: { category: true, manufacturer: true, batches: { orderBy: { expiryDate: 'asc' } } },
    });
    if (!medicine) throw notFound('Medicine');
    res.json({ success: true, data: withStock(medicine) });
  })
);

router.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  asyncHandler(async (req, res) => {
    const body = medicineSchema.parse(req.body);
    const medicine = await prisma.medicine.create({ data: body, include: { category: true, manufacturer: true } });
    await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Medicine', recordId: medicine.id, newValue: medicine });
    res.status(201).json({ success: true, data: medicine });
  })
);

router.put(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Medicine');
    const body = medicineSchema.partial().parse(req.body);
    const updated = await prisma.medicine.update({
      where: { id: req.params.id },
      data: body,
      include: { category: true, manufacturer: true },
    });
    await recordAudit({
      userId: req.user!.sub,
      action: 'UPDATE',
      module: 'Medicine',
      recordId: updated.id,
      oldValue: existing,
      newValue: updated,
    });
    res.json({ success: true, data: updated });
  })
);

router.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Medicine');
    const updated = await prisma.medicine.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'Medicine', recordId: updated.id, oldValue: existing });
    res.json({ success: true, message: 'Medicine deactivated', data: updated });
  })
);

// ---- Batches for a medicine (opening stock / manual batch entry) ----
const batchSchema = z.object({
  batchNumber: z.string().min(1),
  supplierId: z.string().uuid().optional().nullable(),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  quantity: z.coerce.number().int().min(0),
  manufacturingDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date(),
});

router.get(
  '/:id/batches',
  asyncHandler(async (req, res) => {
    const batches = await prisma.batch.findMany({
      where: { medicineId: req.params.id },
      include: { supplier: true },
      orderBy: { expiryDate: 'asc' },
    });
    res.json({ success: true, data: batches });
  })
);

router.post(
  '/:id/batches',
  authorize('ADMIN', 'PHARMACIST'),
  asyncHandler(async (req, res) => {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!medicine) throw notFound('Medicine');
    const body = batchSchema.parse(req.body);
    if (body.expiryDate <= new Date()) throw badRequest('Expiry date must be in the future');

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: { ...body, medicineId: medicine.id, initialQuantity: body.quantity },
      });
      if (body.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            batchId: created.id,
            type: 'ADJUSTMENT',
            quantity: body.quantity,
            balanceAfter: body.quantity,
            reference: 'OPENING_STOCK',
            notes: 'Manual batch / opening stock entry',
          },
        });
      }
      return created;
    });

    await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Batch', recordId: batch.id, newValue: batch });
    res.status(201).json({ success: true, data: batch });
  })
);

export default router;
