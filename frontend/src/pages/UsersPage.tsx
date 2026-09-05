import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Ban } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { apiClient, apiErrorMessage } from '../api/client';
import { formatDateTime } from '../utils/format';
import type { User } from '../types/models';

interface FormValues { name: string; email: string; phone?: string; password: string; role: 'ADMIN' | 'PHARMACIST' | 'STAFF'; }

export default function UsersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { role: 'STAFF' } });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get<{ data: User[] }>('/users')).data.data,
  });

  const createUser = useMutation({
    mutationFn: async (payload: FormValues) => (await apiClient.post('/users', payload)).data.data,
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const deactivateUser = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/users/${id}`)).data.data,
    onSuccess: () => {
      toast.success('User deactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Admin, Pharmacist and Staff accounts with role-based permissions"
        actions={<button className="btn-primary" onClick={() => { reset({ role: 'STAFF' }); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add User</button>}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                  <td><StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td>
                    {u.isActive && (
                      <button className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateUser.mutate(u.id); }}>
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add User">
        <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit((v) => createUser.mutate(v))}>
          <div><label className="label">Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Email</label><input type="email" className="input" {...register('email', { required: true })} /></div>
          <div><label className="label">Phone</label><input className="input" {...register('phone')} /></div>
          <div><label className="label">Password</label><input type="password" className="input" {...register('password', { required: true, minLength: 6 })} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" {...register('role')}>
              <option value="ADMIN">Admin</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createUser.isPending}>Create User</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
