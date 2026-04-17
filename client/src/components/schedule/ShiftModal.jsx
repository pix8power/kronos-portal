import { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { schedulesAPI } from '../../services/api';

export default function ShiftModal({ shift, employees, defaultDate, onClose, onSave }) {
  const [form, setForm] = useState({
    employee: '',
    date: defaultDate || '',
    startTime: '09:00',
    endTime: '17:00',
    position: '',
    department: '',
    notes: '',
    status: 'scheduled',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null); // conflict detail from server
  const [forceMode, setForceMode] = useState(false);

  useEffect(() => {
    if (shift) {
      setForm({
        employee: shift.employee?._id || shift.employee || '',
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position || '',
        department: shift.department || '',
        notes: shift.notes || '',
        status: shift.status || 'scheduled',
      });
    }
  }, [shift]);

  // Reset conflict when form changes
  useEffect(() => { setConflict(null); setForceMode(false); }, [form.employee, form.date, form.startTime, form.endTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (shift?._id) {
        result = await schedulesAPI.updateShift(shift._id, form);
      } else {
        result = await schedulesAPI.createShift({ ...form, force: forceMode });
      }
      onSave(result.data, !!shift?._id);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.conflict) {
        setConflict(err.response.data);
        setError('');
      } else {
        setError(err.response?.data?.message || 'Failed to save shift');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shift?._id || !confirm('Delete this shift?')) return;
    setLoading(true);
    try {
      await schedulesAPI.deleteShift(shift._id);
      onSave(shift, false, true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">
            {shift?._id ? 'Edit Shift' : 'Add Shift'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          {/* Conflict warning */}
          {conflict && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {conflict.timeOffConflict ? 'Approved Time Off' : 'Shift Conflict'}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{conflict.message}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setConflict(null); setForm((f) => ({ ...f, date: '' })); }}
                  className="flex-1 text-xs font-medium px-3 py-1.5 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100"
                >
                  Change date
                </button>
                <button
                  type="button"
                  onClick={() => { setForceMode(true); setConflict(null); }}
                  className="flex-1 text-xs font-medium px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  Schedule anyway
                </button>
              </div>
            </div>
          )}

          {forceMode && !conflict && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Override active — submitting despite conflict.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member *</label>
            <select
              required
              value={form.employee}
              onChange={(e) => {
                const emp = employees.find((em) => em._id === e.target.value);
                setForm({ ...form, employee: e.target.value, position: emp?.position || form.position, department: emp?.department || form.department });
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select staff member</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} {emp.position ? `(${emp.position})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. R.N." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. WCR Onc" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {shift?._id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            {shift?._id && (
              <button type="button" onClick={handleDelete} disabled={loading}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                Delete
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors">
              {loading ? 'Saving...' : shift?._id ? 'Update' : 'Add Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
