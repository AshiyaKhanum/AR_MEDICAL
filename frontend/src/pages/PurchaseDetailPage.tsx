import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, IndianRupee } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { usePurchase, usePurchasePayment } from '../hooks/usePurchases';
import { formatCurrency, formatDate } from '../utils/format';
import { apiErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/useAuth';

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: purchase, isLoading } = usePurchase(id);
  const payment = usePurchasePayment();
  const { canManageInventory } = usePermissions();
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [amount, setAmount] = useState(0);

  if (isLoading || !purchase) return <div className="text-sm text-slate-500">Loading…</div>;
  const balance = Number(purchase.totalAmount) - Number(purchase.paidAmount);

  return (
    <div>
      <Link to="/purchases" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Purchases
      </Link>
      <PageHeader
        title={purchase.purchaseNumber}
        subtitle={`${purchase.supplier?.name} • ${formatDate(purchase.purchaseDate)}`}
        actions={
          balance > 0.01 && canManageInventory ? (
            <button className="btn-primary" onClick={() => { setAmount(balance); setPayModalOpen(true); }}>
              <IndianRupee className="h-4 w-4" /> Record Payment
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Total</p><p className="text-lg font-bold">{formatCurrency(purchase.totalAmount)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Paid</p><p className="text-lg font-bold">{formatCurrency(purchase.paidAmount)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Balance</p><p className="text-lg font-bold text-red-600">{formatCurrency(balance)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-400">Status</p><StatusBadge status={purchase.paymentStatus} /></div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-700">Items</h2></div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Purchase Price</th><th>GST%</th><th>Line Total</th></tr></thead>
            <tbody>
              {purchase.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.medicine?.name}</td>
                  <td className="font-mono text-xs">{it.batch?.batchNumber}</td>
                  <td>{it.quantity}</td>
                  <td>{formatCurrency(it.purchasePrice)}</td>
                  <td>{Number(it.gstPercent)}%</td>
                  <td className="font-medium">{formatCurrency(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setPayModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={payment.isPending || amount <= 0}
              onClick={() =>
                payment.mutate(
                  { id: purchase.id, paidAmount: amount },
                  {
                    onSuccess: () => {
                      toast.success('Payment recorded');
                      setPayModalOpen(false);
                    },
                    onError: (err) => toast.error(apiErrorMessage(err)),
                  }
                )
              }
            >
              Record Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
