import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { usePurchases } from '../hooks/usePurchases';
import { formatCurrency, formatDate } from '../utils/format';
import { usePermissions } from '../hooks/useAuth';

export default function PurchasesPage() {
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const { data: purchases, isLoading } = usePurchases({ search: search || undefined, paymentStatus: paymentStatus || undefined });
  const { canManageInventory } = usePermissions();

  return (
    <div>
      <PageHeader
        title="Purchase Management"
        subtitle="Record purchases from suppliers — stock increases automatically"
        actions={canManageInventory && <Link to="/purchases/new" className="btn-primary"><Plus className="h-4 w-4" /> New Purchase</Link>}
      />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by purchase # or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Purchase #</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(purchases ?? []).map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/purchases/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.purchaseNumber}</Link></td>
                  <td>{formatDate(p.purchaseDate)}</td>
                  <td>{p.supplier?.name}</td>
                  <td>{p.items.length}</td>
                  <td>{formatCurrency(p.totalAmount)}</td>
                  <td>{formatCurrency(p.paidAmount)}</td>
                  <td><StatusBadge status={p.paymentStatus} /></td>
                </tr>
              ))}
              {!isLoading && (purchases ?? []).length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No purchases found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
