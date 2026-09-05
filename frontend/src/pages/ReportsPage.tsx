import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { apiClient } from '../api/client';

const REPORTS = [
  { key: 'sales', label: 'Sales Report', hasRange: true },
  { key: 'purchases', label: 'Purchases Report', hasRange: true },
  { key: 'inventory', label: 'Inventory & Stock Valuation', hasRange: false },
  { key: 'profit', label: 'Profit Report', hasRange: true },
  { key: 'gst', label: 'GST Report', hasRange: true },
  { key: 'customer-payments', label: 'Customer Outstanding Payments', hasRange: false },
  { key: 'supplier-payments', label: 'Supplier Pending Payments', hasRange: false },
  { key: 'expiry', label: 'Expiry Report', hasRange: false },
];

export default function ReportsPage() {
  const [active, setActive] = useState(REPORTS[0].key);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const reportMeta = REPORTS.find((r) => r.key === active)!;

  const { data, isLoading } = useQuery({
    queryKey: ['report', active, from, to],
    queryFn: async () =>
      (await apiClient.get(`/reports/${active}`, { params: reportMeta.hasRange ? { from, to } : {} })).data.data as Record<string, unknown>[],
  });

  function exportAs(format: 'csv' | 'excel' | 'pdf') {
    const params = new URLSearchParams({ format, ...(reportMeta.hasRange ? { from, to } : {}) });
    const token = localStorage.getItem('ar-medical-auth');
    let accessToken = '';
    try { accessToken = token ? JSON.parse(token)?.state?.accessToken ?? '' : ''; } catch { /* noop */ }
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    fetch(`${base}/reports/${active}?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${active}-report.${format === 'excel' ? 'xlsx' : format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, purchases, inventory, profit, GST and payment reports with export" />

      <div className="mb-4 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active === r.key ? 'bg-brand-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        {reportMeta.hasRange && (
          <>
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        <div className="ml-auto flex gap-2 pt-4 sm:pt-0">
          <button className="btn-secondary" onClick={() => exportAs('csv')}><Download className="h-4 w-4" /> CSV</button>
          <button className="btn-secondary" onClick={() => exportAs('excel')}><Download className="h-4 w-4" /> Excel</button>
          <button className="btn-secondary" onClick={() => exportAs('pdf')}><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                {columns.map((c) => <th key={c}>{c.replace(/([A-Z])/g, ' $1')}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={columns.length || 1} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(data ?? []).map((row, idx) => (
                <tr key={idx}>
                  {columns.map((c) => <td key={c}>{String(row[c] ?? '-')}</td>)}
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={columns.length || 1} className="py-8 text-center text-slate-400">No data for this report</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
