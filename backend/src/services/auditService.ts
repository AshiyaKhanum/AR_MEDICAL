import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

interface AuditInput {
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'RETURN' | 'PAYMENT' | 'EXPORT';
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

function serialize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  // Decimal/Date-safe serialization
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export async function recordAudit(input: AuditInput, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  try {
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        oldValue: serialize(input.oldValue) as any,
        newValue: serialize(input.newValue) as any,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never break the primary business transaction.
    // eslint-disable-next-line no-console
    console.error('Failed to record audit log:', err);
  }
}
