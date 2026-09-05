import clsx from 'clsx';

const COLOR_MAP: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-slate-200 text-slate-700',
  REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-200 text-slate-600',
  ADMIN: 'bg-brand-100 text-brand-800',
  PHARMACIST: 'bg-indigo-100 text-indigo-700',
  STAFF: 'bg-slate-100 text-slate-700',
  CASH: 'bg-slate-100 text-slate-700',
  CARD: 'bg-blue-100 text-blue-700',
  UPI: 'bg-purple-100 text-purple-700',
  BANK_TRANSFER: 'bg-cyan-100 text-cyan-700',
  CREDIT: 'bg-orange-100 text-orange-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('badge', COLOR_MAP[status] ?? 'bg-slate-100 text-slate-700')}>
      {status.replace('_', ' ')}
    </span>
  );
}
