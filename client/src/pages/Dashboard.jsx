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

const STATUS_BADGE = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100  text-green-700',
  denied:   'bg-red-100    text-red-700',
};

// ── Time Correction tab ───────────────────────────────────────────────────────
function TimeCorrectionTab({ user }) {
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filterStatus, setFilter]   = useState('');
  const [reviewId, setReviewId]     = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    originalClockIn: '',
    originalClockOut: '',
    correctedClockIn: '',
    correctedClockOut: '',
    lunchOut: '',
    lunchIn: '',
    reason: '',
  });

  const load = () => {
    setLoading(true);
    timeCorrectionAPI
      .getAll(filterStatus ? { status: filterStatus } : {})
      .then((res) => setRequests(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await timeCorrectionAPI.submit(form);
      setRequests((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        originalClockIn: '', originalClockOut: '',
        correctedClockIn: '', correctedClockOut: '',
        lunchOut: '', lunchIn: '',
        reason: '',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      const res = await timeCorrectionAPI.review(id, { status, reviewNote });
      setRequests((prev) => prev.map((r) => (r._id === id ? res.data : r)));
      setReviewId(null);
      setReviewNote('');
    } catch (err) {
      console.error(err);
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
          {/* Status filter */}
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
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">Submit Time Correction</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Original Clock-In</label>
                <input
                  type="time"
                  value={form.originalClockIn}
                  onChange={(e) => setForm({ ...form, originalClockIn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Original Clock-Out</label>
                <input
                  type="time"
                  value={form.originalClockOut}
                  onChange={(e) => setForm({ ...form, originalClockOut: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Corrected Clock-In *</label>
                <input
                  type="time"
                  required
                  value={form.correctedClockIn}
                  onChange={(e) => setForm({ ...form, correctedClockIn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Corrected Clock-Out *</label>
                <input
                  type="time"
                  required
                  value={form.correctedClockOut}
                  onChange={(e) => setForm({ ...form, correctedClockOut: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lunch Out</label>
                <input
                  type="time"
                  value={form.lunchOut}
                  onChange={(e) => setForm({ ...form, lunchOut: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lunch In</label>
                <input
                  type="time"
                  value={form.lunchIn}
                  onChange={(e) => setForm({ ...form, lunchIn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <textarea
                required
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Explain why the time needs to be corrected..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests list */}
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
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Left: employee + date */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: req.employee?.color || '#3B82F6' }}
                  >
                    {req.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{req.employee?.name}</p>
                    <p className="text-xs text-gray-500">
                      {req.employee?.position} · {format(new Date(req.date + 'T00:00:00'), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[req.status]}`}>
                    {req.status}
                  </span>
                  {req.status === 'pending' && !isAdmin && req.employee?._id === user?._id && (
                    <button
                      onClick={() => handleDelete(req._id)}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Times */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Original Time</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {req.originalClockIn || '—'} → {req.originalClockOut || '—'}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-600 mb-1">Corrected Time</p>
                  <p className="text-sm font-semibold text-blue-700">
                    {req.correctedClockIn} → {req.correctedClockOut}
                  </p>
                </div>
                {(req.lunchOut || req.lunchIn) && (
                  <div className="col-span-2 bg-orange-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-orange-600 mb-1">Lunch Break</p>
                    <p className="text-sm font-semibold text-orange-700">
                      Out: {req.lunchOut || '—'} &nbsp;·&nbsp; In: {req.lunchIn || '—'}
                    </p>
                  </div>
                )}
              </div>

              {/* Reason */}
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-700">Reason: </span>{req.reason}
              </p>

              {/* Review note (if reviewed) */}
              {req.reviewNote && (
                <p className="mt-2 text-xs text-gray-500 italic px-1">
                  Note from {req.reviewedBy?.name}: "{req.reviewNote}"
                </p>
              )}

              {/* Admin review actions */}
              {isAdmin && req.status === 'pending' && (
                <div className="mt-3">
                  {reviewId === req._id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Optional note..."
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleReview(req._id, 'approved')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(req._id, 'denied')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                      >
                        <X className="h-3.5 w-3.5" /> Deny
                      </button>
                      <button
                        onClick={() => { setReviewId(null); setReviewNote(''); }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewId(req._id)}
                      className="text-sm text-blue-600 hover:underline font-medium"
                    >
                      Review request →
                    </button>
                  )}
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
