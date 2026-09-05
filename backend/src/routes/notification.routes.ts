import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { getExpiredBatches, getExpiringBatches, getLowStockMedicines, getOutOfStockMedicines } from '../services/inventoryService';

const router = Router();
router.use(authenticate);

// Aggregated, always-fresh notification feed derived from live stock/expiry state
// (rather than a stored table that could go stale) — surfaced in the bell icon / dashboard.
router.get('/', asyncHandler(async (_req, res) => {
  const [lowStock, outOfStock, expiring30, expired] = await Promise.all([
    getLowStockMedicines(),
    getOutOfStockMedicines(),
    getExpiringBatches(30),
    getExpiredBatches(),
  ]);

  const notifications = [
    ...outOfStock.map((m) => ({
      id: `oos-${m.id}`,
      type: 'OUT_OF_STOCK' as const,
      title: 'Out of stock',
      message: `${m.name} is out of stock`,
      createdAt: new Date().toISOString(),
    })),
    ...lowStock.map((m) => ({
      id: `low-${m.id}`,
      type: 'LOW_STOCK' as const,
      title: 'Low stock',
      message: `${m.name} has only ${m.totalStock} left (min ${m.minStockLevel})`,
      createdAt: new Date().toISOString(),
    })),
    ...expired.map((b) => ({
      id: `exp-${b.id}`,
      type: 'EXPIRED' as const,
      title: 'Expired stock',
      message: `${b.medicine.name} batch ${b.batchNumber} has expired (${b.quantity} units)`,
      createdAt: new Date().toISOString(),
    })),
    ...expiring30.map((b) => ({
      id: `soon-${b.id}`,
      type: 'EXPIRY_30' as const,
      title: 'Expiring soon',
      message: `${b.medicine.name} batch ${b.batchNumber} expires ${b.expiryDate.toISOString().slice(0, 10)}`,
      createdAt: new Date().toISOString(),
    })),
  ];

  res.json({ success: true, data: notifications });
}));

export default router;
