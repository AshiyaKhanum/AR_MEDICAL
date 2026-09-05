import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import { apiClient } from '../api/client';
import { formatDateTime } from '../utils/format';
import type { AuditLog } from '../types/models';

export default function AuditLogsPage() {
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', module, action],
    queryFn: async () =>
      (await apiClient.get<{ data: AuditLog[] }>('/audit-logs', { params: { module: module || undefined, action: action || undefined } })).data.data,
  });

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Every create/update/delete/login action across the system, with before/after values" />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <select className="input sm:w-56" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">All modules</option>
          {['Auth', 'User', 'Medicine', 'Batch', 'Supplier', 'Customer', 'Purchase', 'Sale', 'Return', 'Category', 'Manufacturer'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="input sm:w-56" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'RETURN', 'PAYMENT', 'EXPORT'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
              {(logs ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.user ? `${log.user.name} (${log.user.role})` : 'System'}</td>
                  <td className="font-medium">{log.action}</td>
                  <td>{log.module}</td>
                  <td className="font-mono text-xs">{log.recordId ? log.recordId.slice(0, 8) : '-'}</td>
                  <td className="max-w-xs truncate text-xs text-slate-500">
                    {log.newValue ? JSON.stringify(log.newValue).slice(0, 80) : ''}
                  </td>
                </tr>
              ))}
              {!isLoading && (logs ?? []).length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No audit entries found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
