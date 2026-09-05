import { Router } from 'express';
// @ts-ignore - bwip-js has no bundled types
import bwipjs from 'bwip-js';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { notFound } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// Generate a Code128 barcode image (PNG) for a medicine's barcode/SKU.
router.get('/medicine/:id', asyncHandler(async (req, res) => {
  const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });
  if (!medicine) throw notFound('Medicine');
  const text = medicine.barcode || medicine.sku;

  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
  });

  res.setHeader('Content-Type', 'image/png');
  res.send(png);
}));

// Generate a barcode image for an arbitrary value (used for previewing before save).
router.get('/value/:text', asyncHandler(async (req, res) => {
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: req.params.text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
  });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
}));

export default router;
