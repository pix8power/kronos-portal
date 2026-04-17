import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { schedulesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const ACTION_COLORS = {
  create_shift:       'bg-green-100 text-green-700',
  bulk_create_shifts: 'bg-green-100 text-green-700',
  update_shift:       'bg-blue-100 text-blue-700',
  delete_shift:       'bg-red-100 text-red-700',
  clock_in:           'bg-teal-100 text-teal-700',
  clock_out:          'bg-teal-100 text-teal-700',
  timeoff_approved:   'bg-purple-100 text-purple-700',
  timeoff_denied:     'bg-orange-100 text-orange-700',
};

const actionLabel = (action) =>
  action?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || action;

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const LIMIT = 50;

  if (!['admin', 'manager'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await schedulesAPI.getAuditLog({ page: p, limit: LIMIT });
      setLogs(res.data.logs || []);
      setPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit log', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const filtered = filter
    ? logs.filter((l) => l.action?.includes(filter) || l.entity?.toLowerCase().includes(filter))
    : logs;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <span className="text-sm text-gray-500 ml-2">{total.toLocaleString()} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="shift">Shifts</option>
            <option value="clock">Clock In/Out</option>
            <option value="timeoff">Time Off</option>
            <option value="bulk">Bulk Operations</option>
          </select>
          <button
            onClick={() => load(page)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No audit entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {log.createdAt
                        ? format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs">{log.userName || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{log.entity || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page} of {pages} ({total.toLocaleString()} total)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
