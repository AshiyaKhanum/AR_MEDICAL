import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const nameSchema = z.object({ name: z.string().min(1), contact: z.string().optional() });

// ---- Categories ----
router.get('/categories', asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: categories });
}));

router.post('/categories', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const { name } = nameSchema.parse(req.body);
  const category = await prisma.category.create({ data: { name } });
  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Category', recordId: category.id, newValue: category });
  res.status(201).json({ success: true, data: category });
}));

router.delete('/categories/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Category');
  await prisma.category.delete({ where: { id: req.params.id } });
  await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'Category', recordId: existing.id, oldValue: existing });
  res.json({ success: true, message: 'Category deleted' });
}));

// ---- Manufacturers ----
router.get('/manufacturers', asyncHandler(async (_req, res) => {
  const manufacturers = await prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: manufacturers });
}));

router.post('/manufacturers', authorize('ADMIN', 'PHARMACIST'), asyncHandler(async (req, res) => {
  const body = nameSchema.parse(req.body);
  const manufacturer = await prisma.manufacturer.create({ data: body });
  await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'Manufacturer', recordId: manufacturer.id, newValue: manufacturer });
  res.status(201).json({ success: true, data: manufacturer });
}));

router.delete('/manufacturers/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.manufacturer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Manufacturer');
  await prisma.manufacturer.delete({ where: { id: req.params.id } });
  await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'Manufacturer', recordId: existing.id, oldValue: existing });
  res.json({ success: true, message: 'Manufacturer deleted' });
}));

export default router;
