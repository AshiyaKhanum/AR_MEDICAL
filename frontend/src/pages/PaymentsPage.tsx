import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { apiClient } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Payment } from '../types/models';

export default function PaymentsPage() {
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', method, status],
    queryFn: async () =>
      (await apiClient.get<{ data: Payment[] }>('/payments', { params: { method: method || undefined, status: status || undefined } })).data.data,
  });

  return (
    <div>
      <PageHeader title="Payments" subtitle="Cash, Card, UPI, Bank Transfer and Credit payments across all sales" />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <select className="input sm:w-48" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All methods</option>
          {['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
        </select>
        <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['PAID', 'PARTIAL', 'PENDING', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Reference</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{formatDateTime(p.paidAt)}</td>
                  <td className="font-mono text-xs">{p.reference ?? '-'}</td>
                  <td>{p.sale ? <Link to={`/invoices/${p.sale.id}`} className="text-brand-700 hover:underline">{p.sale.invoiceNumber}</Link> : '-'}</td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td><StatusBadge status={p.method} /></td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {!isLoading && (payments ?? []).length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No payments found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
