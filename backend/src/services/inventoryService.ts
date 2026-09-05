import { prisma } from '../config/prisma';

/** Medicines whose total active-batch stock is at/below their minimum stock level (but > 0). */
export async function getLowStockMedicines() {
  const medicines = await prisma.medicine.findMany({
    where: { isActive: true },
    include: { batches: { where: { quantity: { gt: 0 } } }, category: true },
  });
  return medicines
    .map((m) => ({
      ...m,
      totalStock: m.batches.reduce((sum, b) => sum + b.quantity, 0),
    }))
    .filter((m) => m.totalStock > 0 && m.totalStock <= m.minStockLevel);
}

/** Medicines with zero total stock across all batches. */
export async function getOutOfStockMedicines() {
  const medicines = await prisma.medicine.findMany({
    where: { isActive: true },
    include: { batches: true, category: true },
  });
  return medicines
    .map((m) => ({ ...m, totalStock: m.batches.reduce((sum, b) => sum + b.quantity, 0) }))
    .filter((m) => m.totalStock === 0);
}

/** Batches (with stock remaining) expiring within `days` days from today, not yet expired. */
export async function getExpiringBatches(days: number) {
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() + days);
  return prisma.batch.findMany({
    where: { quantity: { gt: 0 }, expiryDate: { gte: today, lte: cutoff } },
    include: { medicine: true, supplier: true },
    orderBy: { expiryDate: 'asc' },
  });
}

/** Batches that have already expired but still carry stock (should be quarantined / written off). */
export async function getExpiredBatches() {
  const today = new Date();
  return prisma.batch.findMany({
    where: { quantity: { gt: 0 }, expiryDate: { lt: today } },
    include: { medicine: true, supplier: true },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getInventorySummary() {
  const [totalMedicines, totalBatches, lowStock, outOfStock, expiring30, expired, stockValuation] = await Promise.all([
    prisma.medicine.count({ where: { isActive: true } }),
    prisma.batch.count({ where: { quantity: { gt: 0 } } }),
    getLowStockMedicines(),
    getOutOfStockMedicines(),
    getExpiringBatches(30),
    getExpiredBatches(),
    prisma.batch.findMany({ where: { quantity: { gt: 0 } }, select: { quantity: true, purchasePrice: true, mrp: true } }),
  ]);

  const stockValueAtCost = stockValuation.reduce((sum, b) => sum + b.quantity * Number(b.purchasePrice), 0);
  const stockValueAtMrp = stockValuation.reduce((sum, b) => sum + b.quantity * Number(b.mrp), 0);

  return {
    totalMedicines,
    totalBatches,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    expiring30Count: expiring30.length,
    expiredCount: expired.length,
    stockValueAtCost,
    stockValueAtMrp,
  };
}
