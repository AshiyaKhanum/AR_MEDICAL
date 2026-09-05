import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { getInventorySummary } from '../services/inventoryService';

const router = Router();
router.use(authenticate);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get('/summary', asyncHandler(async (_req, res) => {
  const todayStart = startOfDay();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    todaySalesAgg,
    totalSalesAgg,
    todayPurchasesAgg,
    totalPurchasesAgg,
    pendingSalesAgg,
    pendingPurchasesAgg,
    inventorySummary,
    recentSales,
    recentPurchases,
    salesLast30,
    purchasesLast30,
    allSaleItemsLast30,
  ] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { saleDate: { gte: todayStart } } }),
    prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true }, _count: true, where: { purchaseDate: { gte: todayStart } } }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
    }),
    prisma.purchase.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
    }),
    getInventorySummary(),
    prisma.sale.findMany({
      take: 8,
      orderBy: { saleDate: 'desc' },
      include: { customer: true, createdBy: { select: { name: true } } },
    }),
    prisma.purchase.findMany({
      take: 8,
      orderBy: { purchaseDate: 'desc' },
      include: { supplier: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: thirtyDaysAgo } },
      select: { saleDate: true, totalAmount: true },
    }),
    prisma.purchase.findMany({
      where: { purchaseDate: { gte: thirtyDaysAgo } },
      select: { purchaseDate: true, totalAmount: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: { saleDate: { gte: thirtyDaysAgo } } },
      select: { lineTotal: true, quantity: true, batch: { select: { purchasePrice: true } } },
    }),
  ]);

  // Build a 30-day series for charting
  const seriesMap = new Map<string, { date: string; sales: number; purchases: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    seriesMap.set(key, { date: key, sales: 0, purchases: 0 });
  }
  salesLast30.forEach((s) => {
    const key = s.saleDate.toISOString().slice(0, 10);
    const entry = seriesMap.get(key);
    if (entry) entry.sales += Number(s.totalAmount);
  });
  purchasesLast30.forEach((p) => {
    const key = p.purchaseDate.toISOString().slice(0, 10);
    const entry = seriesMap.get(key);
    if (entry) entry.purchases += Number(p.totalAmount);
  });

  const profitLast30 = allSaleItemsLast30.reduce(
    (sum, i) => sum + (Number(i.lineTotal) - Number(i.batch.purchasePrice) * i.quantity),
    0
  );

  res.json({
    success: true,
    data: {
      todaySales: Number(todaySalesAgg._sum.totalAmount ?? 0),
      todaySalesCount: todaySalesAgg._count,
      totalSales: Number(totalSalesAgg._sum.totalAmount ?? 0),
      totalSalesCount: totalSalesAgg._count,
      todayPurchases: Number(todayPurchasesAgg._sum.totalAmount ?? 0),
      totalPurchases: Number(totalPurchasesAgg._sum.totalAmount ?? 0),
      pendingReceivables: Number(pendingSalesAgg._sum.totalAmount ?? 0) - Number(pendingSalesAgg._sum.paidAmount ?? 0),
      pendingPayables: Number(pendingPurchasesAgg._sum.totalAmount ?? 0) - Number(pendingPurchasesAgg._sum.paidAmount ?? 0),
      profitLast30Days: profitLast30,
      inventory: inventorySummary,
      chartSeries: Array.from(seriesMap.values()),
      recentSales,
      recentPurchases,
    },
  });
}));

export default router;
