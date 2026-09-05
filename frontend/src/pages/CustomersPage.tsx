import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useCreateCustomer, useCustomers } from '../hooks/useCustomers';
import { apiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';

interface FormValues { name: string; phone?: string; email?: string; address?: string; }

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const { data: customers, isLoading } = useCustomers(search);
  const createCustomer = useCreateCustomer();
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  return (
    <div>
      <PageHeader
        title="Customer Management"
        subtitle="Customer details, billing history and outstanding amounts"
        actions={<button className="btn-primary" onClick={() => { reset({}); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Customer</button>}
      />

      <div className="card mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Customer</th><th>Phone</th><th>Invoices</th><th>Total Billed</th><th>Outstanding</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(customers ?? []).map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link></td>
                  <td>{c.phone ?? '-'}</td>
                  <td>{c.salesCount ?? 0}</td>
                  <td>{formatCurrency(c.totalBilled ?? 0)}</td>
                  <td className={((c.outstanding ?? 0) > 0) ? 'font-semibold text-amber-600' : ''}>{formatCurrency(c.outstanding ?? 0)}</td>
                </tr>
              ))}
              {!isLoading && (customers ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Customer">
        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={handleSubmit((values) =>
            createCustomer.mutate(values, {
              onSuccess: () => { toast.success('Customer added'); setModalOpen(false); },
              onError: (err) => toast.error(apiErrorMessage(err)),
            })
          )}
        >
          <div><label className="label">Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Phone</label><input className="input" {...register('phone')} /></div>
          <div><label className="label">Email</label><input className="input" {...register('email')} /></div>
          <div><label className="label">Address</label><input className="input" {...register('address')} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createCustomer.isPending}>Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
