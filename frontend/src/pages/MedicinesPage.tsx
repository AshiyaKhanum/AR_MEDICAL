import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Search, Barcode as BarcodeIcon, Ban } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useCategories, useCreateCategory, useCreateManufacturer, useManufacturers } from '../hooks/useCatalog';
import { useCreateMedicine, useDeactivateMedicine, useMedicines, useUpdateMedicine } from '../hooks/useMedicines';
import { usePermissions } from '../hooks/useAuth';
import { apiErrorMessage } from '../api/client';
import { daysUntil, formatDate } from '../utils/format';
import type { Medicine } from '../types/models';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  genericName: z.string().optional(),
  categoryId: z.string().optional(),
  manufacturerId: z.string().optional(),
  sku: z.string().min(1, 'Required'),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  gstPercent: z.coerce.number().min(0).max(100),
  unit: z.string().min(1),
  minStockLevel: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

export default function MedicinesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const { canManageInventory } = usePermissions();

  const { data: medicines, isLoading } = useMedicines({ search, status });
  const { data: categories } = useCategories();
  const { data: manufacturers } = useManufacturers();
  const createMedicine = useCreateMedicine();
  const updateMedicine = useUpdateMedicine();
  const deactivateMedicine = useDeactivateMedicine();
  const createCategory = useCreateCategory();
  const createManufacturer = useCreateManufacturer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', genericName: '', categoryId: '', manufacturerId: '', sku: '', barcode: '', hsnCode: '', gstPercent: 12, unit: 'STRIP', minStockLevel: 10 });
    setModalOpen(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    reset({
      name: m.name,
      genericName: m.genericName ?? '',
      categoryId: m.categoryId ?? '',
      manufacturerId: m.manufacturerId ?? '',
      sku: m.sku,
      barcode: m.barcode ?? '',
      hsnCode: m.hsnCode ?? '',
      gstPercent: m.gstPercent,
      unit: m.unit,
      minStockLevel: m.minStockLevel,
    });
    setModalOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      categoryId: values.categoryId || null,
      manufacturerId: values.manufacturerId || null,
      barcode: values.barcode || null,
    };
    const mutation = editing ? updateMedicine.mutateAsync({ id: editing.id, payload }) : createMedicine.mutateAsync(payload);
    mutation
      .then(() => {
        toast.success(editing ? 'Medicine updated' : 'Medicine added');
        setModalOpen(false);
      })
      .catch((err) => toast.error(apiErrorMessage(err)));
  };

  const rows = useMemo(() => medicines ?? [], [medicines]);

  return (
    <div>
      <PageHeader
        title="Medicine Inventory"
        subtitle="Manage medicines, pricing, GST and stock levels"
        actions={
          canManageInventory && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Medicine
            </button>
          )
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, generic, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Category</th>
                <th>SKU / Barcode</th>
                <th>Stock</th>
                <th>GST%</th>
                <th>Nearest Expiry</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">No medicines found</td></tr>
              )}
              {rows.map((m) => {
                const expiryDays = m.nearestExpiry ? daysUntil(m.nearestExpiry) : null;
                return (
                  <tr key={m.id}>
                    <td>
                      <Link to={`/medicines/${m.id}`} className="font-medium text-brand-700 hover:underline">{m.name}</Link>
                      <p className="text-xs text-slate-400">{m.genericName}</p>
                    </td>
                    <td>{m.category?.name ?? '-'}</td>
                    <td className="font-mono text-xs">{m.sku}{m.barcode ? ` / ${m.barcode}` : ''}</td>
                    <td>
                      <span className={m.totalStock === 0 ? 'font-semibold text-red-600' : (m.totalStock ?? 0) <= m.minStockLevel ? 'font-semibold text-amber-600' : ''}>
                        {m.totalStock ?? 0} {m.unit}
                      </span>
                    </td>
                    <td>{Number(m.gstPercent)}%</td>
                    <td>
                      {m.nearestExpiry ? (
                        <span className={expiryDays !== null && expiryDays < 30 ? 'text-red-600' : ''}>{formatDate(m.nearestExpiry)}</span>
                      ) : '-'}
                    </td>
                    <td><StatusBadge status={m.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="text-right space-x-2">
                      <Link to={`/medicines/${m.id}`} className="text-xs font-medium text-brand-700 hover:underline">Batches</Link>
                      {canManageInventory && (
                        <>
                          <button className="text-xs font-medium text-slate-500 hover:underline" onClick={() => openEdit(m)}>Edit</button>
                          {m.isActive && (
                            <button
                              className="text-xs font-medium text-red-500 hover:underline"
                              onClick={() => {
                                if (confirm(`Deactivate ${m.name}?`)) {
                                  deactivateMedicine.mutate(m.id, { onError: (e) => toast.error(apiErrorMessage(e)) });
                                }
                              }}
                            >
                              <Ban className="inline h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Medicine' : 'Add Medicine'} width="max-w-2xl">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Medicine Name</label>
            <input className="input" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Generic Name</label>
            <input className="input" {...register('genericName')} />
          </div>
          <div>
            <label className="label flex items-center justify-between">
              Category
              <button
                type="button"
                className="text-xs text-brand-700 hover:underline"
                onClick={() => {
                  const name = prompt('New category name');
                  if (name) createCategory.mutate(name, { onError: (e) => toast.error(apiErrorMessage(e)) });
                }}
              >
                + New
              </button>
            </label>
            <select className="input" {...register('categoryId')}>
              <option value="">— None —</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label flex items-center justify-between">
              Manufacturer
              <button
                type="button"
                className="text-xs text-brand-700 hover:underline"
                onClick={() => {
                  const name = prompt('New manufacturer name');
                  if (name) createManufacturer.mutate(name, { onError: (e) => toast.error(apiErrorMessage(e)) });
                }}
              >
                + New
              </button>
            </label>
            <select className="input" {...register('manufacturerId')}>
              <option value="">— None —</option>
              {manufacturers?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">SKU</label>
            <input className="input" {...register('sku')} />
            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
          </div>
          <div>
            <label className="label flex items-center gap-1"><BarcodeIcon className="h-3.5 w-3.5" /> Barcode</label>
            <input className="input" {...register('barcode')} placeholder="Optional — scan or type" />
          </div>
          <div>
            <label className="label">HSN Code</label>
            <input className="input" {...register('hsnCode')} />
          </div>
          <div>
            <label className="label">Unit</label>
            <select className="input" {...register('unit')}>
              {['STRIP', 'BOTTLE', 'TABLET', 'BOX', 'VIAL', 'TUBE', 'SACHET'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">GST %</label>
            <input type="number" step="0.01" className="input" {...register('gstPercent')} />
          </div>
          <div>
            <label className="label">Minimum Stock Level</label>
            <input type="number" className="input" {...register('minStockLevel')} />
          </div>
          <div className="col-span-full flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMedicine.isPending || updateMedicine.isPending}>
              {editing ? 'Save Changes' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
