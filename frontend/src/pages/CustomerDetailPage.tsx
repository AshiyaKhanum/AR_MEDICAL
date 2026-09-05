import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useCustomer } from '../hooks/useCustomers';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useCustomer(id);
  if (isLoading || !customer) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>
      <PageHeader title={customer.name} subtitle={customer.phone ?? ''} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Total Billed</p><p className="text-lg font-bold">{formatCurrency(customer.totalBilled)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Outstanding</p><p className="text-lg font-bold text-amber-600">{formatCurrency(customer.outstanding)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Address</p><p className="text-sm">{customer.address ?? '-'}</p></div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-700">Billing History</h2></div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {(customer.sales ?? []).map((s: any) => (
                <tr key={s.id}>
                  <td><Link to={`/invoices/${s.id}`} className="text-brand-700 hover:underline">{s.invoiceNumber}</Link></td>
                  <td>{formatDateTime(s.saleDate)}</td>
                  <td>{formatCurrency(s.totalAmount)}</td>
                  <td>{formatCurrency(s.paidAmount)}</td>
                  <td><StatusBadge status={s.paymentStatus} /></td>
                </tr>
              ))}
              {(customer.sales ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No purchase history yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
