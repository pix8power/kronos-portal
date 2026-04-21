import { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { schedulesAPI } from '../../services/api';

const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const shiftHours = (start, end) => Math.max(0, (toMins(end) - toMins(start)) / 60);
const shiftDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const isWeekendDay = (dateStr) => { const dow = new Date(dateStr + 'T00:00:00').getDay(); return dow === 0 || dow === 6; };

const weekBounds = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  const sat = new Date(d); sat.setDate(d.getDate() + (6 - day));
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  return { start: fmt(sun), end: fmt(sat) };
};

export default function ShiftModal({ shift, employees, defaultDate, defaultEmployee, holidays, allShifts, onClose, onSave }) {
  const [form, setForm] = useState({
    employee: defaultEmployee || '',
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
  const [conflict, setConflict] = useState(null);
  const [forceMode, setForceMode] = useState(false);
  const [holidayConfirm, setHolidayConfirm] = useState(null);
  const [overtimeWarning, setOvertimeWarning] = useState(null);
  const [prevWeekendShifts, setPrevWeekendShifts] = useState([]);

  const holidayMap = Object.fromEntries((holidays || []).map((h) => [h.date, h.name]));

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

  // Reset conflict/holiday/overtime prompt when form changes
  useEffect(() => { setConflict(null); setForceMode(false); setHolidayConfirm(null); setOvertimeWarning(null); }, [form.employee, form.date, form.startTime, form.endTime]);

  // Fetch prior 2 weekends' shifts when employee + weekend date are set
  useEffect(() => {
    if (!form.employee || !form.date || !isWeekendDay(form.date)) { setPrevWeekendShifts([]); return; }
    const { start: ws } = weekBounds(form.date);
    schedulesAPI.getShifts({ employeeId: form.employee, startDate: shiftDays(ws, -14), endDate: shiftDays(ws, -1) })
      .then((res) => setPrevWeekendShifts(res.data || []))
      .catch(() => setPrevWeekendShifts([]));
  }, [form.employee, form.date]);

  const doSave = async () => {
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

  const checkOvertime = () => {
    if (!form.employee || !form.date || !form.startTime || !form.endTime) return null;
    const newHours = shiftHours(form.startTime, form.endTime);
    const { start: weekStart, end: weekEnd } = weekBounds(form.date);
    const weekShifts = (allShifts || []).filter((s) => {
      const empId = s.employee?._id || s.employee;
      const isThisEmp = empId === form.employee;
      const inWeek = s.date >= weekStart && s.date <= weekEnd;
      const isEdited = shift?._id && s._id === shift._id;
      return isThisEmp && inWeek && !isEdited;
    });
    const existingWeekHours = weekShifts.reduce((acc, s) => acc + shiftHours(s.startTime, s.endTime), 0);
    const weekTotal = existingWeekHours + newHours;
    const dailyOT = newHours > 8;
    const doubleTime = newHours > 12;
    const weeklyOT = weekTotal > 40;

    // Consecutive weekends: check if prev 2 weekends had any shift
    let consecutiveWeekends = false;
    if (isWeekendDay(form.date)) {
      let weekendsWorked = 0;
      for (let n = 1; n <= 2; n++) {
        const prevSun = shiftDays(weekStart, -7 * n);
        const prevSat = shiftDays(weekStart, -7 * n + 6);
        const worked = prevWeekendShifts.some((s) => {
          const empId = s.employee?._id || s.employee;
          return empId === form.employee && (s.date === prevSun || s.date === prevSat);
        });
        if (worked) weekendsWorked++;
      }
      if (weekendsWorked >= 2) consecutiveWeekends = true;
    }

    if (!dailyOT && !weeklyOT && !consecutiveWeekends) return null;
    return { newHours, weekTotal, existingWeekHours, dailyOT, weeklyOT, doubleTime, consecutiveWeekends };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const holiday = form.date && holidayMap[form.date];
    if (holiday && !holidayConfirm) {
      setHolidayConfirm(holiday);
      return;
    }
    setHolidayConfirm(null);
    if (!overtimeWarning) {
      const ot = checkOvertime();
      if (ot) { setOvertimeWarning(ot); return; }
    }
    setOvertimeWarning(null);
    await doSave();
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

          {holidayConfirm && (
            <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-900">Scheduling on a Holiday</p>
                  <p className="text-xs text-purple-700 mt-0.5">
                    <strong>{holidayConfirm}</strong> is a public holiday. Are you sure you want to schedule this staff member on this day?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHolidayConfirm(null)}
                  className="flex-1 text-xs font-medium px-3 py-1.5 border border-purple-300 text-purple-800 rounded-lg hover:bg-purple-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 text-xs font-medium px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Yes, schedule anyway
                </button>
              </div>
            </div>
          )}

          {overtimeWarning && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-orange-900">Overtime Warning (U.S. Labor Law)</p>
                  {overtimeWarning.doubleTime && (
                    <p className="text-xs text-orange-800">
                      • This shift is <strong>{overtimeWarning.newHours.toFixed(1)} hours</strong> — exceeds 12 hrs/day (double-time territory in many states).
                    </p>
                  )}
                  {overtimeWarning.dailyOT && !overtimeWarning.doubleTime && (
                    <p className="text-xs text-orange-800">
                      • This shift is <strong>{overtimeWarning.newHours.toFixed(1)} hours</strong> — exceeds 8 hrs/day (daily overtime).
                    </p>
                  )}
                  {overtimeWarning.weeklyOT && (
                    <p className="text-xs text-orange-800">
                      • Weekly total will be <strong>{overtimeWarning.weekTotal.toFixed(1)} hrs</strong> ({(overtimeWarning.weekTotal - 40).toFixed(1)} hrs of OT over the 40-hr FLSA threshold).
                    </p>
                  )}
                  {overtimeWarning.consecutiveWeekends && (
                    <p className="text-xs text-orange-800">
                      • This would be their <strong>3rd consecutive weekend</strong> worked — many state laws and union contracts require extra compensation or mandatory days off.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOvertimeWarning(null)}
                  className="flex-1 text-xs font-medium px-3 py-1.5 border border-orange-300 text-orange-800 rounded-lg hover:bg-orange-100"
                >
                  Go back
                </button>
                <button
                  type="submit"
                  className="flex-1 text-xs font-medium px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Schedule anyway
                </button>
              </div>
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
