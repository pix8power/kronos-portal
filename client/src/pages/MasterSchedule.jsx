import { useState, useEffect, useCallback } from 'react';
import { format, nextSunday, isSunday, parseISO, startOfDay } from 'date-fns';
import {
  CalendarRange,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { masterScheduleAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Find the most recent or upcoming Sunday for an anchor date
function getNearestSunday(date = new Date()) {
  const d = startOfDay(date);
  if (isSunday(d)) return d;
  return nextSunday(d);
}

const ROLE_CAN_MANAGE = ['admin', 'manager', 'charge_nurse'];

export default function MasterSchedule() {
  const { user, activeDepartment } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [applyError, setApplyError] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [applying, setApplying] = useState(false);

  // Add entry form state
  const [addForm, setAddForm] = useState(null); // { week, dayOfWeek } or null

  const canManage = ROLE_CAN_MANAGE.includes(user?.role);

  // Filter users to the active department (if one is selected)
  const deptUsers = activeDepartment
    ? users.filter((u) => u.department === activeDepartment || (u.departments || []).includes(activeDepartment))
    : users;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, usersRes] = await Promise.all([
        masterScheduleAPI.get(),
        usersAPI.getAll(),
      ]);
      setSchedule(schedRes.data);
      setUsers(usersRes.data || []);
    } catch {
      setSchedule(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    const anchorDate = format(getNearestSunday(), 'yyyy-MM-dd');
    setSaving(true);
    try {
      const res = await masterScheduleAPI.create({ name: 'Master Schedule', anchorDate });
      setSchedule(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateAnchor(newDate) {
    if (!schedule) return;
    try {
      const res = await masterScheduleAPI.update(schedule._id, { anchorDate: newDate });
      setSchedule(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update anchor date');
    }
  }

  async function handleAddEntry(entryData) {
    if (!schedule) return;
    setSaving(true);
    try {
      const res = await masterScheduleAPI.addEntry(schedule._id, entryData);
      setSchedule(res.data);
      setAddForm(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveEntry(entryId) {
    if (!schedule) return;
    try {
      const res = await masterScheduleAPI.removeEntry(schedule._id, entryId);
      setSchedule(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove entry');
    }
  }

  async function handleApply() {
    if (!schedule) return;
    setApplying(true);
    setApplyResult(null);
    setApplyError(null);
    try {
      const res = await masterScheduleAPI.apply(schedule._id, { replaceExisting });
      setApplyResult(res.data);
      setShowApplyModal(false);
    } catch (err) {
      setApplyError(err.response?.data?.message || 'Failed to apply schedule');
    } finally {
      setApplying(false);
    }
  }

  // Group entries by week + dayOfWeek, filtered to active department
  function getEntriesFor(week, dayOfWeek) {
    if (!schedule?.entries) return [];
    return schedule.entries.filter((e) => {
      if (e.week !== week || e.dayOfWeek !== dayOfWeek) return false;
      if (!activeDepartment) return true;
      const emp = e.employee;
      if (!emp) return true;
      return emp.department === activeDepartment || (emp.departments || []).includes(activeDepartment);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Schedule</h1>
            <p className="text-sm text-gray-500">
              2-week rotating template that applies to staff's annual schedule
              {activeDepartment && <span className="ml-2 font-semibold text-blue-600">· {activeDepartment}</span>}
            </p>
          </div>
        </div>
        {canManage && schedule && (
          <button
            onClick={() => { setShowApplyModal(true); setApplyResult(null); setApplyError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Apply to Schedule
          </button>
        )}
      </div>

      {/* Apply result banner */}
      {applyResult && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-green-800">{applyResult.message}</p>
          </div>
          <button onClick={() => setApplyResult(null)} className="ml-auto text-green-600 hover:text-green-800 text-lg leading-none">&times;</button>
        </div>
      )}
      {applyError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <p className="font-medium text-red-800">{applyError}</p>
          <button onClick={() => setApplyError(null)} className="ml-auto text-red-600 hover:text-red-800 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* No schedule yet */}
      {!schedule && canManage && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <CalendarRange className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Master Schedule Yet</h2>
          <p className="text-gray-500 mb-6">Create a 2-week rotating template to apply across the year.</p>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Master Schedule'}
          </button>
        </div>
      )}

      {!schedule && !canManage && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CalendarRange className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No master schedule has been set up yet.</p>
        </div>
      )}

      {/* Schedule grid */}
      {schedule && (
        <>
          {/* Anchor date picker */}
          {canManage && (
            <div className="mb-5 p-4 bg-white rounded-xl border border-gray-200 flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Week 1 Start (Sunday)</label>
                <input
                  type="date"
                  value={schedule.anchorDate}
                  onChange={(e) => {
                    const d = parseISO(e.target.value);
                    if (!isSunday(d)) {
                      alert('Anchor date must be a Sunday. Please pick a Sunday.');
                      return;
                    }
                    handleUpdateAnchor(e.target.value);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Week 1 begins on {format(parseISO(schedule.anchorDate), 'MMMM d, yyyy')}. The 2-week pattern repeats every 14 days.
              </p>
            </div>
          )}

          {/* Week grids */}
          {[1, 2].map((week) => (
            <WeekStaffGrid
              key={week}
              week={week}
              users={deptUsers}
              entries={schedule.entries || []}
              canManage={canManage}
              activeDepartment={activeDepartment}
              onAdd={(dayOfWeek, employeeId) => setAddForm({ week, dayOfWeek, employeeId })}
              onRemove={handleRemoveEntry}
            />
          ))}
        </>
      )}

      {/* Add entry modal */}
      {addForm && (
        <AddEntryModal
          week={addForm.week}
          dayOfWeek={addForm.dayOfWeek}
          defaultEmployee={addForm.employeeId}
          users={deptUsers}
          onAdd={handleAddEntry}
          onClose={() => setAddForm(null)}
        />
      )}

      {/* Apply modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <RefreshCw className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Apply to Annual Schedule</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                This will generate shifts on the main schedule based on the 2-week rotating template, starting from{' '}
                <strong>{schedule && format(parseISO(schedule.anchorDate), 'MMMM d, yyyy')}</strong> for 52 weeks (364 days).
              </p>
              <label className="flex items-start gap-3 cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Replace existing shifts in range</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    If unchecked, only days with no existing shift will be filled. If checked, all shifts in the range created by you will be replaced.
                  </p>
                </div>
              </label>
              {applyError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {applyError}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {applying ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      Applying...
                    </>
                  ) : (
                    'Apply Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MANAGER_ROLES_MS = ['admin', 'manager', 'charge_nurse'];
const MANAGER_POSITIONS_MS = ['Manager', 'Charge Nurse', 'Supervisor', 'Director'];

function WeekStaffGrid({ week, users, entries, canManage, onAdd, onRemove }) {
  const employees = users.filter((u) => u.role !== 'admin' || users.length <= 3);

  const positionGroups = [...employees]
    .sort((a, b) => {
      const aM = MANAGER_ROLES_MS.includes(a.role);
      const bM = MANAGER_ROLES_MS.includes(b.role);
      if (aM !== bM) return aM ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .reduce((acc, emp) => {
      const pos = emp.position || 'Unassigned';
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(emp);
      return acc;
    }, {});

  const sortedPositions = Object.keys(positionGroups).sort((a, b) => {
    const aM = MANAGER_POSITIONS_MS.includes(a);
    const bM = MANAGER_POSITIONS_MS.includes(b);
    if (aM !== bM) return aM ? -1 : 1;
    return a.localeCompare(b);
  });

  const getEntriesFor = (empId, dayOfWeek) =>
    entries.filter((e) => e.week === week && e.dayOfWeek === dayOfWeek && (e.employee?._id || e.employee) === empId);

  const countWorking = (posEmps, dayOfWeek) =>
    posEmps.filter((emp) => getEntriesFor(emp._id, dayOfWeek).length > 0).length;

  const empHoursInWeek = (emp) =>
    entries
      .filter((e) => e.week === week && (e.employee?._id || e.employee) === emp._id)
      .reduce((acc, e) => {
        const [sh, sm] = e.startTime.split(':').map(Number);
        const [eh, em] = e.endTime.split(':').map(Number);
        return acc + (eh * 60 + em - (sh * 60 + sm)) / 60;
      }, 0);

  const STAFF_COL = 140;
  const DAY_COL = 120;
  const totalW = STAFF_COL + 7 * DAY_COL;
  const gridTemplate = `${STAFF_COL}px repeat(7, ${DAY_COL}px)`;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-3">
        <h2 className="font-semibold text-base">Week {week}</h2>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${totalW}px` }}>

          {/* Header row */}
          <div className="grid border-b border-gray-200 sticky top-0 z-10 bg-gray-50" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="p-2 border-r border-gray-200 text-xs font-semibold text-gray-500 uppercase sticky left-0 z-20 bg-gray-50">Staff</div>
            {DAY_NAMES.map((d, i) => (
              <div key={i} className="text-center border-r border-gray-100 last:border-r-0 py-2 px-1">
                <p className="text-xs font-semibold text-gray-600">{d}</p>
              </div>
            ))}
          </div>

          {/* Position groups */}
          {employees.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No staff found</div>
          ) : (
            sortedPositions.map((position) => {
              const posEmps = positionGroups[position];
              return (
                <div key={position}>
                  {/* Position header */}
                  <div className="grid bg-gray-100 border-b border-gray-200" style={{ gridTemplateColumns: gridTemplate }}>
                    <div className="px-2 py-1.5 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-gray-100">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">{position}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1 py-0.5 rounded-full flex-shrink-0">{posEmps.length}</span>
                    </div>
                    {DAY_NAMES.map((_, i) => {
                      const working = countWorking(posEmps, i);
                      return (
                        <div key={i} className="border-r border-gray-200 last:border-r-0 flex items-center justify-center py-1">
                          {working > 0 && (
                            <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1 py-0.5 rounded-full">{working}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Employee rows */}
                  {posEmps.map((emp) => (
                    <div key={emp._id} className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/30 transition-colors" style={{ gridTemplateColumns: gridTemplate }}>
                      {/* Staff name cell */}
                      <div className="p-2 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-white">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: emp.color || '#3B82F6' }}>
                          {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{emp.name}</p>
                          <p className="text-[9px] text-blue-600">{empHoursInWeek(emp).toFixed(0)}h</p>
                        </div>
                      </div>

                      {/* Day cells */}
                      {DAY_NAMES.map((_, dayOfWeek) => {
                        const cellEntries = getEntriesFor(emp._id, dayOfWeek);
                        return (
                          <div key={dayOfWeek} className="border-r border-gray-100 last:border-r-0 p-1 align-top min-h-[52px]">
                            <div className="space-y-0.5">
                              {cellEntries.map((entry) => (
                                <ShiftChip
                                  key={entry._id}
                                  entry={entry}
                                  canManage={canManage}
                                  onRemove={() => onRemove(entry._id)}
                                  empColor={emp.color}
                                />
                              ))}
                            </div>
                            {canManage && (
                              <button
                                onClick={() => onAdd(dayOfWeek, emp._id)}
                                className="mt-0.5 w-full text-[9px] text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded py-0.5 flex items-center justify-center gap-0.5 border border-dashed border-blue-100 hover:border-blue-300 transition-colors"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftChip({ entry, canManage, onRemove, empColor }) {
  const color = empColor || entry.employee?.color || '#3B82F6';

  return (
    <div
      className="relative group text-[9px] px-1 py-0.5 rounded truncate leading-tight border"
      style={{ backgroundColor: color + '25', borderColor: color + '80', color }}
      title={`${entry.startTime}–${entry.endTime}${entry.position ? ` · ${entry.position}` : ''}`}
    >
      <span className="font-semibold">{entry.startTime}–{entry.endTime}</span>
      {canManage && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0.5 top-0.5"
          title="Remove"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function AddEntryModal({ week, dayOfWeek, defaultEmployee, users, onAdd, onClose }) {
  const [form, setForm] = useState({
    employee: defaultEmployee || '',
    startTime: '08:00',
    endTime: '16:00',
    position: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const employees = users.filter((u) => u.role !== 'admin');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employee) return;
    setSaving(true);
    await onAdd({ week, dayOfWeek, ...form });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Add Shift — Week {week}, {DAY_FULL[dayOfWeek]}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Staff Member *</label>
              <select
                value={form.employee}
                onChange={(e) => setForm({ ...form, employee: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select staff member</option>
                {employees.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}{u.position ? ` — ${u.position}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time *</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Time *</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. RN, CNA"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Shift'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
