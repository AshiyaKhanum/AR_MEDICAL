import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useAllBatches, useExpired, useExpiring, useLowStock, useOutOfStock } from '../hooks/useInventory';
import { formatCurrency, formatDate, daysUntil } from '../utils/format';

type Filter = 'all' | 'low-stock' | 'out-of-stock' | 'expiring' | 'expired';

export default function BatchesPage() {
  const [params] = useSearchParams();
  const initial = (params.get('filter') as Filter) || 'all';
  const [filter, setFilter] = useState<Filter>(initial);
  const [expiryWindow, setExpiryWindow] = useState(30);

  const allBatches = useAllBatches();
  const lowStock = useLowStock();
  const outOfStock = useOutOfStock();
  const expiring = useExpiring(expiryWindow);
  const expired = useExpired();

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All Batches', count: allBatches.data?.length },
    { key: 'low-stock', label: 'Low Stock', count: lowStock.data?.length },
    { key: 'out-of-stock', label: 'Out of Stock', count: outOfStock.data?.length },
    { key: 'expiring', label: 'Expiring Soon', count: expiring.data?.length },
    { key: 'expired', label: 'Expired', count: expired.data?.length },
  ];

  const content = useMemo(() => {
    if (filter === 'low-stock' || filter === 'out-of-stock') {
      const data = filter === 'low-stock' ? lowStock.data : outOfStock.data;
      return (
        <table className="table-base">
          <thead><tr><th>Medicine</th><th>Category</th><th>Current Stock</th><th>Min Level</th><th>Unit</th></tr></thead>
          <tbody>
            {(data ?? []).map((m) => (
              <tr key={m.id}>
                <td><Link to={`/medicines/${m.id}`} className="text-brand-700 hover:underline">{m.name}</Link></td>
                <td>{m.category?.name ?? '-'}</td>
                <td className="font-semibold text-amber-600">{m.totalStock}</td>
                <td>{m.minStockLevel}</td>
                <td>{m.unit}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nothing here — all good!</td></tr>}
          </tbody>
        </table>
      );
    }

    if (filter === 'expiring' || filter === 'expired') {
      const data = filter === 'expiring' ? expiring.data : expired.data;
      return (
        <>
          {filter === 'expiring' && (
            <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setExpiryWindow(d)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${expiryWindow === d ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          )}
          <table className="table-base">
            <thead><tr><th>Medicine</th><th>Batch #</th><th>Supplier</th><th>Qty</th><th>Expiry</th><th>Days Left</th></tr></thead>
            <tbody>
              {(data ?? []).map((b) => {
                const days = daysUntil(b.expiryDate);
                return (
                  <tr key={b.id}>
                    <td><Link to={`/medicines/${b.medicineId}`} className="text-brand-700 hover:underline">{b.medicine?.name}</Link></td>
                    <td className="font-mono text-xs">{b.batchNumber}</td>
                    <td>{b.supplier?.name ?? '-'}</td>
                    <td>{b.quantity}</td>
                    <td>{formatDate(b.expiryDate)}</td>
                    <td>
                      <StatusBadge status={days < 0 ? 'REJECTED' : days <= 30 ? 'REQUESTED' : 'ACTIVE'} />
                      <span className="ml-2 text-xs text-slate-500">{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</span>
                    </td>
                  </tr>
                );
              })}
              {(data ?? []).length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Nothing here — all good!</td></tr>}
            </tbody>
          </table>
        </>
      );
    }

    return (
      <table className="table-base">
        <thead><tr><th>Medicine</th><th>Batch #</th><th>Supplier</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>MRP</th><th>Expiry</th></tr></thead>
        <tbody>
          {(allBatches.data ?? []).map((b) => (
            <tr key={b.id}>
              <td><Link to={`/medicines/${b.medicineId}`} className="text-brand-700 hover:underline">{b.medicine?.name}</Link></td>
              <td className="font-mono text-xs">{b.batchNumber}</td>
              <td>{b.supplier?.name ?? '-'}</td>
              <td>{b.quantity}</td>
              <td>{formatCurrency(b.purchasePrice)}</td>
              <td>{formatCurrency(b.sellingPrice)}</td>
              <td>{formatCurrency(b.mrp)}</td>
              <td>{formatDate(b.expiryDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [filter, allBatches.data, lowStock.data, outOfStock.data, expiring.data, expired.data, expiryWindow]);

  return (
    <div>
      <PageHeader title="Batch &amp; Expiry Tracking" subtitle="Monitor batch-wise stock, low stock and expiry alerts" />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === t.key ? 'bg-brand-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label} {typeof t.count === 'number' && <span className="ml-1 opacity-75">({t.count})</span>}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">{content}</div>
      </div>
    </div>
  );
}
