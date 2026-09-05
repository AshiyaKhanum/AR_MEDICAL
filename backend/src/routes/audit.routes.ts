import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const { module, action, userId, from, to } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (module) where.module = module;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (from || to) where.createdAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  res.json({ success: true, data: logs });
}));

export default router;
