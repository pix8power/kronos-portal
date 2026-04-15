import { useState, useEffect } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isToday,
  isSameMonth,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { schedulesAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ShiftModal from '../components/schedule/ShiftModal';

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const VIEW_MODES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: '2months', label: '2 Months' },
];

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Monthly calendar grid for one month ──────────────────────────────────────
function MonthGrid({ month, shifts, employees, approvedTimeOff, availability, filterEmployee, isAdmin, user, onAddShift, onEditShift, onToggleAvailability, compact }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getShiftsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return shifts.filter((s) => {
      const empMatch = !filterEmployee || (s.employee?._id || s.employee) === filterEmployee;
      return s.date === dateStr && empMatch;
    });
  };

  const getTimeOffForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (approvedTimeOff || []).filter((to) => {
      const empMatch = !filterEmployee || (to.employee?._id || to.employee) === filterEmployee;
      return empMatch && to.startDate <= dateStr && dateStr <= to.endDate;
    });
  };

  const getAvailabilityForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (availability || []).filter((a) => {
      const empMatch = !filterEmployee || (a.employee?._id || a.employee) === filterEmployee;
      return a.date === dateStr && empMatch;
    });
  };

  const myAvailabilityForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (availability || []).find(
      (a) => a.date === dateStr && (a.employee?._id || a.employee) === user?._id
    );
  };

  const maxVisible = compact ? 2 : 3;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Month title */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="font-bold text-gray-800 text-base">{format(month, 'MMMM yyyy')}</p>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {compact ? d.slice(0, 1) : d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const dayShifts      = getShiftsForDay(day);
          const dayTimeOff     = getTimeOffForDay(day);
          const dayAvailability = getAvailabilityForDay(day);
          const myAvail        = myAvailabilityForDay(day);
          const extra = dayShifts.length - maxVisible;

          return (
            <div
              key={day.toString()}
              className={`min-h-[${compact ? '72' : '90'}px] p-1 relative group ${
                !inMonth ? 'bg-gray-50/60' : today ? 'bg-blue-50/40' : ''
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    today
                      ? 'bg-blue-600 text-white'
                      : inMonth
                      ? 'text-gray-800'
                      : 'text-gray-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAdmin && inMonth && (
                    <button
                      onClick={() => onAddShift(format(day, 'yyyy-MM-dd'))}
                      className="text-gray-300 hover:text-blue-500 text-sm leading-none px-0.5"
                      title="Add shift"
                    >
                      +
                    </button>
                  )}
                  {!isAdmin && inMonth && !myAvail && (
                    <button
                      onClick={() => onToggleAvailability(format(day, 'yyyy-MM-dd'), null)}
                      className="text-gray-300 hover:text-green-500 text-sm leading-none px-0.5"
                      title="Mark available"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>

              {/* Availability pills */}
              {dayAvailability.map((a) => (
                <div
                  key={a._id}
                  onClick={() => (a.employee?._id || a.employee) === user?._id
                    ? onToggleAvailability(a.date, a._id)
                    : undefined}
                  className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate border bg-green-100 text-green-800 border-green-300 ${
                    (a.employee?._id || a.employee) === user?._id ? 'cursor-pointer hover:opacity-75' : ''
                  }`}
                  title={`${a.employee?.name} — Available${(a.employee?._id || a.employee) === user?._id ? ' (click to remove)' : ''}`}
                >
                  ✓ {compact ? a.employee?.name?.split(' ')[0] : `${a.employee?.name?.split(' ')[0]} Available`}
                </div>
              ))}

              {/* Time off pills */}
              {dayTimeOff.map((to) => (
                <div
                  key={to._id}
                  className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate border bg-amber-100 text-amber-800 border-amber-300"
                  title={`${to.employee?.name} — Time Off`}
                >
                  🏖 {compact ? to.employee?.name?.split(' ')[0] : `${to.employee?.name?.split(' ')[0]} Off`}
                </div>
              ))}

              {/* Shift pills */}
              {dayShifts.slice(0, maxVisible).map((shift) => {
                const emp = employees.find(
                  (e) => e._id === (shift.employee?._id || shift.employee)
                );
                return (
                  <div
                    key={shift._id}
                    onClick={() => isAdmin && onEditShift(shift)}
                    className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-75 border ${
                      STATUS_COLORS[shift.status] || STATUS_COLORS.scheduled
                    }`}
                    title={`${emp?.name} ${shift.startTime}–${shift.endTime}`}
                  >
                    {compact ? (
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: emp?.color || '#3B82F6' }}
                      />
                    ) : null}
                    {compact
                      ? emp?.name?.split(' ')[0]
                      : `${emp?.name?.split(' ')[0]} ${shift.startTime}`}
                  </div>
                );
              })}
              {extra > 0 && (
                <p className="text-xs text-gray-400 pl-0.5">+{extra} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Schedule page ────────────────────────────────────────────────────────
export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [viewMode, setViewMode] = useState('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [approvedTimeOff, setApprovedTimeOff] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  // Compute the fetch range for the current view
  const getRange = () => {
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    if (viewMode === 'monthly') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return {
        start: startOfWeek(ms, { weekStartsOn: 1 }),
        end: endOfWeek(me, { weekStartsOn: 1 }),
      };
    }
    // 2months
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(addMonths(currentDate, 1));
    return {
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    };
  };

  const goBack = () => {
    if (viewMode === 'weekly') setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === 'monthly') setCurrentDate((d) => subMonths(d, 1));
    else setCurrentDate((d) => subMonths(d, 2));
  };

  const goForward = () => {
    if (viewMode === 'weekly') setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === 'monthly') setCurrentDate((d) => addMonths(d, 1));
    else setCurrentDate((d) => addMonths(d, 2));
  };

  const getTitle = () => {
    if (viewMode === 'weekly') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    if (viewMode === 'monthly') return format(currentDate, 'MMMM yyyy');
    return `${format(currentDate, 'MMMM')} – ${format(addMonths(currentDate, 1), 'MMMM yyyy')}`;
  };

  useEffect(() => {
    setLoading(true);
    const { start, end } = getRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr   = format(end,   'yyyy-MM-dd');
    Promise.all([
      schedulesAPI.getShifts({ startDate: startStr, endDate: endStr }),
      usersAPI.getAll(),
      schedulesAPI.getTimeOff({ status: 'approved', startDate: startStr, endDate: endStr }),
      schedulesAPI.getAvailability({ startDate: startStr, endDate: endStr }),
    ])
      .then(([shiftsRes, empRes, toRes, availRes]) => {
        setShifts(shiftsRes.data);
        setEmployees(empRes.data);
        setApprovedTimeOff(toRes.data);
        setAvailability(availRes.data);
      })
      .finally(() => setLoading(false));
  }, [currentDate, viewMode]);

  // ── Weekly view helpers ────────────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredShifts = filterEmployee
    ? shifts.filter((s) => (s.employee?._id || s.employee) === filterEmployee)
    : shifts;

  const getShiftsForCell = (employeeId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filteredShifts.filter(
      (s) => (s.employee?._id || s.employee) === employeeId && s.date === dateStr
    );
  };

  const displayedEmployees = filterEmployee
    ? employees.filter((e) => e._id === filterEmployee)
    : employees;

  // Group displayed employees by position, sorted alphabetically
  const positionGroups = [...displayedEmployees]
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce((acc, emp) => {
      const pos = emp.position || 'Unassigned';
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(emp);
      return acc;
    }, {});
  const sortedPositions = Object.keys(positionGroups).sort();

  // Get approved time off record for an employee on a given day (if any)
  const getTimeOff = (empId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return approvedTimeOff.find(
      (to) =>
        (to.employee?._id || to.employee) === empId &&
        to.startDate <= dateStr &&
        dateStr <= to.endDate
    );
  };

  // Count employees in a position group who have ≥1 shift on a given day
  const countWorking = (posEmps, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return posEmps.filter((emp) =>
      filteredShifts.some(
        (s) => (s.employee?._id || s.employee) === emp._id && s.date === dateStr
      )
    ).length;
  };

  const totalHours = (emp) => {
    const empShifts = shifts.filter((s) => (s.employee?._id || s.employee) === emp._id);
    return empShifts.reduce((acc, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return acc + (eh * 60 + em - (sh * 60 + sm)) / 60;
    }, 0);
  };

  // Get availability record for a specific employee on a day
  const getAvailabilityForCell = (empId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return availability.find(
      (a) => (a.employee?._id || a.employee) === empId && a.date === dateStr
    );
  };

  // Toggle availability for the current user (add or remove)
  const handleToggleAvailability = async (date, existingId) => {
    if (existingId) {
      // Remove
      try {
        await schedulesAPI.removeAvailability(existingId);
        setAvailability((prev) => prev.filter((a) => a._id !== existingId));
      } catch (err) {
        console.error(err);
      }
    } else {
      // Add
      try {
        const res = await schedulesAPI.addAvailability({ date });
        setAvailability((prev) => [...prev, res.data]);
      } catch (err) {
        if (err.response?.status !== 409) console.error(err);
      }
    }
  };

  // ── Modal handlers ─────────────────────────────────────────────────────────
  const openAddShift = (date) => {
    setSelectedDate(date);
    setSelectedShift(null);
    setShowModal(true);
  };

  const openEditShift = (shift) => {
    setSelectedShift(shift);
    setSelectedDate(shift.date);
    setShowModal(true);
  };

  const handleShiftSave = (savedShift, isUpdate, isDelete) => {
    if (isDelete) {
      setShifts((prev) => prev.filter((s) => s._id !== savedShift._id));
    } else if (isUpdate) {
      setShifts((prev) => prev.map((s) => (s._id === savedShift._id ? savedShift : s)));
    } else {
      setShifts((prev) => [...prev, savedShift]);
    }
    setShowModal(false);
    setSelectedShift(null);
  };

  return (
    <div className="p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Schedule
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{getTitle()}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {VIEW_MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setViewMode(key); setCurrentDate(new Date()); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Employee filter */}
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Staff</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name}
              </option>
            ))}
          </select>

          {/* Navigation */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
            <button onClick={goBack} className="p-2 hover:bg-gray-50 rounded-l-lg">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
            <button onClick={goForward} className="p-2 hover:bg-gray-50 rounded-r-lg">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => openAddShift(format(new Date(), 'yyyy-MM-dd'))}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Shift
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* ── Weekly view ── */}
          {viewMode === 'weekly' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                <div className="p-3 border-r border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Staff</p>
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.toString()}
                    className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${
                      isToday(day) ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    <p className={`text-xs font-semibold uppercase ${isToday(day) ? 'text-blue-600' : 'text-gray-500'}`}>
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-lg font-bold mt-0.5 ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                      {format(day, 'd')}
                    </p>
                  </div>
                ))}
              </div>

              {displayedEmployees.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No staff found</div>
              ) : (
                sortedPositions.map((position) => {
                  const posEmps = positionGroups[position];
                  return (
                    <div key={position}>
                      {/* ── Position group header ── */}
                      <div
                        className="grid bg-gray-100 border-b border-gray-200"
                        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
                      >
                        <div className="px-3 py-2 border-r border-gray-200 flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">
                            {position}
                          </span>
                          <span className="ml-1 text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {posEmps.length}
                          </span>
                        </div>
                        {weekDays.map((day) => {
                          const working = countWorking(posEmps, day);
                          return (
                            <div
                              key={day.toString()}
                              className={`px-2 py-2 border-r border-gray-200 last:border-r-0 flex items-center justify-center ${
                                isToday(day) ? 'bg-blue-50' : ''
                              }`}
                            >
                              {working > 0 ? (
                                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                  {working} working
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Employee rows within this position ── */}
                      {posEmps.map((emp) => (
                        <div
                          key={emp._id}
                          className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                          style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
                        >
                          <div className="p-3 border-r border-gray-200 flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: emp.color }}
                            >
                              {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                              <p className="text-xs text-blue-600">{totalHours(emp).toFixed(1)}h/wk</p>
                            </div>
                          </div>
                          {weekDays.map((day) => {
                            const cellShifts  = getShiftsForCell(emp._id, day);
                            const timeOff     = getTimeOff(emp._id, day);
                            const avail       = getAvailabilityForCell(emp._id, day);
                            const isOwnRow    = emp._id === user?._id;
                            return (
                              <div
                                key={day.toString()}
                                className={`p-1.5 border-r border-gray-100 last:border-r-0 min-h-[80px] ${
                                  timeOff ? 'bg-amber-50/60' : avail ? 'bg-green-50/40' : isToday(day) ? 'bg-blue-50/50' : ''
                                }`}
                              >
                                {timeOff && (
                                  <div className="text-xs p-1.5 rounded-md border border-amber-300 bg-amber-100 text-amber-800 mb-1">
                                    <p className="font-semibold truncate">🏖 Time Off</p>
                                    <p className="truncate opacity-80 capitalize">{timeOff.type === 'vacation' ? 'Vacation/PTO' : timeOff.type === 'educational' ? 'Educational' : timeOff.type === 'bereavement' ? 'Bereavement' : 'Other'}</p>
                                  </div>
                                )}
                                {avail && (
                                  <div
                                    onClick={isOwnRow ? () => handleToggleAvailability(avail.date, avail._id) : undefined}
                                    className={`text-xs p-1.5 rounded-md border border-green-300 bg-green-100 text-green-800 mb-1 ${isOwnRow ? 'cursor-pointer hover:opacity-75' : ''}`}
                                    title={isOwnRow ? 'Click to remove availability' : 'Available'}
                                  >
                                    <p className="font-semibold">✓ Available</p>
                                  </div>
                                )}
                                {!timeOff && cellShifts.map((shift) => (
                                  <div
                                    key={shift._id}
                                    onClick={() => isAdmin && openEditShift(shift)}
                                    className={`text-xs p-1.5 rounded-md border mb-1 cursor-pointer hover:opacity-80 transition-opacity ${
                                      STATUS_COLORS[shift.status] || STATUS_COLORS.scheduled
                                    }`}
                                  >
                                    <p className="font-semibold">{shift.startTime}–{shift.endTime}</p>
                                  </div>
                                ))}
                                {!timeOff && !avail && isOwnRow && (
                                  <button
                                    onClick={() => handleToggleAvailability(format(day, 'yyyy-MM-dd'), null)}
                                    className="w-full text-xs text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-md py-1 transition-colors"
                                    title="Mark available"
                                  >
                                    ✓
                                  </button>
                                )}
                                {!timeOff && isAdmin && (
                                  <button
                                    onClick={() => openAddShift(format(day, 'yyyy-MM-dd'))}
                                    className="w-full text-xs text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-md py-1 transition-colors"
                                  >
                                    +
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
          )}

          {/* ── Monthly view ── */}
          {viewMode === 'monthly' && (
            <MonthGrid
              month={currentDate}
              shifts={filteredShifts}
              employees={employees}
              approvedTimeOff={approvedTimeOff}
              availability={availability}
              filterEmployee={filterEmployee}
              isAdmin={isAdmin}
              user={user}
              onAddShift={openAddShift}
              onEditShift={openEditShift}
              onToggleAvailability={handleToggleAvailability}
              compact={false}
            />
          )}

          {/* ── 2-Month view ── */}
          {viewMode === '2months' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <MonthGrid
                month={currentDate}
                shifts={filteredShifts}
                employees={employees}
                approvedTimeOff={approvedTimeOff}
                availability={availability}
                filterEmployee={filterEmployee}
                isAdmin={isAdmin}
                user={user}
                onAddShift={openAddShift}
                onEditShift={openEditShift}
                onToggleAvailability={handleToggleAvailability}
                compact={true}
              />
              <MonthGrid
                month={addMonths(currentDate, 1)}
                shifts={filteredShifts}
                employees={employees}
                approvedTimeOff={approvedTimeOff}
                availability={availability}
                filterEmployee={filterEmployee}
                isAdmin={isAdmin}
                user={user}
                onAddShift={openAddShift}
                onEditShift={openEditShift}
                onToggleAvailability={handleToggleAvailability}
                compact={true}
              />
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border ${cls}`} />
            <span className="text-xs text-gray-500 capitalize">{status}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border bg-amber-100 border-amber-300" />
          <span className="text-xs text-gray-500">Time Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border bg-green-100 border-green-300" />
          <span className="text-xs text-gray-500">Available</span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ShiftModal
          shift={selectedShift}
          employees={employees}
          defaultDate={selectedDate}
          onClose={() => { setShowModal(false); setSelectedShift(null); }}
          onSave={handleShiftSave}
        />
      )}
    </div>
  );
}
