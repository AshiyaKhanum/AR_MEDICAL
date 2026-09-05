import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Printer } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAddBatch, useMedicine } from '../hooks/useMedicines';
import { usePermissions } from '../hooks/useAuth';
import { apiErrorMessage } from '../api/client';
import { formatCurrency, formatDate, daysUntil } from '../utils/format';

const schema = z.object({
  batchNumber: z.string().min(1),
  supplierId: z.string().optional(),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).max(100),
  quantity: z.coerce.number().int().min(0),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: medicine, isLoading } = useMedicine(id);
  const { canManageInventory } = usePermissions();
  const addBatch = useAddBatch();
  const [modalOpen, setModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isLoading || !medicine) return <div className="text-sm text-slate-500">Loading…</div>;

  const onSubmit = (values: FormValues) => {
    addBatch.mutate(
      { medicineId: medicine.id, payload: { ...values, supplierId: values.supplierId || null } as any },
      {
        onSuccess: () => {
          toast.success('Batch added');
          setModalOpen(false);
          reset();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  };

  const barcodeValue = medicine.barcode || medicine.sku;

  return (
    <div>
      <Link to="/medicines" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Medicines
      </Link>
      <PageHeader
        title={medicine.name}
        subtitle={`${medicine.genericName ?? ''} ${medicine.category ? `• ${medicine.category.name}` : ''} ${medicine.manufacturer ? `• ${medicine.manufacturer.name}` : ''}`}
        actions={
          canManageInventory && (
            <button className="btn-primary" onClick={() => { reset({ gstPercent: Number(medicine.gstPercent), quantity: 0 } as any); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Batch
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-400">SKU / Barcode</p>
          <p className="font-mono text-sm">{medicine.sku}{medicine.barcode ? ` / ${medicine.barcode}` : ''}</p>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={`${import.meta.env.VITE_API_BASE_URL || '/api'}/barcodes/value/${encodeURIComponent(barcodeValue)}`}
              alt="Barcode"
              className="h-16"
            />
            <button
              className="btn-secondary !px-2 !py-1.5"
              onClick={() => {
                const w = window.open('', '_blank', 'width=400,height=300');
                if (!w) return;
                w.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding-top:40px">
                  <img src="${import.meta.env.VITE_API_BASE_URL || '/api'}/barcodes/value/${encodeURIComponent(barcodeValue)}" />
                  <p>${medicine.name}</p>
                  <script>window.onload = () => window.print();</script>
                </body></html>`);
              }}
              title="Print barcode label"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-400">Total Stock</p>
          <p className="text-xl font-bold">{medicine.totalStock ?? 0} {medicine.unit}</p>
          <p className="text-xs text-slate-500">Minimum level: {medicine.minStockLevel}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-400">GST</p>
          <p className="text-xl font-bold">{Number(medicine.gstPercent)}%</p>
          <p className="text-xs text-slate-500">HSN: {medicine.hsnCode ?? '-'}</p>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Batch-wise Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Batch #</th><th>Supplier</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>MRP</th><th>GST%</th><th>Expiry</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(medicine.batches ?? []).map((b) => {
                const days = daysUntil(b.expiryDate);
                const status = days < 0 ? 'EXPIRED' : days <= 30 ? 'EXPIRING SOON' : 'OK';
                return (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">{b.batchNumber}</td>
                    <td>{b.supplier?.name ?? '-'}</td>
                    <td>{b.quantity}</td>
                    <td>{formatCurrency(b.purchasePrice)}</td>
                    <td>{formatCurrency(b.sellingPrice)}</td>
                    <td>{formatCurrency(b.mrp)}</td>
                    <td>{Number(b.gstPercent)}%</td>
                    <td>{formatDate(b.expiryDate)}</td>
                    <td>
                      <StatusBadge status={status === 'OK' ? 'ACTIVE' : status === 'EXPIRED' ? 'REJECTED' : 'REQUESTED'} />
                    </td>
                  </tr>
                );
              })}
              {(medicine.batches ?? []).length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">No batches yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Batch">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Batch Number</label>
            <input className="input" {...register('batchNumber')} />
            {errors.batchNumber && <p className="mt-1 text-xs text-red-600">{errors.batchNumber.message}</p>}
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" className="input" {...register('quantity')} />
          </div>
          <div>
            <label className="label">Purchase Price</label>
            <input type="number" step="0.01" className="input" {...register('purchasePrice')} />
          </div>
          <div>
            <label className="label">Selling Price</label>
            <input type="number" step="0.01" className="input" {...register('sellingPrice')} />
          </div>
          <div>
            <label className="label">MRP</label>
            <input type="number" step="0.01" className="input" {...register('mrp')} />
          </div>
          <div>
            <label className="label">GST %</label>
            <input type="number" step="0.01" className="input" {...register('gstPercent')} />
          </div>
          <div>
            <label className="label">Manufacturing Date</label>
            <input type="date" className="input" {...register('manufacturingDate')} />
          </div>
          <div>
            <label className="label">Expiry Date</label>
            <input type="date" className="input" {...register('expiryDate')} />
            {errors.expiryDate && <p className="mt-1 text-xs text-red-600">{errors.expiryDate.message}</p>}
          </div>
          <div className="col-span-full flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addBatch.isPending}>Add Batch</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
