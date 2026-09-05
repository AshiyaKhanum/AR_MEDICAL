import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  IndianRupee,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  XCircle,
  CalendarClock,
  Wallet,
  BarChart3,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useDashboardSummary } from '../hooks/useDashboard';
import { formatCurrency, formatDateTime } from '../utils/format';
import { BUSINESS } from '../config/business';

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading || !data) {
    return <div className="text-sm text-slate-500">Loading dashboard…</div>;
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Overview for ${BUSINESS.name} — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(data.todaySales)} icon={IndianRupee} hint={`${data.todaySalesCount} invoices today`} />
        <StatCard label="Total Sales" value={formatCurrency(data.totalSales)} icon={TrendingUp} tone="emerald" hint={`${data.totalSalesCount} invoices overall`} />
        <StatCard label="Today's Purchases" value={formatCurrency(data.todayPurchases)} icon={ShoppingCart} tone="slate" />
        <StatCard label="Total Purchases" value={formatCurrency(data.totalPurchases)} icon={ShoppingCart} tone="slate" />
        <StatCard label="Profit (30 days)" value={formatCurrency(data.profitLast30Days)} icon={BarChart3} tone="emerald" />
        <StatCard label="Pending Receivables" value={formatCurrency(data.pendingReceivables)} icon={Wallet} tone="amber" hint="From customers" />
        <StatCard label="Pending Payables" value={formatCurrency(data.pendingPayables)} icon={Wallet} tone="amber" hint="To suppliers" />
        <StatCard label="Stock Value (Cost)" value={formatCurrency(data.inventory.stockValueAtCost)} icon={Package} tone="brand" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link to="/batches?filter=low-stock" className="card flex items-center gap-3 p-4 hover:border-amber-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{data.inventory.lowStockCount}</p>
            <p className="text-xs text-slate-500">Low stock items</p>
          </div>
        </Link>
        <Link to="/batches?filter=out-of-stock" className="card flex items-center gap-3 p-4 hover:border-red-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{data.inventory.outOfStockCount}</p>
            <p className="text-xs text-slate-500">Out of stock</p>
          </div>
        </Link>
        <Link to="/batches?filter=expiring" className="card flex items-center gap-3 p-4 hover:border-amber-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{data.inventory.expiring30Count}</p>
            <p className="text-xs text-slate-500">Expiring in 30 days</p>
          </div>
        </Link>
        <Link to="/batches?filter=expired" className="card flex items-center gap-3 p-4 hover:border-red-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{data.inventory.expiredCount}</p>
            <p className="text-xs text-slate-500">Expired batches</p>
          </div>
        </Link>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Sales &amp; Purchases — last 30 days</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.chartSeries}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Area type="monotone" dataKey="sales" name="Sales" stroke="#0f766e" fill="url(#colorSales)" strokeWidth={2} />
            <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#f59e0b" fill="url(#colorPurchases)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent Sales</h2>
            <Link to="/sales" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/invoices/${s.id}`} className="text-brand-700 hover:underline">{s.invoiceNumber}</Link></td>
                    <td>{s.customer?.name ?? s.walkInCustomerName ?? 'Walk-in'}</td>
                    <td>{formatCurrency(s.totalAmount)}</td>
                    <td><StatusBadge status={s.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent Purchases</h2>
            <Link to="/purchases" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Purchase #</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentPurchases.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/purchases/${p.id}`} className="text-brand-700 hover:underline">{p.purchaseNumber}</Link></td>
                    <td>{p.supplier?.name}</td>
                    <td>{formatCurrency(p.totalAmount)}</td>
                    <td><StatusBadge status={p.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
