import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import { apiClient } from '../api/client';
import { formatCurrency } from '../utils/format';

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';

  const { data, isLoading } = useQuery({
    enabled: !!q,
    queryKey: ['global-search', q],
    queryFn: async () => (await apiClient.get('/search', { params: { q } })).data.data as Record<string, any[]>,
  });

  return (
    <div>
      <PageHeader title={`Search results for "${q}"`} />
      {isLoading && <p className="text-sm text-slate-500">Searching…</p>}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ResultCard title="Medicines" items={data.medicines} render={(m) => (
            <Link to={`/medicines/${m.id}`} className="text-brand-700 hover:underline">{m.name} <span className="text-slate-400">({m.sku})</span></Link>
          )} />
          <ResultCard title="Invoices" items={data.sales} render={(s) => (
            <Link to={`/invoices/${s.id}`} className="text-brand-700 hover:underline">{s.invoiceNumber} — {formatCurrency(s.totalAmount)}</Link>
          )} />
          <ResultCard title="Purchases" items={data.purchases} render={(p) => (
            <Link to={`/purchases/${p.id}`} className="text-brand-700 hover:underline">{p.purchaseNumber} — {p.supplier?.name}</Link>
          )} />
          <ResultCard title="Customers" items={data.customers} render={(c) => (
            <Link to={`/customers/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
          )} />
          <ResultCard title="Suppliers" items={data.suppliers} render={(s) => (
            <Link to={`/suppliers/${s.id}`} className="text-brand-700 hover:underline">{s.name}</Link>
          )} />
          <ResultCard title="Returns" items={data.returns} render={(r) => <span>{r.returnNumber}</span>} />
        </div>
      )}
    </div>
  );
}

function ResultCard<T>({ title, items, render }: { title: string; items?: T[]; render: (item: T) => React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title} {items && `(${items.length})`}</h2>
      {!items || items.length === 0 ? (
        <p className="text-sm text-slate-400">No matches</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((item, idx) => <li key={idx}>{render(item)}</li>)}
        </ul>
      )}
    </div>
  );
}
