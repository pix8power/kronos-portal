import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import {
  Calendar, MessageCircle, Users, Clock, TrendingUp, ChevronRight,
  AlarmClockPlus, Plus, Check, X, Trash2, AlertCircle,
} from 'lucide-react';
import { schedulesAPI, usersAPI, messagesAPI, timeCorrectionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'timecorrection', label: 'Time Correction' },
];

// Convert HH:MM (24h) to h:MM AM/PM
const to12h = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const STATUS_BADGE = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100  text-green-700',
  denied:   'bg-red-100    text-red-700',
};

const emptyEntry = () => ({ date: '', clockIn: '', lunchOut: '', lunchIn: '', clockOut: '' });
const INPUT_CLS = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white';
const TH_CLS   = 'px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200 whitespace-nowrap';
const TD_CLS   = 'px-2 py-1.5 border-b border-gray-100';

// ── Time Correction tab ───────────────────────────────────────────────────────
function TimeCorrectionTab({ user }) {
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filterStatus, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason]       = useState('');
  const [entries, setEntries]     = useState([emptyEntry(), emptyEntry(), emptyEntry(), emptyEntry()]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewing, setReviewing]     = useState(null);
  const [reviewError, setReviewError] = useState(null);

  const load = () => {
    setLoading(true);
    timeCorrectionAPI
      .getAll(filterStatus ? { status: filterStatus } : {})
      .then((res) => setRequests(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterStatus]);

  const updateEntry = (i, field, val) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filled = entries.filter((en) => en.clockIn || en.clockOut || en.date);
    if (filled.length === 0) return alert('Please fill in at least one row.');
    setSubmitting(true);
    try {
      const res = await timeCorrectionAPI.submit({ entries: filled, reason });
      setRequests((prev) => [res.data, ...prev]);
      setShowForm(false);
      setEntries([emptyEntry(), emptyEntry(), emptyEntry(), emptyEntry()]);
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, status) => {
    setReviewing(id + status);
    setReviewError(null);
    try {
      const res = await timeCorrectionAPI.review(id, { status, reviewNote: reviewNotes[id] || '' });
      setRequests((prev) => prev.map((r) => (r._id === id ? res.data : r)));
      setReviewNotes((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      setReviewError(err.response?.data?.message || err.message || 'Failed to update request');
    } finally {
      setReviewing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this request?')) return;
    await timeCorrectionAPI.delete(id);
    setRequests((prev) => prev.filter((r) => r._id !== id));
  };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlarmClockPlus className="h-5 w-5 text-blue-600" />
            Time Correction Requests
          </h2>
          {isAdmin && pending > 0 && (
            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pending} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>
      </div>

      {/* ── Submission form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="bg-blue-600 px-5 py-3">
            <h3 className="font-semibold text-white text-sm">Time Correction Sheet</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLS}>Date</th>
                    <th className={TH_CLS}>Clock In</th>
                    <th className={TH_CLS}>Time Out (Lunch)</th>
                    <th className={TH_CLS}>Time In (Lunch)</th>
                    <th className={TH_CLS}>Clock Out</th>
                    <th className={`${TH_CLS} w-8`}></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((en, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className={TD_CLS}>
                        <input type="date" value={en.date} onChange={(e) => updateEntry(i, 'date', e.target.value)} className={INPUT_CLS} />
                      </td>
                      <td className={TD_CLS}>
                        <input type="time" value={en.clockIn} onChange={(e) => updateEntry(i, 'clockIn', e.target.value)} className={INPUT_CLS} />
                      </td>
                      <td className={TD_CLS}>
                        <input type="time" value={en.lunchOut} onChange={(e) => updateEntry(i, 'lunchOut', e.target.value)} className={INPUT_CLS} />
                      </td>
                      <td className={TD_CLS}>
                        <input type="time" value={en.lunchIn} onChange={(e) => updateEntry(i, 'lunchIn', e.target.value)} className={INPUT_CLS} />
                      </td>
                      <td className={TD_CLS}>
                        <input type="time" value={en.clockOut} onChange={(e) => updateEntry(i, 'clockOut', e.target.value)} className={INPUT_CLS} />
                      </td>
                      <td className={TD_CLS}>
                        {entries.length > 1 && (
                          <button type="button" onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setEntries((prev) => [...prev, emptyEntry()])}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add row
            </button>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <textarea
                required rows={2} value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the time needs to be corrected..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium">
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Requests list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No correction requests</p>
          <p className="text-sm mt-1">
            {filterStatus ? `No ${filterStatus} requests found` : 'Submit a request to correct your clock times'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: req.employee?.color || '#3B82F6' }}
                  >
                    {req.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{req.employee?.name}</p>
                    <p className="text-xs text-gray-400">{req.employee?.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[req.status]}`}>
                    {req.status}
                  </span>
                  {req.status === 'pending' && !isAdmin && req.employee?._id === user?._id && (
                    <button onClick={() => handleDelete(req._id)}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Entries table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLS}>Date</th>
                      <th className={TH_CLS}>Clock In</th>
                      <th className={TH_CLS}>Time Out (Lunch)</th>
                      <th className={TH_CLS}>Time In (Lunch)</th>
                      <th className={TH_CLS}>Clock Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(req.entries || []).map((en, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-100 font-medium">
                          {en.date ? format(new Date(en.date + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-100">{to12h(en.clockIn)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-100">{to12h(en.lunchOut)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-100">{to12h(en.lunchIn)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-100">{to12h(en.clockOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reason + review note */}
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Reason: </span>{req.reason}
                </p>
                {req.reviewNote && (
                  <p className="text-xs text-gray-400 italic">
                    Note from {req.reviewedBy?.name}: "{req.reviewNote}"
                  </p>
                )}
              </div>

              {/* Admin review actions */}
              {isAdmin && req.status === 'pending' && (
                <div className="px-4 pb-4 space-y-2">
                  {reviewError && reviewing === null && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">Error: {reviewError}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={reviewNotes[req._id] || ''}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [req._id]: e.target.value }))}
                      placeholder="Optional note…"
                      className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => handleReview(req._id, 'approved')} disabled={!!reviewing}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium">
                      {reviewing === req._id + 'approved'
                        ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button onClick={() => handleReview(req._id, 'denied')} disabled={!!reviewing}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium">
                      {reviewing === req._id + 'denied'
                        ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        : <X className="h-3.5 w-3.5" />}
                      Deny
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Overview tab (original dashboard content) ─────────────────────────────────
function OverviewTab({ user, todayShifts, weekShifts, employees, conversations }) {
  const myShifts = todayShifts.filter(
    (s) => s.employee?._id === user?._id || s.employee === user?._id
  );

  const stats = [
    {
      label: 'Shifts Today',
      value: todayShifts.length,
      icon: Calendar,
      color: 'bg-blue-500',
      sub: `${myShifts.length} assigned to you`,
    },
    {
      label: 'This Week',
      value: weekShifts.length,
      icon: TrendingUp,
      color: 'bg-green-500',
      sub: 'Total shifts scheduled',
    },
    {
      label: 'Team Members',
      value: employees.length,
      icon: Users,
      color: 'bg-purple-500',
      sub: `${employees.filter((e) => e.isOnline).length} online now`,
    },
    {
      label: 'Messages',
      value: conversations.length,
      icon: MessageCircle,
      color: 'bg-orange-500',
      sub: 'Active conversations',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`${color} p-2 rounded-lg`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{value}</span>
            </div>
            <p className="font-semibold text-gray-700">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Shifts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Today&apos;s Shifts
            </h2>
            <Link to="/schedule" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {todayShifts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No shifts scheduled today</p>
            ) : (
              todayShifts.slice(0, 6).map((shift) => (
                <div key={shift._id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: shift.employee?.color || '#3B82F6' }}
                  >
                    {shift.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{shift.employee?.name}</p>
                    <p className="text-xs text-gray-500">{shift.position || shift.employee?.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {shift.startTime} – {shift.endTime}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        shift.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : shift.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {shift.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              Recent Messages
            </h2>
            <Link to="/messages" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Open <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {conversations.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No conversations yet</p>
            ) : (
              conversations.map((conv) => {
                const other = conv.participants?.find((p) => p._id !== user?._id);
                const name = conv.isGroup ? conv.name : other?.name || 'Unknown';
                const initials = name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <Link
                    key={conv._id}
                    to="/messages"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: other?.color || '#6B7280' }}
                      >
                        {initials}
                      </div>
                      {other?.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {conv.lastMessage?.content || 'Start a conversation'}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [todayShifts, setTodayShifts] = useState([]);
  const [weekShifts, setWeekShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    Promise.all([
      schedulesAPI.getShifts({ startDate: today, endDate: today }),
      schedulesAPI.getShifts({ startDate: weekStart, endDate: weekEnd }),
      usersAPI.getAll(),
      messagesAPI.getConversations(),
      timeCorrectionAPI.getAll({ status: 'pending' }),
    ])
      .then(([todayRes, weekRes, empRes, convRes, corrRes]) => {
        setTodayShifts(todayRes.data);
        setWeekShifts(weekRes.data);
        setEmployees(empRes.data);
        setConversations(convRes.data.slice(0, 5));
        setPendingCorrections(corrRes.data.length);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`relative px-5 py-2.5 text-sm font-medium transition-colors rounded-t-lg -mb-px ${
              activeTab === key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
            {/* Badge for pending corrections */}
            {key === 'timecorrection' && isAdmin && pendingCorrections > 0 && (
              <span className="ml-1.5 bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingCorrections}
              </span>
            )}
            {key === 'timecorrection' && !isAdmin && (
              <span className="ml-1.5 text-xs text-gray-400">· my requests</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          user={user}
          todayShifts={todayShifts}
          weekShifts={weekShifts}
          employees={employees}
          conversations={conversations}
        />
      )}
      {activeTab === 'timecorrection' && (
        <TimeCorrectionTab user={user} />
      )}
    </div>
  );
}
