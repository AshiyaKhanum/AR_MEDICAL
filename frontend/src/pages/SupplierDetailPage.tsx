import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useSupplier } from '../hooks/useSuppliers';
import { formatCurrency, formatDate } from '../utils/format';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: supplier, isLoading } = useSupplier(id);
  if (isLoading || !supplier) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div>
      <Link to="/suppliers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Suppliers
      </Link>
      <PageHeader title={supplier.name} subtitle={`${supplier.contactPerson ?? ''} ${supplier.phone ?? ''}`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Total Purchased</p><p className="text-lg font-bold">{formatCurrency(supplier.totalPurchased)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Pending Amount</p><p className="text-lg font-bold text-amber-600">{formatCurrency(supplier.pendingAmount)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">GSTIN</p><p className="text-lg font-bold">{supplier.gstin ?? '-'}</p></div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-700">Purchase History</h2></div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Purchase #</th><th>Date</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {(supplier.purchases ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td><Link to={`/purchases/${p.id}`} className="text-brand-700 hover:underline">{p.purchaseNumber}</Link></td>
                  <td>{formatDate(p.purchaseDate)}</td>
                  <td>{formatCurrency(p.totalAmount)}</td>
                  <td>{formatCurrency(p.paidAmount)}</td>
                  <td><StatusBadge status={p.paymentStatus} /></td>
                </tr>
              ))}
              {(supplier.purchases ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No purchases yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
