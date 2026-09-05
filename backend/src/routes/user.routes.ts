import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { recordAudit } from '../services/auditService';
import { badRequest, notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const userSelect = {
  id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
};

router.get(
  '/',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: users });
  })
);

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'PHARMACIST', 'STAFF']),
});

router.post(
  '/',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone,
        role: body.role,
        passwordHash,
      },
      select: userSelect,
    });
    await recordAudit({ userId: req.user!.sub, action: 'CREATE', module: 'User', recordId: user.id, newValue: user });
    res.status(201).json({ success: true, data: user });
  })
);

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'PHARMACIST', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.put(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('User');
    const body = updateSchema.parse(req.body);
    const data: any = { ...body };
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
      delete data.password;
    }
    const updated = await prisma.user.update({ where: { id: req.params.id }, data, select: userSelect });
    await recordAudit({
      userId: req.user!.sub,
      action: 'UPDATE',
      module: 'User',
      recordId: updated.id,
      oldValue: existing,
      newValue: updated,
    });
    res.json({ success: true, data: updated });
  })
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('User');
    if (existing.id === req.user!.sub) throw badRequest('You cannot deactivate your own account');
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false }, select: userSelect });
    await recordAudit({ userId: req.user!.sub, action: 'DELETE', module: 'User', recordId: updated.id, oldValue: existing });
    res.json({ success: true, data: updated });
  })
);

export default router;
