import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { method, status, from, to } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (method) where.method = method;
  if (status) where.status = status;
  if (from || to) where.paidAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };

  const payments = await prisma.payment.findMany({
    where,
    include: { sale: { include: { customer: true } } },
    orderBy: { paidAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: payments });
}));

export default router;
