import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useApproveReturn, useCreateReturn, useRejectReturn, useReturns } from '../hooks/useReturns';
import { useSales } from '../hooks/useSales';
import { usePurchases } from '../hooks/usePurchases';
import { apiErrorMessage } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import { usePermissions } from '../hooks/useAuth';
import type { Sale, Purchase } from '../types/models';

export default function ReturnsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: returns, isLoading } = useReturns();
  const approve = useApproveReturn();
  const reject = useRejectReturn();
  const { canApproveReturns } = usePermissions();

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Sales returns, purchase returns, refunds — stock updates automatically"
        actions={<button className="btn-primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> New Return</button>}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Return #</th><th>Type</th><th>Reference</th><th>Date</th><th>Refund Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(returns ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.returnNumber}</td>
                  <td><StatusBadge status={r.type === 'SALE' ? 'CASH' : 'CARD'} /></td>
                  <td>{r.sale?.invoiceNumber ?? r.purchase?.purchaseNumber}</td>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td>{formatCurrency(r.refundAmount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="space-x-2">
                    {r.status === 'REQUESTED' && canApproveReturns && (
                      <>
                        <button className="text-xs font-medium text-emerald-600 hover:underline" onClick={() => approve.mutate(r.id, { onSuccess: () => toast.success('Return approved & stock updated'), onError: (e) => toast.error(apiErrorMessage(e)) })}>Approve</button>
                        <button className="text-xs font-medium text-red-500 hover:underline" onClick={() => reject.mutate(r.id, { onSuccess: () => toast.success('Return rejected'), onError: (e) => toast.error(apiErrorMessage(e)) })}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && (returns ?? []).length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No returns recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <NewReturnModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function NewReturnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<'SALE' | 'PURCHASE'>('SALE');
  const [refSearch, setRefSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const { data: sales } = useSales({ search: refSearch || undefined });
  const { data: purchases } = usePurchases({ search: refSearch || undefined });
  const createReturn = useCreateReturn();

  function reset() {
    setSelectedSale(null);
    setSelectedPurchase(null);
    setQuantities({});
    setRefSearch('');
    setReason('');
  }

  const items = type === 'SALE' ? selectedSale?.items ?? [] : selectedPurchase?.items ?? [];

  function submit() {
    const returnItems = items
      .filter((it) => (quantities[it.id] ?? 0) > 0)
      .map((it) => ({
        medicineId: it.medicineId,
        batchId: it.batchId,
        quantity: quantities[it.id],
        unitAmount: type === 'SALE' ? (it as any).sellingPrice : (it as any).purchasePrice,
      }));
    if (returnItems.length === 0) return toast.error('Select at least one item with a return quantity');

    createReturn.mutate(
      {
        type,
        saleId: type === 'SALE' ? selectedSale?.id : undefined,
        purchaseId: type === 'PURCHASE' ? selectedPurchase?.id : undefined,
        reason,
        items: returnItems,
      },
      {
        onSuccess: () => {
          toast.success('Return recorded');
          reset();
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New Return" width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium ${type === 'SALE' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setType('SALE'); setSelectedPurchase(null); }}>Sales Return</button>
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium ${type === 'PURCHASE' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setType('PURCHASE'); setSelectedSale(null); }}>Purchase Return</button>
        </div>

        {!selectedSale && !selectedPurchase && (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder={type === 'SALE' ? 'Search invoice #…' : 'Search purchase #…'} value={refSearch} onChange={(e) => setRefSearch(e.target.value)} />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-100">
              {type === 'SALE'
                ? (sales ?? []).slice(0, 8).map((s) => (
                    <button key={s.id} className="flex w-full justify-between border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50" onClick={() => setSelectedSale(s)}>
                      <span>{s.invoiceNumber} — {s.customer?.name ?? s.walkInCustomerName}</span>
                      <span>{formatCurrency(s.totalAmount)}</span>
                    </button>
                  ))
                : (purchases ?? []).slice(0, 8).map((p) => (
                    <button key={p.id} className="flex w-full justify-between border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50" onClick={() => setSelectedPurchase(p)}>
                      <span>{p.purchaseNumber} — {p.supplier?.name}</span>
                      <span>{formatCurrency(p.totalAmount)}</span>
                    </button>
                  ))}
            </div>
          </div>
        )}

        {(selectedSale || selectedPurchase) && (
          <>
            <p className="text-sm text-slate-600">
              Reference: <span className="font-medium">{selectedSale?.invoiceNumber ?? selectedPurchase?.purchaseNumber}</span>{' '}
              <button className="text-xs text-brand-700 hover:underline" onClick={() => { setSelectedSale(null); setSelectedPurchase(null); }}>Change</button>
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100">
              <table className="table-base">
                <thead><tr><th>Medicine</th><th>Sold/Purchased Qty</th><th>Return Qty</th></tr></thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.medicine?.name ?? it.medicineId}</td>
                      <td>{it.quantity}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={it.quantity}
                          className="input !w-24 !py-1"
                          value={quantities[it.id] ?? 0}
                          onChange={(e) => setQuantities((q) => ({ ...q, [it.id]: Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0)) }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label className="label">Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, customer changed mind…" />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { reset(); onClose(); }}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={createReturn.isPending}>Submit Return</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
