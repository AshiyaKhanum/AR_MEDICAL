import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generates a sequential, human-friendly document number such as
 * INV-2026-000123, PUR-2026-000045, RET-2026-000007.
 * Uses an upsert-based counter so numbers never collide even under
 * concurrent requests (Postgres row lock via the transaction client).
 */
export async function nextSequence(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `${key}-${year}`;

  const counter = await tx.counter.upsert({
    where: { id: counterId },
    update: { value: { increment: 1 } },
    create: { id: counterId, value: 1 },
  });

  const padded = String(counter.value).padStart(6, '0');
  return `${prefix}-${year}-${padded}`;
}
