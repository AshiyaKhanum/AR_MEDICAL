import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useCreateSupplier, useSuppliers } from '../hooks/useSuppliers';
import { apiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';
import { usePermissions } from '../hooks/useAuth';

interface FormValues {
  name: string; contactPerson?: string; phone?: string; email?: string; address?: string; gstin?: string;
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const { data: suppliers, isLoading } = useSuppliers(search);
  const createSupplier = useCreateSupplier();
  const { canManageInventory } = usePermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  return (
    <div>
      <PageHeader
        title="Supplier Management"
        subtitle="Manage suppliers, purchase history and pending payments"
        actions={canManageInventory && <button className="btn-primary" onClick={() => { reset({}); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Supplier</button>}
      />

      <div className="card mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Purchases</th><th>Pending</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(suppliers ?? []).map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/suppliers/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link></td>
                  <td>{s.contactPerson ?? '-'}</td>
                  <td>{s.phone ?? '-'}</td>
                  <td>{s.purchaseCount ?? 0} ({formatCurrency(s.totalPurchased ?? 0)})</td>
                  <td className={((s.pendingAmount ?? 0) > 0) ? 'font-semibold text-amber-600' : ''}>{formatCurrency(s.pendingAmount ?? 0)}</td>
                </tr>
              ))}
              {!isLoading && (suppliers ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No suppliers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Supplier">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) =>
            createSupplier.mutate(values, {
              onSuccess: () => { toast.success('Supplier added'); setModalOpen(false); },
              onError: (err) => toast.error(apiErrorMessage(err)),
            })
          )}
        >
          <div className="col-span-full"><label className="label">Supplier Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Contact Person</label><input className="input" {...register('contactPerson')} /></div>
          <div><label className="label">Phone</label><input className="input" {...register('phone')} /></div>
          <div><label className="label">Email</label><input className="input" {...register('email')} /></div>
          <div><label className="label">GSTIN</label><input className="input" {...register('gstin')} /></div>
          <div className="col-span-full"><label className="label">Address</label><input className="input" {...register('address')} /></div>
          <div className="col-span-full flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createSupplier.isPending}>Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
