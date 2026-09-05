import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useSales } from '../hooks/useSales';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const { data: sales, isLoading } = useSales({ search: search || undefined, paymentStatus: paymentStatus || undefined });

  return (
    <div>
      <PageHeader title="Invoices" subtitle="All sales invoices generated from POS billing" actions={<Link to="/pos" className="btn-primary">New Sale</Link>} />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by invoice # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th><th>Billed By</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(sales ?? []).map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/invoices/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.invoiceNumber}</Link></td>
                  <td>{formatDateTime(s.saleDate)}</td>
                  <td>{s.customer?.name ?? s.walkInCustomerName ?? 'Walk-in'}</td>
                  <td>{s.items.length}</td>
                  <td>{formatCurrency(s.totalAmount)}</td>
                  <td>{formatCurrency(s.paidAmount)}</td>
                  <td><StatusBadge status={s.paymentMethod} /></td>
                  <td><StatusBadge status={s.paymentStatus} /></td>
                  <td>{s.createdBy?.name}</td>
                </tr>
              ))}
              {!isLoading && (sales ?? []).length === 0 && <tr><td colSpan={9} className="py-8 text-center text-slate-400">No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
