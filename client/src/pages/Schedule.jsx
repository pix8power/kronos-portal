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
  addDays,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, Download, Copy, AlertTriangle, RefreshCw, BanIcon, X, MessageCircle, Check, XCircle, Clock, ZoomIn, ZoomOut } from 'lucide-react';
import { schedulesAPI, usersAPI, messagesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ShiftModal from '../components/schedule/ShiftModal';
import ChatWindow from '../components/messaging/ChatWindow';

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

// ── Holiday helpers ───────────────────────────────────────────────────────────
// Returns the nth (1-based) or last (-1) weekday of a given month
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const diff = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff);
}

function getHolidays(year) {
  const d = (date) => format(date, 'yyyy-MM-dd');
  return [
    { date: d(new Date(year, 0,  1)),                    name: "New Year's Day" },
    { date: d(nthWeekday(year, 0, 1, 3)),                name: 'MLK Day' },
    { date: d(nthWeekday(year, 1, 1, 3)),                name: "Presidents' Day" },
    { date: d(nthWeekday(year, 4, 1, -1)),               name: 'Memorial Day' },
    { date: d(new Date(year, 5, 19)),                    name: 'Juneteenth' },
    { date: d(new Date(year, 6,  4)),                    name: 'Independence Day' },
    { date: d(nthWeekday(year, 8, 1, 1)),                name: 'Labor Day' },
    { date: d(nthWeekday(year, 9, 1, 2)),                name: 'Columbus Day' },
    { date: d(new Date(year, 10, 11)),                   name: 'Veterans Day' },
    { date: d(nthWeekday(year, 10, 4, 4)),               name: 'Thanksgiving' },
    { date: d(new Date(year, 11, 24)),                   name: 'Christmas Eve' },
    { date: d(new Date(year, 11, 25)),                   name: 'Christmas Day' },
    { date: d(new Date(year, 11, 31)),                   name: "New Year's Eve" },
  ];
}

const VIEW_MODES = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: '2weeks',  label: '2 Weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: '2months', label: '2 Months' },
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Monthly calendar grid for one month ──────────────────────────────────────
function MonthGrid({ month, shifts, employees, approvedTimeOff, availability, holidays, filterEmployee, isAdmin, user, onAddShift, onEditShift, onToggleAvailability, compact }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
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

  const getHolidayForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (holidays || []).find((h) => h.date === dateStr) || null;
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
          const dayShifts       = getShiftsForDay(day);
          const dayTimeOff      = getTimeOffForDay(day);
          const dayAvailability = getAvailabilityForDay(day);
          const myAvail         = myAvailabilityForDay(day);
          const holiday         = inMonth ? getHolidayForDay(day) : null;
          const extra = dayShifts.length - maxVisible;

          return (
            <div
              key={day.toString()}
              className={`min-h-[${compact ? '72' : '90'}px] p-1 relative group ${
                !inMonth ? 'bg-gray-50/60' : holiday ? 'bg-purple-50/40' : today ? 'bg-blue-50/40' : ''
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

              {/* Holiday pill */}
              {holiday && (
                <div className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate border bg-purple-100 text-purple-800 border-purple-300 font-medium">
                  ★ {compact ? holiday.name.split(' ')[0] : holiday.name}
                </div>
              )}

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

// ── Mini month for year view ──────────────────────────────────────────────────

// ── Daily timeline view ───────────────────────────────────────────────────────
const DAY_START = 6;  // 06:00
const DAY_END   = 23; // 23:00
const HOUR_W    = 64; // px per hour

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function DailyView({ date, shifts, employees, approvedTimeOff, pendingTimeOff, availability, holidays, filterEmployee, isAdmin, canReview, user, onAddShift, onEditShift, onReviewTimeOff, onMessage, zoom = 1 }) {
  const dateStr    = format(date, 'yyyy-MM-dd');
  const holidayMap = Object.fromEntries((holidays || []).map((h) => [h.date, h.name]));
  const holiday    = holidayMap[dateStr];
  const HW         = Math.round(HOUR_W * zoom);
  const STAFF_COL  = 140;
  const totalW     = STAFF_COL + (DAY_END - DAY_START) * HW;
  const hours      = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  const displayedEmps = filterEmployee ? employees.filter((e) => e._id === filterEmployee) : employees;
  const MANAGER_ROLES = ['admin', 'manager'];
  const MANAGER_POS   = ['Manager'];

  const positionGroups = [...displayedEmps]
    .sort((a, b) => {
      const aM = MANAGER_ROLES.includes(a.role), bM = MANAGER_ROLES.includes(b.role);
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
    const aM = MANAGER_POS.includes(a), bM = MANAGER_POS.includes(b);
    if (aM !== bM) return aM ? -1 : 1;
    return a.localeCompare(b);
  });

  const getDayShifts = (empId) =>
    shifts.filter((s) => (s.employee?._id || s.employee) === empId && s.date === dateStr);

  const getTimeOff = (empId) =>
    (approvedTimeOff || []).find((t) => (t.employee?._id || t.employee) === empId && t.startDate <= dateStr && dateStr <= t.endDate);

  const getPending = (empId) =>
    canReview ? (pendingTimeOff || []).find((t) => (t.employee?._id || t.employee) === empId && t.startDate <= dateStr && dateStr <= t.endDate) : null;

  const getAvail = (empId) =>
    (availability || []).find((a) => (a.employee?._id || a.employee) === empId && a.date === dateStr);

  const shiftLeft  = (s) => Math.max(0, (toMinutes(s.startTime) - DAY_START * 60) / 60 * HW);
  const shiftWidth = (s) => Math.max(HW / 4, (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60 * HW);

  const STATUS_COLORS_DAY = {
    scheduled: { bg: '#DBEAFE', border: '#93C5FD', text: '#1E40AF' },
    confirmed:  { bg: '#DCFCE7', border: '#86EFAC', text: '#166534' },
    completed:  { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' },
    cancelled:  { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B' },
  };

  const ROW_H = Math.round(56 * zoom);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Date banner */}
      <div className={`px-4 py-3 border-b border-gray-200 flex items-center gap-3 ${holiday ? 'bg-purple-100' : isToday(date) ? 'bg-blue-50' : 'bg-gray-50'}`}>
        <div className="text-center">
          <p className={`text-xs font-semibold uppercase ${isToday(date) ? 'text-blue-500' : 'text-gray-500'}`}>{format(date, 'EEE')}</p>
          <p className={`text-3xl font-bold leading-none ${isToday(date) ? 'text-blue-600' : 'text-gray-900'}`}>{format(date, 'd')}</p>
          <p className={`text-xs font-medium ${isToday(date) ? 'text-blue-400' : 'text-gray-400'}`}>{format(date, 'MMMM yyyy')}</p>
        </div>
        {holiday && (
          <div className="flex items-center gap-1.5 bg-purple-200 text-purple-800 px-3 py-1.5 rounded-full text-sm font-semibold">
            ★ {holiday}
          </div>
        )}
        {isToday(date) && !holiday && (
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">Today</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${totalW}px` }}>
          {/* Hour header */}
          <div className="grid border-b border-gray-200 sticky top-0 z-10 bg-gray-50" style={{ gridTemplateColumns: `${STAFF_COL}px repeat(${hours.length}, ${HW}px)` }}>
            <div className="p-2 border-r border-gray-200 text-xs font-semibold text-gray-500 uppercase sticky left-0 z-20 bg-gray-50">Staff</div>
            {hours.map((h) => (
              <div key={h} className="border-r border-gray-100 last:border-r-0 px-1 py-1 text-center">
                <p className="text-[10px] font-semibold text-gray-400">{h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}</p>
              </div>
            ))}
          </div>

          {/* Position + employee rows */}
          {displayedEmps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No staff found</div>
          ) : sortedPositions.map((position) => {
            const posEmps = positionGroups[position];
            return (
              <div key={position}>
                {/* Position header */}
                <div className="grid bg-gray-100 border-b border-gray-200" style={{ gridTemplateColumns: `${STAFF_COL}px ${(DAY_END - DAY_START) * HW}px` }}>
                  <div className="px-2 py-1.5 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">{position}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1 py-0.5 rounded-full flex-shrink-0">{posEmps.length}</span>
                  </div>
                  <div className={`border-r border-gray-200 ${holiday ? 'bg-purple-200' : ''}`} />
                </div>

                {/* Employee rows */}
                {posEmps.map((emp) => {
                  const empShifts = getDayShifts(emp._id);
                  const timeOff   = getTimeOff(emp._id);
                  const pending   = getPending(emp._id);
                  const avail     = getAvail(emp._id);
                  const isOwn     = emp._id === user?._id;
                  return (
                    <div key={emp._id} className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 transition-colors group/emp" style={{ gridTemplateColumns: `${STAFF_COL}px ${(DAY_END - DAY_START) * HW}px` }}>
                      {/* Name cell */}
                      <div className="p-2 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-white group-hover/emp:bg-gray-50/40" style={{ minHeight: `${ROW_H}px` }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: emp.color }}>
                          {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{emp.name}</p>
                          {empShifts.length > 0 && (
                            <p className="text-[9px] text-blue-600">
                              {empShifts.reduce((acc, s) => acc + (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60, 0).toFixed(1)}h
                            </p>
                          )}
                        </div>
                        {emp._id !== user?._id && onMessage && (
                          <button
                            onClick={() => onMessage(emp)}
                            className="opacity-0 group-hover/emp:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                            title={`Message ${emp.name}`}
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Timeline cell */}
                      <div
                        className={`relative ${timeOff ? 'bg-amber-100' : pending ? 'bg-yellow-50' : holiday ? 'bg-purple-100' : avail ? 'bg-green-50/40' : ''}`}
                        style={{ minHeight: `${ROW_H}px` }}
                      >
                        {/* Hour grid lines */}
                        {hours.map((h, i) => (
                          <div key={h} className="absolute top-0 bottom-0 border-r border-gray-100" style={{ left: `${i * HW}px`, width: `${HW}px` }} />
                        ))}

                        {timeOff && (
                          <div
                            onClick={canReview && onReviewTimeOff ? () => onReviewTimeOff(timeOff, emp) : undefined}
                            className={`absolute inset-0 flex items-center justify-center gap-2 ${canReview ? 'cursor-pointer hover:bg-amber-200 transition-colors' : ''}`}
                          >
                            <span className="text-lg">🏖</span>
                            <span className="text-xs font-bold text-amber-800 uppercase">Time Off</span>
                          </div>
                        )}
                        {pending && (
                          <div
                            onClick={() => onReviewTimeOff && onReviewTimeOff(pending, emp)}
                            className="absolute inset-0 flex items-center justify-center gap-2 cursor-pointer hover:bg-yellow-100 transition-colors"
                          >
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs font-bold text-yellow-800 uppercase">Pending Time Off</span>
                          </div>
                        )}
                        {!timeOff && !pending && empShifts.map((shift) => {
                          const colors = STATUS_COLORS_DAY[shift.status] || STATUS_COLORS_DAY.scheduled;
                          return (
                            <div
                              key={shift._id}
                              onClick={() => isAdmin && onEditShift(shift)}
                              className="absolute top-1 rounded-md border px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                              style={{
                                left: `${shiftLeft(shift) + 2}px`,
                                width: `${shiftWidth(shift) - 4}px`,
                                bottom: '4px',
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                color: colors.text,
                              }}
                            >
                              <p className="text-[10px] font-bold leading-tight truncate">{shift.startTime}–{shift.endTime}</p>
                              <p className="text-[9px] leading-tight capitalize truncate opacity-80">{shift.status}</p>
                              {shift.notes?.startsWith('Time correction') && (
                                <span className="inline-block text-[8px] font-bold bg-orange-100 text-orange-700 border border-orange-300 px-1 rounded leading-tight mt-0.5">TC</span>
                              )}
                            </div>
                          );
                        })}
                        {!timeOff && !pending && avail && empShifts.length === 0 && (
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full">✓ Available</span>
                          </div>
                        )}
                        {isAdmin && !timeOff && !pending && (
                          <button
                            onClick={() => onAddShift(dateStr, emp._id)}
                            className="absolute bottom-1 right-1 opacity-0 group-hover/emp:opacity-100 text-gray-300 hover:text-blue-500 transition-all text-xs px-1"
                            title="Add shift"
                          >+</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Staff-row month grid (monthly / 2-month views) ────────────────────────────
const MANAGER_POSITIONS_GRID = ['Manager'];
const MANAGER_ROLES_GRID = ['admin', 'manager'];

function StaffMonthGrid({ days, shifts, employees, approvedTimeOff, pendingTimeOff, availability, holidays, filterEmployee, isAdmin, canReview, user, onAddShift, onEditShift, onReviewTimeOff, onMessage, onToggleAvailability, monthLabels, zoom = 1 }) {
  const holidayMap = Object.fromEntries((holidays || []).map((h) => [h.date, h.name]));

  const displayedEmps = filterEmployee ? employees.filter((e) => e._id === filterEmployee) : employees;

  const positionGroups = [...displayedEmps]
    .sort((a, b) => {
      const aM = MANAGER_ROLES_GRID.includes(a.role);
      const bM = MANAGER_ROLES_GRID.includes(b.role);
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
    const aM = MANAGER_POSITIONS_GRID.includes(a);
    const bM = MANAGER_POSITIONS_GRID.includes(b);
    if (aM !== bM) return aM ? -1 : 1;
    return a.localeCompare(b);
  });

  const getShiftsForCell = (empId, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return shifts.filter((s) => (s.employee?._id || s.employee) === empId && s.date === d);
  };

  const getTimeOff = (empId, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return (approvedTimeOff || []).find(
      (to) => (to.employee?._id || to.employee) === empId && to.startDate <= d && d <= to.endDate
    );
  };

  const getPendingCell = (empId, day) => {
    if (!canReview) return null;
    const d = format(day, 'yyyy-MM-dd');
    return (pendingTimeOff || []).find(
      (to) => (to.employee?._id || to.employee) === empId && to.startDate <= d && d <= to.endDate
    );
  };

  const countWorking = (posEmps, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return posEmps.filter((emp) =>
      shifts.some((s) => (s.employee?._id || s.employee) === emp._id && s.date === d)
    ).length;
  };

  const empHours = (emp) =>
    shifts
      .filter((s) => (s.employee?._id || s.employee) === emp._id)
      .reduce((acc, s) => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return acc + (eh * 60 + em - (sh * 60 + sm)) / 60;
      }, 0);

  // Find month boundaries to render month label separators
  const monthBoundaries = new Set();
  days.forEach((day, i) => {
    if (i === 0 || format(day, 'MM') !== format(days[i - 1], 'MM')) {
      monthBoundaries.add(i);
    }
  });

  const COL = Math.round(46 * zoom);
  const ROW_H = Math.round(52 * zoom);
  const STAFF_COL = 140;
  const totalW = STAFF_COL + days.length * COL;
  const gridTemplate = `${STAFF_COL}px repeat(${days.length}, ${COL}px)`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${totalW}px` }}>

          {/* Day header */}
          <div className="grid border-b border-gray-200 sticky top-0 z-10 bg-gray-50" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="p-2 border-r border-gray-200 text-xs font-semibold text-gray-500 uppercase sticky left-0 z-20 bg-gray-50">Staff</div>
            {days.map((day, i) => {
              const holiday = holidayMap[format(day, 'yyyy-MM-dd')];
              const today = isToday(day);
              const newMonth = monthBoundaries.has(i);
              return (
                <div
                  key={day.toString()}
                  className={`text-center border-r border-gray-100 last:border-r-0 py-1 px-0 relative ${
                    today ? 'bg-blue-50' : holiday ? 'bg-purple-100' : newMonth && i !== 0 ? 'bg-gray-100' : ''
                  }`}
                >
                  {newMonth && i !== 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300" />
                  )}
                  <p className={`text-[9px] font-semibold uppercase leading-none ${today ? 'text-blue-600' : 'text-gray-400'}`}>
                    {format(day, 'EEE')[0]}
                  </p>
                  <p className={`text-xs font-bold leading-tight ${today ? 'text-blue-600' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </p>
                  <p className={`text-[8px] leading-none font-semibold ${newMonth ? 'text-gray-600' : 'text-gray-400'}`}>
                    {format(day, 'MMM')}
                  </p>
                  {holiday && (
                    <p className="text-[7px] text-purple-600 font-semibold leading-tight px-0.5 truncate" title={holiday}>
                      {holiday}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Position groups + employee rows */}
          {displayedEmps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No staff found</div>
          ) : (
            sortedPositions.map((position) => {
              const posEmps = positionGroups[position];
              return (
                <div key={position}>
                  {/* Position header row */}
                  <div className="grid bg-gray-100 border-b border-gray-200" style={{ gridTemplateColumns: gridTemplate }}>
                    <div className="px-2 py-1.5 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-gray-100">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">{position}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1 py-0.5 rounded-full flex-shrink-0">{posEmps.length}</span>
                    </div>
                    {days.map((day, i) => {
                      const working = countWorking(posEmps, day);
                      const holiday = holidayMap[format(day, 'yyyy-MM-dd')];
                      const newMonth = monthBoundaries.has(i) && i !== 0;
                      return (
                        <div key={day.toString()} className={`border-r border-gray-200 last:border-r-0 flex items-center justify-center py-1 relative ${isToday(day) ? 'bg-blue-50' : holiday ? 'bg-purple-200' : ''}`}>
                          {newMonth && <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300" />}
                          {working > 0 && (
                            <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1 py-0.5 rounded-full">{working}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Employee rows */}
                  {posEmps.map((emp) => (
                    <div key={emp._id} className="grid border-b border-gray-100 last:border-b-0 hover:bg-gray-50/30 transition-colors group/emp" style={{ gridTemplateColumns: gridTemplate }}>
                      {/* Staff name cell */}
                      <div className="p-2 border-r border-gray-200 flex items-center gap-1.5 sticky left-0 z-10 bg-white">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: emp.color }}>
                          {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{emp.name}</p>
                          <p className="text-[9px] text-blue-600">{empHours(emp).toFixed(0)}h</p>
                        </div>
                        {emp._id !== user?._id && onMessage && (
                          <button
                            onClick={() => onMessage(emp)}
                            className="opacity-0 group-hover/emp:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                            title={`Message ${emp.name}`}
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Day cells */}
                      {days.map((day, i) => {
                        const cellShifts = getShiftsForCell(emp._id, day);
                        const timeOff = getTimeOff(emp._id, day);
                        const pendingCell = !timeOff ? getPendingCell(emp._id, day) : null;
                        const today = isToday(day);
                        const holiday = holidayMap[format(day, 'yyyy-MM-dd')];
                        const newMonth = monthBoundaries.has(i) && i !== 0;
                        return (
                          <div
                            key={day.toString()}
                            className={`border-r border-gray-100 last:border-r-0 p-0 relative overflow-hidden ${
                              timeOff ? 'bg-amber-100' : pendingCell ? 'bg-yellow-50' : today ? 'bg-blue-50/40' : holiday ? 'bg-purple-100' : ''
                            }`}
                            style={{ minHeight: `${ROW_H}px` }}
                          >
                            {newMonth && <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 z-10" />}
                            {timeOff && (
                              <div
                                onClick={canReview && onReviewTimeOff ? () => onReviewTimeOff(timeOff, emp) : undefined}
                                className={`flex flex-col items-center justify-center w-full h-full py-1 gap-px ${canReview ? 'cursor-pointer hover:bg-amber-200 transition-colors' : ''}`}
                                style={{ minHeight: `${ROW_H}px` }}
                                title={canReview ? 'Click to review' : `Time off: ${timeOff.type}`}
                              >
                                <span className="text-base leading-none">🏖</span>
                                <span className="text-[8px] font-bold text-amber-800 uppercase tracking-wide leading-none">OFF</span>
                              </div>
                            )}
                            {pendingCell && (
                              <div
                                onClick={() => onReviewTimeOff && onReviewTimeOff(pendingCell, emp)}
                                className="flex flex-col items-center justify-center w-full h-full py-1 gap-px cursor-pointer hover:bg-yellow-100 transition-colors"
                                style={{ minHeight: `${ROW_H}px` }}
                                title="Pending — click to review"
                              >
                                <Clock className="h-3 w-3 text-yellow-600" />
                                <span className="text-[8px] font-bold text-yellow-800 uppercase tracking-wide leading-none">PEND</span>
                              </div>
                            )}
                            {!timeOff && cellShifts.map((shift) => (
                              <div
                                key={shift._id}
                                onClick={() => isAdmin && onEditShift(shift)}
                                className="text-[9px] px-0.5 py-0.5 rounded mb-0.5 truncate leading-tight cursor-pointer hover:opacity-80 border"
                                style={{ backgroundColor: (emp.color || '#3B82F6') + '25', borderColor: (emp.color || '#3B82F6') + '80', color: emp.color || '#1d4ed8' }}
                                title={`${shift.startTime}–${shift.endTime}${shift.notes?.startsWith('Time correction') ? ' (TC)' : ''}`}
                              >
                                {shift.startTime}
                                {shift.notes?.startsWith('Time correction') && (
                                  <span className="ml-0.5 text-[7px] font-bold text-orange-600">TC</span>
                                )}
                              </div>
                            ))}
                            {/* Availability marker — own row only */}
                            {emp._id === user?._id && !timeOff && (() => {
                              const d = format(day, 'yyyy-MM-dd');
                              const avail = (availability || []).find((a) => a.date === d);
                              if (avail) {
                                return (
                                  <div
                                    onTouchEnd={(e) => { e.preventDefault(); onToggleAvailability && onToggleAvailability(d, avail._id); }}
                                    onClick={() => onToggleAvailability && onToggleAvailability(d, avail._id)}
                                    className="text-[8px] font-bold text-green-700 bg-green-100 px-0.5 py-px rounded leading-tight cursor-pointer hover:bg-green-200 transition-colors text-center mt-0.5"
                                    title="Available — click to remove"
                                  >✓</div>
                                );
                              }
                              if (onToggleAvailability) {
                                return (
                                  <button
                                    onTouchEnd={(e) => { e.preventDefault(); onToggleAvailability(d, null); }}
                                    onClick={() => onToggleAvailability(d, null)}
                                    className="opacity-0 group-hover/emp:opacity-100 transition-opacity text-green-300 hover:text-green-500 text-xs w-full text-center mt-0.5 block"
                                    title="Mark available"
                                  >✓</button>
                                );
                              }
                              return null;
                            })()}
                            {isAdmin && cellShifts.length === 0 && !timeOff && (
                              <button
                                onClick={() => onAddShift(format(day, 'yyyy-MM-dd'), emp._id)}
                                className="w-full h-full flex items-center justify-center text-gray-200 hover:text-blue-400 opacity-0 hover:opacity-100 transition-opacity text-xs absolute inset-0"
                                title="Add shift"
                              >+</button>
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

// ── Main Schedule page ────────────────────────────────────────────────────────
export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [chatOpen, setChatOpen] = useState(false);
  const [chatConversation, setChatConversation] = useState(null);

  const handleMessageStaff = async (emp) => {
    try {
      const res = await messagesAPI.createDirect(emp._id);
      setChatConversation(res.data);
      setChatOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const [viewMode, setViewMode] = useState('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [approvedTimeOff, setApprovedTimeOff] = useState([]);
  const [pendingTimeOff, setPendingTimeOff] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [showUnavailModal, setShowUnavailModal] = useState(false);
  const [recurringUnavail, setRecurringUnavail] = useState([]);
  const [unavailLoading, setUnavailLoading] = useState(false);
  const [reviewingTimeOff, setReviewingTimeOff] = useState(null); // { request, empName }
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(3); // 1–5

  const CAN_REVIEW = ['admin', 'manager', 'charge_nurse'].includes(user?.role);

  const ZOOM_FACTORS = [0.6, 0.75, 1.0, 1.3, 1.6];
  const zoom = ZOOM_FACTORS[zoomLevel - 1];

  useEffect(() => {
    if (!isAdmin) {
      schedulesAPI.getRecurringUnavailability()
        .then((res) => setRecurringUnavail(res.data || []))
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleToggleUnavailDay = async (dayOfWeek) => {
    const existing = recurringUnavail.find((r) => r.dayOfWeek === dayOfWeek);
    setUnavailLoading(true);
    try {
      if (existing) {
        await schedulesAPI.removeRecurringUnavailability(existing._id);
        setRecurringUnavail((prev) => prev.filter((r) => r._id !== existing._id));
      } else {
        const res = await schedulesAPI.addRecurringUnavailability({ dayOfWeek });
        setRecurringUnavail((prev) => [...prev, res.data]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnavailLoading(false);
    }
  };

  // Compute the fetch range for the current view
  const getRange = () => {
    if (viewMode === 'daily') {
      return { start: currentDate, end: currentDate };
    }
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    if (viewMode === '2weeks') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start: ws, end: addDays(ws, 13) };
    }
    if (viewMode === 'monthly') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return {
        start: startOfWeek(ms, { weekStartsOn: 0 }),
        end: endOfWeek(me, { weekStartsOn: 0 }),
      };
    }
    // 2months
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(addMonths(currentDate, 1));
    return {
      start: startOfWeek(ms, { weekStartsOn: 0 }),
      end: endOfWeek(me, { weekStartsOn: 0 }),
    };
  };

  const goBack = () => {
    if (viewMode === 'daily')        setCurrentDate((d) => addDays(d, -1));
    else if (viewMode === 'weekly')  setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === '2weeks')  setCurrentDate((d) => subWeeks(d, 2));
    else if (viewMode === 'monthly') setCurrentDate((d) => subMonths(d, 1));
    else setCurrentDate((d) => subMonths(d, 2));
  };

  const goForward = () => {
    if (viewMode === 'daily')        setCurrentDate((d) => addDays(d, 1));
    else if (viewMode === 'weekly')  setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === '2weeks')  setCurrentDate((d) => addWeeks(d, 2));
    else if (viewMode === 'monthly') setCurrentDate((d) => addMonths(d, 1));
    else setCurrentDate((d) => addMonths(d, 2));
  };

  const getTitle = () => {
    if (viewMode === 'daily') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'weekly') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    if (viewMode === '2weeks') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = addDays(ws, 13);
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
      CAN_REVIEW
        ? schedulesAPI.getTimeOff({ status: 'pending', startDate: startStr, endDate: endStr })
        : Promise.resolve({ data: [] }),
    ])
      .then(([shiftsRes, empRes, toRes, availRes, pendingRes]) => {
        setShifts(shiftsRes.data);
        setEmployees(empRes.data);
        setApprovedTimeOff(toRes.data);
        setAvailability(availRes.data);
        setPendingTimeOff(pendingRes.data);
      })
      .finally(() => setLoading(false));
  }, [currentDate, viewMode]);

  // ── Re-fetch approved time off when user returns to this tab ────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const { start, end } = getRange();
        const s = format(start, 'yyyy-MM-dd');
        const e = format(end, 'yyyy-MM-dd');
        schedulesAPI.getTimeOff({ status: 'approved', startDate: s, endDate: e })
          .then((res) => setApprovedTimeOff(res.data)).catch(() => {});
        if (CAN_REVIEW) {
          schedulesAPI.getTimeOff({ status: 'pending', startDate: s, endDate: e })
            .then((res) => setPendingTimeOff(res.data)).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentDate, viewMode]);

  // ── Holidays (covers current + adjacent year for cross-year views) ────────
  const currentYear = currentDate.getFullYear();
  const holidays = [
    ...getHolidays(currentYear - 1),
    ...getHolidays(currentYear),
    ...getHolidays(currentYear + 1),
  ];
  const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h.name]));

  // ── Weekly view helpers ────────────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
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

  // Group displayed employees by position
  // Manager position and manager-role users always sort to the top
  const MANAGER_POSITIONS = ['Manager'];
  const MANAGER_ROLES = ['admin', 'manager'];

  const positionGroups = [...displayedEmployees]
    .sort((a, b) => {
      // Manager role always before non-manager within the same position group
      const aIsManager = MANAGER_ROLES.includes(a.role);
      const bIsManager = MANAGER_ROLES.includes(b.role);
      if (aIsManager !== bIsManager) return aIsManager ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .reduce((acc, emp) => {
      const pos = emp.position || 'Unassigned';
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(emp);
      return acc;
    }, {});

  const sortedPositions = Object.keys(positionGroups).sort((a, b) => {
    const aIsManager = MANAGER_POSITIONS.includes(a);
    const bIsManager = MANAGER_POSITIONS.includes(b);
    if (aIsManager !== bIsManager) return aIsManager ? -1 : 1;
    return a.localeCompare(b);
  });

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

  // Get pending time off record for an employee on a given day (if any)
  const getPendingTimeOff = (empId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return pendingTimeOff.find(
      (to) =>
        (to.employee?._id || to.employee) === empId &&
        to.startDate <= dateStr &&
        dateStr <= to.endDate
    );
  };

  const openTimeOffReview = (request, emp) => {
    setReviewingTimeOff({ request, empName: emp?.name || 'Employee' });
    setReviewNote('');
  };

  const handleReviewTimeOff = async (newStatus) => {
    if (!reviewingTimeOff) return;
    setReviewLoading(true);
    try {
      const res = await schedulesAPI.reviewTimeOff(reviewingTimeOff.request._id, { status: newStatus, reviewNote });
      const updated = res.data;
      if (newStatus === 'approved') {
        setApprovedTimeOff((prev) => [...prev, updated]);
      }
      setPendingTimeOff((prev) => prev.filter((t) => t._id !== updated._id));
      if (newStatus === 'denied') {
        setApprovedTimeOff((prev) => prev.filter((t) => t._id !== updated._id));
      }
      setReviewingTimeOff(null);
    } catch (err) {
      console.error(err);
    } finally {
      setReviewLoading(false);
    }
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


  // ── Export schedule to PDF ────────────────────────────────────────────────
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Schedule — ${getTitle()}`, 14, 15);

    const tableData = [];
    sortedPositions.forEach((pos) => {
      positionGroups[pos].forEach((emp) => {
        const empShifts = filteredShifts.filter((s) => (s.employee?._id || s.employee) === emp._id);
        if (viewMode === 'weekly') {
          const row = [emp.name, emp.position || ''];
          weekDays.forEach((day) => {
            const ds = format(day, 'yyyy-MM-dd');
            const s = empShifts.find((sh) => sh.date === ds);
            row.push(s ? `${s.startTime}–${s.endTime}` : '');
          });
          tableData.push(row);
        } else {
          empShifts.forEach((s) => {
            tableData.push([emp.name, emp.position || '', s.date, `${s.startTime}–${s.endTime}`, s.notes || '']);
          });
        }
      });
    });

    const head = viewMode === 'weekly'
      ? [['Name', 'Position', ...weekDays.map((d) => format(d, 'EEE M/d'))]]
      : [['Name', 'Position', 'Date', 'Time', 'Notes']];

    autoTable(doc, { head, body: tableData, startY: 22, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
    doc.save(`schedule-${getTitle().replace(/[^a-z0-9]/gi, '-')}.pdf`);
  };

  // ── Copy this week → next week ────────────────────────────────────────────
  const [copying, setCopying] = useState(false);
  const handleCopyWeek = async () => {
    if (viewMode !== 'weekly') return;
    if (!window.confirm('Copy all shifts from this week to next week? Conflicts will be skipped.')) return;
    setCopying(true);
    try {
      const toCreate = filteredShifts.map((s) => ({
        employee: s.employee?._id || s.employee,
        date: format(addDays(parseISO(s.date), 7), 'yyyy-MM-dd'),
        startTime: s.startTime,
        endTime: s.endTime,
        position: s.position,
        department: s.department,
        notes: s.notes,
      }));
      const res = await schedulesAPI.createShiftsBulk({ shifts: toCreate });
      setShifts((prev) => [...prev, ...res.data.created]);
      const msg = `Copied ${res.data.created.length} shifts. ${res.data.skipped.length} skipped (conflicts).`;
      alert(msg);
    } catch (err) {
      alert(err.response?.data?.message || 'Copy failed');
    } finally {
      setCopying(false);
    }
  };

  // ── Modal handlers ─────────────────────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const openAddShift = (date, empId = '') => {
    setSelectedDate(date);
    setSelectedShift(null);
    setSelectedEmployee(empId);
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
            {[...employees].sort((a, b) => {
              if (a._id === user?._id) return -1;
              if (b._id === user?._id) return 1;
              return a.name.localeCompare(b.name);
            }).map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp._id === user?._id ? `${emp.name} (Me)` : emp.name}
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

          {/* Zoom controls */}
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 1))}
              disabled={zoomLevel === 1}
              className="p-2 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4 text-gray-600" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-500 select-none border-x border-gray-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(5, z + 1))}
              disabled={zoomLevel === 5}
              className="p-2 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Export to PDF"
          >
            <Download className="h-4 w-4" />
            Export
          </button>


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

      {/* Recurring Unavailability Modal */}
      {showUnavailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">My Recurring Unavailability</h2>
              <button onClick={() => setShowUnavailModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">
                Toggle days you are <strong>never available</strong>. Managers will see these when scheduling.
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                  const isUnavail = recurringUnavail.some((r) => r.dayOfWeek === idx);
                  return (
                    <button
                      key={day}
                      onClick={() => handleToggleUnavailDay(idx)}
                      disabled={unavailLoading}
                      className={`flex flex-col items-center py-2 rounded-lg border-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        isUnavail
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {day}
                      {isUnavail && <span className="text-[9px] mt-0.5 opacity-80">Off</span>}
                    </button>
                  );
                })}
              </div>
              {recurringUnavail.length > 0 && (
                <p className="text-xs text-gray-400">
                  Unavailable: {recurringUnavail
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((r) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.dayOfWeek])
                    .join(', ')}
                </p>
              )}
              <button
                onClick={() => setShowUnavailModal(false)}
                className="w-full px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* ── Daily view ── */}
          {viewMode === 'daily' && (
            <DailyView
              date={currentDate}
              shifts={filteredShifts}
              employees={employees}
              approvedTimeOff={approvedTimeOff}
              pendingTimeOff={pendingTimeOff}
              availability={availability}
              holidays={holidays}
              filterEmployee={filterEmployee}
              isAdmin={isAdmin}
              canReview={CAN_REVIEW}
              user={user}
              onAddShift={openAddShift}
              onEditShift={openEditShift}
              onReviewTimeOff={openTimeOffReview}
              onMessage={handleMessageStaff}
              zoom={zoom}
            />
          )}

          {/* ── Weekly view ── */}
          {viewMode === 'weekly' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `140px repeat(7, minmax(${Math.round(90 * zoom)}px, 1fr))`, minWidth: `${140 + 7 * Math.round(90 * zoom)}px` }}>
                <div className="p-3 border-r border-gray-200 bg-gray-50 sticky left-0 z-20">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Staff</p>
                </div>
                {weekDays.map((day) => {
                  const dayHoliday = holidayMap[format(day, 'yyyy-MM-dd')];
                  return (
                    <div
                      key={day.toString()}
                      className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${
                        isToday(day) ? 'bg-blue-50' : dayHoliday ? 'bg-purple-100' : 'bg-gray-50'
                      }`}
                    >
                      <p className={`text-xs font-semibold uppercase ${isToday(day) ? 'text-blue-600' : 'text-gray-500'}`}>
                        {format(day, 'EEE')}
                      </p>
                      <p className={`text-lg font-bold mt-0.5 ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </p>
                      <p className={`text-[10px] font-medium ${isToday(day) ? 'text-blue-400' : 'text-gray-400'}`}>
                        {format(day, 'MMM')}
                      </p>
                      {dayHoliday && (
                        <p className="text-[10px] text-purple-600 font-semibold mt-0.5 leading-tight truncate" title={dayHoliday}>
                          ★ {dayHoliday}
                        </p>
                      )}
                    </div>
                  );
                })}
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
                        style={{ gridTemplateColumns: `140px repeat(7, minmax(${Math.round(90 * zoom)}px, 1fr))`, minWidth: `${140 + 7 * Math.round(90 * zoom)}px` }}
                      >
                        <div className="px-3 py-2 border-r border-gray-200 flex items-center gap-2 sticky left-0 z-10 bg-gray-100">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">
                            {position}
                          </span>
                          <span className="ml-1 text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {posEmps.length}
                          </span>
                        </div>
                        {weekDays.map((day) => {
                          const working = countWorking(posEmps, day);
                          const wkHoliday = holidayMap[format(day, 'yyyy-MM-dd')];
                          return (
                            <div
                              key={day.toString()}
                              className={`px-2 py-2 border-r border-gray-200 last:border-r-0 flex items-center justify-center ${
                                isToday(day) ? 'bg-blue-50' : wkHoliday ? 'bg-purple-200' : ''
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
                          style={{ gridTemplateColumns: `140px repeat(7, minmax(${Math.round(90 * zoom)}px, 1fr))`, minWidth: `${140 + 7 * Math.round(90 * zoom)}px` }}
                        >
                          <div className="p-3 border-r border-gray-200 flex items-center gap-2 group/emp sticky left-0 z-10 bg-white">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: emp.color }}
                            >
                              {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                              <p className="text-xs text-blue-600">{totalHours(emp).toFixed(1)}h/wk</p>
                            </div>
                            {emp._id !== user?._id && (
                              <button
                                onClick={() => handleMessageStaff(emp)}
                                className="opacity-0 group-hover/emp:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                                title={`Message ${emp.name}`}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {weekDays.map((day) => {
                            const cellShifts  = getShiftsForCell(emp._id, day);
                            const timeOff     = getTimeOff(emp._id, day);
                            const pendingTO   = !timeOff && CAN_REVIEW ? getPendingTimeOff(emp._id, day) : null;
                            const avail       = getAvailabilityForCell(emp._id, day);
                            const isOwnRow    = emp._id === user?._id;
                            const cellHoliday = holidayMap[format(day, 'yyyy-MM-dd')];
                            const typeLabel   = (to) => to.type === 'vacation' ? 'Vacation/PTO' : to.type === 'educational' ? 'Educational' : to.type === 'bereavement' ? 'Bereavement' : to.type === 'sick' ? 'Sick' : to.type === 'personal' ? 'Personal' : 'Other';
                            return (
                              <div
                                key={day.toString()}
                                className={`border-r border-gray-100 last:border-r-0 ${
                                  timeOff ? 'bg-amber-100' : pendingTO ? 'bg-yellow-50' : avail ? 'bg-green-50/40' : isToday(day) ? 'bg-blue-50/50' : cellHoliday ? 'bg-purple-100' : ''
                                }`}
                                style={{ minHeight: `${Math.round(80 * zoom)}px` }}
                              >
                                {timeOff && (
                                  <div
                                    onClick={CAN_REVIEW ? () => openTimeOffReview(timeOff, emp) : undefined}
                                    className={`flex flex-col items-center justify-center h-full min-h-[76px] px-1 py-2 gap-0.5 ${CAN_REVIEW ? 'cursor-pointer hover:bg-amber-200 transition-colors' : ''}`}
                                    title={CAN_REVIEW ? 'Click to review' : undefined}
                                  >
                                    <span className="text-xl leading-none">🏖</span>
                                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide text-center leading-tight">Time Off</p>
                                    <p className="text-[9px] text-amber-700 capitalize text-center leading-tight">{typeLabel(timeOff)}</p>
                                  </div>
                                )}
                                {pendingTO && (
                                  <div
                                    onClick={() => openTimeOffReview(pendingTO, emp)}
                                    className="flex flex-col items-center justify-center h-full min-h-[76px] px-1 py-2 gap-0.5 cursor-pointer hover:bg-yellow-100 transition-colors"
                                    title="Pending — click to review"
                                  >
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-wide text-center leading-tight">Pending</p>
                                    <p className="text-[9px] text-yellow-700 capitalize text-center leading-tight">{typeLabel(pendingTO)}</p>
                                  </div>
                                )}
                                {!timeOff && !pendingTO && (
                                  <div className="p-1.5">
                                    {avail && (
                                      <div
                                        onClick={isOwnRow ? () => handleToggleAvailability(avail.date, avail._id) : undefined}
                                        className={`text-xs p-1.5 rounded-md border border-green-300 bg-green-100 text-green-800 mb-1 ${isOwnRow ? 'cursor-pointer hover:opacity-75' : ''}`}
                                        title={isOwnRow ? 'Click to remove availability' : 'Available'}
                                      >
                                        <p className="font-semibold">✓ Available</p>
                                      </div>
                                    )}
                                    {cellShifts.map((shift) => (
                                      <div
                                        key={shift._id}
                                        onClick={() => isAdmin && openEditShift(shift)}
                                        className={`text-xs p-1.5 rounded-md border mb-1 cursor-pointer hover:opacity-80 transition-opacity ${
                                          STATUS_COLORS[shift.status] || STATUS_COLORS.scheduled
                                        }`}
                                      >
                                        <p className="font-semibold">{shift.startTime}–{shift.endTime}</p>
                                        {shift.notes?.startsWith('Time correction') && (
                                          <span className="inline-block text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-300 px-1 rounded leading-tight mt-0.5">TC</span>
                                        )}
                                      </div>
                                    ))}
                                    {!avail && isOwnRow && (
                                      <button
                                        onClick={() => handleToggleAvailability(format(day, 'yyyy-MM-dd'), null)}
                                        className="w-full text-xs text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-md py-1 transition-colors"
                                        title="Mark available"
                                      >
                                        ✓
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => openAddShift(format(day, 'yyyy-MM-dd'), emp._id)}
                                        className="w-full text-xs text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-md py-1 transition-colors"
                                      >
                                        +
                                      </button>
                                    )}
                                  </div>
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
            </div>{/* end overflow-x-auto */}
            </div>
          )}

          {/* ── 2-Week view ── */}
          {viewMode === '2weeks' && (() => {
            const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
            const twDays = eachDayOfInterval({ start: ws, end: addDays(ws, 13) });
            return (
              <StaffMonthGrid
                days={twDays}
                shifts={filteredShifts}
                employees={employees}
                approvedTimeOff={approvedTimeOff}
                pendingTimeOff={pendingTimeOff}
                availability={availability}
                holidays={holidays}
                filterEmployee={filterEmployee}
                isAdmin={isAdmin}
                canReview={CAN_REVIEW}
                user={user}
                onAddShift={openAddShift}
                onEditShift={openEditShift}
                onReviewTimeOff={openTimeOffReview}
                onMessage={handleMessageStaff}
                onToggleAvailability={handleToggleAvailability}
                zoom={zoom}
              />
            );
          })()}

          {/* ── Monthly view ── */}
          {viewMode === 'monthly' && (() => {
            const ms = startOfMonth(currentDate);
            const me = endOfMonth(currentDate);
            const mDays = eachDayOfInterval({ start: ms, end: me });
            return (
              <StaffMonthGrid
                days={mDays}
                shifts={filteredShifts}
                employees={employees}
                approvedTimeOff={approvedTimeOff}
                pendingTimeOff={pendingTimeOff}
                availability={availability}
                holidays={holidays}
                filterEmployee={filterEmployee}
                isAdmin={isAdmin}
                canReview={CAN_REVIEW}
                user={user}
                onAddShift={openAddShift}
                onEditShift={openEditShift}
                onReviewTimeOff={openTimeOffReview}
                onMessage={handleMessageStaff}
                onToggleAvailability={handleToggleAvailability}
                zoom={zoom}
              />
            );
          })()}

          {/* ── 2-Month view ── */}
          {viewMode === '2months' && (() => {
            const ms = startOfMonth(currentDate);
            const me = endOfMonth(addMonths(currentDate, 1));
            const mDays = eachDayOfInterval({ start: ms, end: me });
            return (
              <StaffMonthGrid
                days={mDays}
                shifts={filteredShifts}
                employees={employees}
                approvedTimeOff={approvedTimeOff}
                pendingTimeOff={pendingTimeOff}
                availability={availability}
                holidays={holidays}
                filterEmployee={filterEmployee}
                isAdmin={isAdmin}
                canReview={CAN_REVIEW}
                user={user}
                onAddShift={openAddShift}
                onEditShift={openEditShift}
                onReviewTimeOff={openTimeOffReview}
                onMessage={handleMessageStaff}
                onToggleAvailability={handleToggleAvailability}
                zoom={zoom}
              />
            );
          })()}

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
          {CAN_REVIEW && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border bg-yellow-100 border-yellow-400" />
              <span className="text-xs text-gray-500">Pending Time Off</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border bg-green-100 border-green-300" />
            <span className="text-xs text-gray-500">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border bg-purple-100 border-purple-300" />
            <span className="text-xs text-gray-500">Holiday</span>
          </div>
        </div>

      {/* Inline message panel */}
      {chatOpen && chatConversation && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setChatOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-[420px] max-w-full z-50 flex flex-col shadow-2xl">
            <ChatWindow
              conversation={chatConversation}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </>
      )}

      {/* Shift Modal */}
      {showModal && (
        <ShiftModal
          shift={selectedShift}
          employees={employees}
          defaultDate={selectedDate}
          defaultEmployee={selectedEmployee}
          holidays={holidays}
          allShifts={shifts}
          onClose={() => { setShowModal(false); setSelectedShift(null); setSelectedEmployee(''); }}
          onSave={handleShiftSave}
        />
      )}

      {/* Time Off Review Modal */}
      {reviewingTimeOff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Time Off Request</h2>
              <button onClick={() => setReviewingTimeOff(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: reviewingTimeOff.request.employee?.color || '#6B7280' }}
                >
                  {reviewingTimeOff.empName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{reviewingTimeOff.empName}</p>
                  <p className="text-sm text-gray-500 capitalize">
                    {reviewingTimeOff.request.type === 'vacation' ? 'Vacation/PTO'
                      : reviewingTimeOff.request.type === 'educational' ? 'Educational'
                      : reviewingTimeOff.request.type === 'bereavement' ? 'Bereavement'
                      : reviewingTimeOff.request.type === 'sick' ? 'Sick Leave'
                      : reviewingTimeOff.request.type === 'personal' ? 'Personal'
                      : 'Other'}
                  </p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${
                  reviewingTimeOff.request.status === 'approved' ? 'bg-green-100 text-green-700'
                  : reviewingTimeOff.request.status === 'denied' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {reviewingTimeOff.request.status}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Start date</span>
                  <span className="font-medium text-gray-900">{reviewingTimeOff.request.startDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">End date</span>
                  <span className="font-medium text-gray-900">{reviewingTimeOff.request.endDate}</span>
                </div>
                {reviewingTimeOff.request.reason && (
                  <div className="pt-1 border-t border-gray-200">
                    <span className="text-gray-500 block text-xs mb-0.5">Reason</span>
                    <span className="text-gray-800">{reviewingTimeOff.request.reason}</span>
                  </div>
                )}
              </div>

              {reviewingTimeOff.request.status !== 'denied' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Review note (optional)</label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note..."
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-100">
              {reviewingTimeOff.request.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleReviewTimeOff('approved')}
                    disabled={reviewLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReviewTimeOff('denied')}
                    disabled={reviewLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Deny
                  </button>
                </>
              )}
              {reviewingTimeOff.request.status === 'approved' && (
                <button
                  onClick={() => handleReviewTimeOff('denied')}
                  disabled={reviewLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Revoke Approval
                </button>
              )}
              <button
                onClick={() => setReviewingTimeOff(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
