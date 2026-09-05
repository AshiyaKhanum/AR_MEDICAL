import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getExpiredBatches,
  getExpiringBatches,
  getInventorySummary,
  getLowStockMedicines,
  getOutOfStockMedicines,
} from '../services/inventoryService';

const router = Router();
router.use(authenticate);

router.get('/summary', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getInventorySummary() });
}));

router.get('/alerts/low-stock', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getLowStockMedicines() });
}));

router.get('/alerts/out-of-stock', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getOutOfStockMedicines() });
}));

router.get('/alerts/expiring', asyncHandler(async (req, res) => {
  const days = Number(req.query.days ?? 30);
  res.json({ success: true, data: await getExpiringBatches(days) });
}));

router.get('/alerts/expired', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getExpiredBatches() });
}));

export default router;
