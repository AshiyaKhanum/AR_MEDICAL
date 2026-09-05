import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useSuppliers } from '../hooks/useSuppliers';
import { useMedicines } from '../hooks/useMedicines';
import { useCreatePurchase } from '../hooks/usePurchases';
import { apiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';

interface Line {
  medicineId: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gstPercent: number;
  expiryDate: string;
  manufacturingDate: string;
}

const emptyLine: Line = { medicineId: '', batchNumber: '', quantity: 1, purchasePrice: 0, sellingPrice: 0, mrp: 0, gstPercent: 12, expiryDate: '', manufacturingDate: '' };

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const { data: suppliers } = useSuppliers();
  const { data: medicines } = useMedicines({ status: 'active' });
  const createPurchase = useCreatePurchase();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.purchasePrice * l.quantity, 0);
    const gstAmount = lines.reduce((s, l) => s + (l.purchasePrice * l.quantity * l.gstPercent) / 100, 0);
    const totalAmount = Math.max(0, subTotal + gstAmount - discountAmount);
    return { subTotal, gstAmount, totalAmount };
  }, [lines, discountAmount]);

  function handleSubmit() {
    if (!supplierId) return toast.error('Select a supplier');
    if (lines.some((l) => !l.medicineId || !l.batchNumber || !l.expiryDate || l.quantity <= 0)) {
      return toast.error('Fill in all required fields for every line item');
    }
    createPurchase.mutate(
      {
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        discountAmount,
        paidAmount,
        items: lines.map((l) => ({
          medicineId: l.medicineId,
          batchNumber: l.batchNumber,
          quantity: l.quantity,
          purchasePrice: l.purchasePrice,
          sellingPrice: l.sellingPrice,
          mrp: l.mrp,
          gstPercent: l.gstPercent,
          expiryDate: l.expiryDate,
          manufacturingDate: l.manufacturingDate || undefined,
        })),
      },
      {
        onSuccess: (purchase) => {
          toast.success(`Purchase ${purchase.purchaseNumber} recorded — inventory updated`);
          navigate(`/purchases/${purchase.id}`);
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  }

  return (
    <div>
      <Link to="/purchases" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Purchases
      </Link>
      <PageHeader title="New Purchase" subtitle="Supplier → Purchase → Batch → Inventory Increase" />

      <div className="card mb-4 grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier…</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Supplier Invoice #</label>
          <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Discount Amount (₹)</label>
          <input type="number" className="input" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
          <button className="btn-secondary !py-1.5" onClick={addLine}><Plus className="h-4 w-4" /> Add Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th><th>Batch #</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>MRP</th><th>GST%</th><th>Mfg Date</th><th>Expiry*</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="min-w-[180px]">
                    <select className="input !py-1.5" value={l.medicineId} onChange={(e) => updateLine(idx, { medicineId: e.target.value })}>
                      <option value="">Select…</option>
                      {(medicines ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td><input className="input !w-28 !py-1.5" value={l.batchNumber} onChange={(e) => updateLine(idx, { batchNumber: e.target.value })} /></td>
                  <td><input type="number" className="input !w-20 !py-1.5" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" step="0.01" className="input !w-24 !py-1.5" value={l.purchasePrice} onChange={(e) => updateLine(idx, { purchasePrice: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" step="0.01" className="input !w-24 !py-1.5" value={l.sellingPrice} onChange={(e) => updateLine(idx, { sellingPrice: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" step="0.01" className="input !w-24 !py-1.5" value={l.mrp} onChange={(e) => updateLine(idx, { mrp: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" step="0.01" className="input !w-20 !py-1.5" value={l.gstPercent} onChange={(e) => updateLine(idx, { gstPercent: Number(e.target.value) || 0 })} /></td>
                  <td><input type="date" className="input !w-36 !py-1.5" value={l.manufacturingDate} onChange={(e) => updateLine(idx, { manufacturingDate: e.target.value })} /></td>
                  <td><input type="date" className="input !w-36 !py-1.5" value={l.expiryDate} onChange={(e) => updateLine(idx, { expiryDate: e.target.value })} /></td>
                  <td>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
        <div className="card w-full p-4 sm:w-80">
          <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subTotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">GST</span><span>{formatCurrency(totals.gstAmount)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span>- {formatCurrency(discountAmount)}</span></div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(totals.totalAmount)}</span></div>
          <div className="mt-2">
            <label className="label">Paid Now (₹)</label>
            <input type="number" className="input" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value) || 0)} />
          </div>
          <button className="btn-primary mt-3 w-full" onClick={handleSubmit} disabled={createPurchase.isPending}>
            {createPurchase.isPending ? 'Saving…' : 'Save Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}
