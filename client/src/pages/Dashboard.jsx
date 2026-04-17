import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import {
  Calendar, MessageCircle, Users, Clock, TrendingUp, ChevronRight,
  AlarmClockPlus, Plus, Check, X, Trash2, AlertCircle, ArrowLeftRight,
  LogIn, LogOut,
} from 'lucide-react';
import { schedulesAPI, usersAPI, messagesAPI, timeCorrectionAPI, exchangeAPI } from '../services/api';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const TABS = [
  { key: 'overview',       label: 'Overview' },
  { key: 'shiftexchange',  label: 'Shift Exchange' },
  { key: 'timeoff',        label: 'Time Off' },
  { key: 'timecorrection', label: 'Time Correction' },
];

const LEAVE_TYPES = [
  { value: 'vacation',    label: 'Vacation / PTO',      color: 'bg-blue-100 text-blue-700' },
  { value: 'educational', label: 'Educational Leave',   color: 'bg-purple-100 text-purple-700' },
  { value: 'bereavement', label: 'Bereavement Leave',   color: 'bg-gray-100 text-gray-700' },
  { value: 'other',       label: 'Other',               color: 'bg-orange-100 text-orange-700' },
];

const leaveLabel = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label || v;
const leaveColor = (v) => LEAVE_TYPES.find((t) => t.value === v)?.color || 'bg-gray-100 text-gray-600';

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

const emptyEntry = () => ({ date: '', clockIn: '', lunchOut: '', lunchIn: '', clockOut: '', reason: '' });
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
  const [submitError, setSubmitError] = useState('');
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
    setSubmitError('');
    const filled = entries.filter((en) => en.clockIn || en.clockOut || en.date || en.lunchOut || en.lunchIn);
    if (filled.length === 0) {
      setSubmitError('Please fill in at least one row before submitting.');
      return;
    }
    const missingReason = filled.find((en) => !en.reason.trim());
    if (missingReason) {
      setSubmitError('Please provide a reason for every filled row.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await timeCorrectionAPI.submit({ entries: filled });
      setRequests((prev) => [res.data, ...prev]);
      setShowForm(false);
      setEntries([emptyEntry(), emptyEntry(), emptyEntry(), emptyEntry()]);
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to submit request. Please try again.');
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
                    <th className={TH_CLS}>Reason</th>
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
                        <input type="text" value={en.reason} onChange={(e) => updateEntry(i, 'reason', e.target.value)}
                          placeholder="Required" className={INPUT_CLS} />
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

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                {submitError}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setSubmitError(''); }}
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
                      <th className={TH_CLS}>Reason</th>
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
                        <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 italic">{en.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Review note */}
              {req.reviewNote && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 italic">
                    Note from {req.reviewedBy?.name}: "{req.reviewNote}"
                  </p>
                </div>
              )}

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

// ── Time Off tab ──────────────────────────────────────────────────────────────
function TimeOffTab({ user }) {
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filterStatus, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewing, setReviewing]     = useState(null);
  const [reviewError, setReviewError] = useState(null);

  const [form, setForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const load = () => {
    setLoading(true);
    schedulesAPI
      .getTimeOff(filterStatus ? { status: filterStatus } : {})
      .then((res) => setRequests(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterStatus]);

  const dayCount = (s, e) => {
    if (!s || !e) return null;
    const d = differenceInCalendarDays(parseISO(e), parseISO(s)) + 1;
    return d > 0 ? d : null;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSubmitError('');
    const { type, startDate, endDate, reason } = form;
    if (!startDate || !endDate) { setSubmitError('Please select start and end dates.'); return; }
    if (endDate < startDate)    { setSubmitError('End date cannot be before start date.'); return; }
    if (!reason.trim())         { setSubmitError('Please provide a reason for your request.'); return; }
    setSubmitting(true);
    try {
      const res = await schedulesAPI.requestTimeOff({ type, startDate, endDate, reason: reason.trim() });
      setRequests((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({ type: 'vacation', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, status) => {
    setReviewing(id + status);
    setReviewError(null);
    try {
      const res = await schedulesAPI.reviewTimeOff(id, { status, reviewNote: reviewNotes[id] || '' });
      setRequests((prev) => prev.map((r) => (r._id === id ? res.data : r)));
      setReviewNotes((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      setReviewError(err.response?.data?.message || err.message || 'Failed to update request.');
    } finally {
      setReviewing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Cancel this time off request?')) return;
    await schedulesAPI.deleteTimeOff(id);
    setRequests((prev) => prev.filter((r) => r._id !== id));
  };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Time Off Requests
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
            onClick={() => { setShowForm((v) => !v); setSubmitError(''); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>
      </div>

      {/* ── Request form ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-blue-100 rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="bg-blue-600 px-5 py-3">
            <h3 className="font-semibold text-white text-sm">New Time Off Request</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Leave type cards */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Leave Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LEAVE_TYPES.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: value }))}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                      form.type === value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mb-1 ${color}`}>
                      {label}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {value === 'vacation'    && 'Paid time away for rest or travel'}
                      {value === 'educational' && 'School, training, or certification'}
                      {value === 'bereavement' && 'Loss of a family member'}
                      {value === 'other'       && 'Any other reason not listed above'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Day count preview */}
            {form.startDate && form.endDate && dayCount(form.startDate, form.endDate) && (
              <p className="text-xs text-blue-600 font-medium -mt-2">
                {dayCount(form.startDate, form.endDate)} day{dayCount(form.startDate, form.endDate) !== 1 ? 's' : ''} requested
              </p>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => { setForm((f) => ({ ...f, reason: e.target.value })); setSubmitError(''); }}
                placeholder="Briefly describe your reason..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                {submitError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setSubmitError(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
              >
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
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No time off requests</p>
          <p className="text-sm mt-1">
            {filterStatus ? `No ${filterStatus} requests found` : 'Submit a request to schedule time away'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const days = dayCount(req.startDate, req.endDate);
            return (
              <div key={req._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  {/* Employee + leave type */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: req.employee?.color || '#3B82F6' }}
                    >
                      {req.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{req.employee?.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaveColor(req.type)}`}>
                        {leaveLabel(req.type)}
                      </span>
                    </div>
                  </div>

                  {/* Dates + status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">
                        {format(parseISO(req.startDate), 'MMM d')}
                        {req.startDate !== req.endDate && ` – ${format(parseISO(req.endDate), 'MMM d, yyyy')}`}
                        {req.startDate === req.endDate && `, ${format(parseISO(req.startDate), 'yyyy')}`}
                      </p>
                      {days && (
                        <p className="text-xs text-gray-400">{days} day{days !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[req.status]}`}>
                      {req.status}
                    </span>
                    {req.status === 'pending' && !isAdmin && req.employee?._id === user?._id && (
                      <button
                        onClick={() => handleDelete(req._id)}
                        className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                        title="Cancel request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Reason */}
                {req.reason && (
                  <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">Reason: </span>{req.reason}
                    </p>
                    {req.reviewNote && (
                      <p className="text-xs text-gray-400 italic mt-1">
                        Note from {req.reviewedBy?.name}: "{req.reviewNote}"
                      </p>
                    )}
                  </div>
                )}

                {/* Admin review */}
                {isAdmin && req.status === 'pending' && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-50 space-y-2">
                    {reviewError && reviewing === null && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{reviewError}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={reviewNotes[req._id] || ''}
                        onChange={(e) => setReviewNotes((prev) => ({ ...prev, [req._id]: e.target.value }))}
                        placeholder="Optional note…"
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleReview(req._id, 'approved')}
                        disabled={!!reviewing}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
                      >
                        {reviewing === req._id + 'approved'
                          ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          : <Check className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(req._id, 'denied')}
                        disabled={!!reviewing}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium"
                      >
                        {reviewing === req._id + 'denied'
                          ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          : <X className="h-3.5 w-3.5" />}
                        Deny
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shift Exchange tab ────────────────────────────────────────────────────────
function ShiftExchangeTab({ user }) {
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [requests, setRequests]   = useState([]); // own (employee) or all (admin)
  const [available, setAvailable] = useState([]); // cover opportunities for employee
  const [myShifts, setMyShifts]   = useState([]); // own upcoming shifts for the form
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ shiftId: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [approving, setApproving] = useState(null);
  const [responding, setResponding] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const today   = format(new Date(), 'yyyy-MM-dd');
      const inEight = format(addWeeks(new Date(), 8), 'yyyy-MM-dd');
      const [exchRes, shiftsRes] = await Promise.all([
        exchangeAPI.getAll(),
        isAdmin
          ? Promise.resolve({ data: [] })
          : schedulesAPI.getShifts({ startDate: today, endDate: inEight, employeeId: user._id }),
      ]);
      setRequests(exchRes.data.requests);
      setAvailable(exchRes.data.available);
      // Exclude shifts already posted for exchange
      const openShiftIds = new Set(
        (exchRes.data.requests || []).filter((e) => e.status === 'open').map((e) => e.shift?._id)
      );
      setMyShifts((shiftsRes.data || []).filter((s) => !openShiftIds.has(s._id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.shiftId) { setError('Please select a shift.'); return; }
    setSubmitting(true);
    try {
      const res = await exchangeAPI.create(form);
      setRequests((prev) => [res.data, ...prev]);
      setMyShifts((prev) => prev.filter((s) => s._id !== form.shiftId));
      setShowForm(false);
      setForm({ shiftId: '', note: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post exchange request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (exchangeId, response) => {
    setResponding(exchangeId + response);
    try {
      const res = await exchangeAPI.respond(exchangeId, { response });
      setAvailable((prev) => prev.map((e) => (e._id === exchangeId ? res.data : e)));
    } catch (err) {
      console.error(err);
    } finally {
      setResponding(null);
    }
  };

  const handleApprove = async (exchangeId, acceptedById) => {
    setApproving(exchangeId + acceptedById);
    try {
      const res = await exchangeAPI.approve(exchangeId, { acceptedBy: acceptedById });
      setRequests((prev) => prev.map((e) => (e._id === exchangeId ? res.data : e)));
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(null);
    }
  };

  const handleCancel = async (exchangeId) => {
    if (!confirm('Cancel this exchange request?')) return;
    try {
      await exchangeAPI.cancel(exchangeId);
      setRequests((prev) =>
        prev.map((e) => (e._id === exchangeId ? { ...e, status: 'cancelled' } : e))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const myResponse = (exchange) =>
    exchange.responses?.find((r) => (r.employee?._id || r.employee) === user._id)?.response;

  const availableResponders = (exchange) =>
    exchange.responses?.filter((r) => r.response === 'available') || [];

  const STATUS_CLS = {
    open:      'bg-yellow-100 text-yellow-700',
    approved:  'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            Shift Exchange
          </h2>
          {!isAdmin && available.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {available.length} open for your position
            </span>
          )}
        </div>
        {!isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Post My Shift
          </button>
        )}
      </div>

      {/* ── Create form ── */}
      {showForm && !isAdmin && (
        <div className="bg-white border border-blue-100 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-blue-600 px-5 py-3">
            <h3 className="font-semibold text-white text-sm">Post a Shift for Exchange</h3>
          </div>
          <form onSubmit={handleCreate} className="p-4 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select your shift *</label>
              <select
                required
                value={form.shiftId}
                onChange={(e) => setForm((f) => ({ ...f, shiftId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a shift --</option>
                {myShifts.length === 0
                  ? <option disabled>No upcoming shifts available</option>
                  : myShifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {format(parseISO(s.date + 'T00:00:00'), 'EEE, MMM d')} · {to12h(s.startTime)}–{to12h(s.endTime)}{s.position ? ` (${s.position})` : ''}
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Doctor's appointment, please help!"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
              >
                {submitting ? 'Posting…' : 'Post for Exchange'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Employee: shifts available to cover ── */}
      {!isAdmin && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Shifts Available to Cover
          </h3>
          {available.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No open shift requests for your position right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {available.map((exchange) => {
                const resp = myResponse(exchange);
                const shift = exchange.shift;
                return (
                  <div key={exchange._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: exchange.requestedBy?.color || '#3B82F6' }}
                        >
                          {exchange.requestedBy?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{exchange.requestedBy?.name}</p>
                          <p className="text-xs text-gray-500">{exchange.position}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {format(parseISO(exchange.date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                        </p>
                        {shift && (
                          <p className="text-xs text-gray-500">{to12h(shift.startTime)} – {to12h(shift.endTime)}</p>
                        )}
                      </div>
                    </div>
                    {exchange.note && (
                      <p className="text-xs text-gray-500 italic mt-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                        "{exchange.note}"
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRespond(exchange._id, 'available')}
                        disabled={!!responding}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          resp === 'available'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {resp === 'available' ? "I'm Available ✓" : "I'm Available"}
                      </button>
                      <button
                        onClick={() => handleRespond(exchange._id, 'declined')}
                        disabled={!!responding}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          resp === 'declined'
                            ? 'bg-gray-500 text-white'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <X className="h-3.5 w-3.5" />
                        Not Available
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── My requests (employee) / All requests (admin) ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {isAdmin ? 'All Exchange Requests' : 'My Exchange Requests'}
          {requests.length > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{requests.length}</span>
          )}
        </h3>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm">{isAdmin ? 'No exchange requests yet' : 'You have no exchange requests'}</p>
            {!isAdmin && <p className="text-xs mt-1">Post a shift above to ask colleagues to cover</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((exchange) => {
              const shift = exchange.shift;
              const responders = availableResponders(exchange);
              return (
                <div key={exchange._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: exchange.requestedBy?.color || '#3B82F6' }}
                        >
                          {exchange.requestedBy?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        {isAdmin && (
                          <p className="font-semibold text-sm text-gray-900">{exchange.requestedBy?.name}</p>
                        )}
                        <p className="text-sm font-medium text-gray-700">
                          {format(parseISO(exchange.date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                          {shift && ` · ${to12h(shift.startTime)}–${to12h(shift.endTime)}`}
                        </p>
                        {exchange.position && (
                          <p className="text-xs text-gray-400">{exchange.position}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_CLS[exchange.status]}`}>
                        {exchange.status}
                      </span>
                      {!isAdmin && exchange.status === 'open' && (
                        <button
                          onClick={() => handleCancel(exchange._id)}
                          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                          title="Cancel request"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3">
                    {exchange.note && (
                      <p className="text-xs text-gray-500 italic mb-3">"{exchange.note}"</p>
                    )}

                    {exchange.status === 'approved' && exchange.acceptedBy && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-green-600" />
                        Covered by <strong className="ml-1">{exchange.acceptedBy.name}</strong>
                      </div>
                    )}

                    {exchange.status === 'open' && (
                      responders.length === 0 ? (
                        <p className="text-xs text-gray-400">Waiting for colleagues to respond…</p>
                      ) : (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">
                            {responders.length} colleague{responders.length > 1 ? 's' : ''} available:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {responders.map((r) => (
                              <div
                                key={r.employee?._id}
                                className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
                              >
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: r.employee?.color || '#22c55e' }}
                                >
                                  {r.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                </div>
                                <span className="text-xs font-medium text-gray-800">{r.employee?.name}</span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleApprove(exchange._id, r.employee._id)}
                                    disabled={!!approving}
                                    className="ml-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
                                  >
                                    {approving === exchange._id + r.employee._id ? '…' : 'Approve'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview tab (original dashboard content) ─────────────────────────────────
function OverviewTab({ user, todayShifts, weekShifts, employees, conversations }) {
  const [myShifts, setMyShifts] = useState(() =>
    todayShifts.filter((s) => s.employee?._id === user?._id || s.employee === user?._id)
  );
  const [clockLoading, setClockLoading] = useState(null);

  const handleClockIn = async (shiftId) => {
    setClockLoading(shiftId);
    try {
      const res = await schedulesAPI.clockIn(shiftId);
      setMyShifts((prev) => prev.map((s) => (s._id === shiftId ? { ...s, ...res.data } : s)));
    } catch (err) {
      console.error('Clock in failed', err);
    } finally {
      setClockLoading(null);
    }
  };

  const handleClockOut = async (shiftId) => {
    setClockLoading(shiftId);
    try {
      const res = await schedulesAPI.clockOut(shiftId);
      setMyShifts((prev) => prev.map((s) => (s._id === shiftId ? { ...s, ...res.data } : s)));
    } catch (err) {
      console.error('Clock out failed', err);
    } finally {
      setClockLoading(null);
    }
  };

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

      {/* My Shifts Today — clock-in/out widget */}
      {myShifts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-2 p-5 border-b border-gray-100">
            <Clock className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900">My Shifts Today</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {myShifts.map((shift) => {
              const isBusy = clockLoading === shift._id;
              const clockInTime = shift.clockIn ? format(new Date(shift.clockIn), 'h:mm a') : null;
              const clockOutTime = shift.clockOut ? format(new Date(shift.clockOut), 'h:mm a') : null;
              return (
                <div key={shift._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {to12h(shift.startTime)} – {to12h(shift.endTime)}
                    </p>
                    <p className="text-xs text-gray-500">{shift.position || shift.department || 'No position'}</p>
                    {clockInTime && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Clocked in: {clockInTime}
                        {clockOutTime && ` · Out: ${clockOutTime}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!shift.clockIn && (
                      <button
                        onClick={() => handleClockIn(shift._id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {isBusy ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <LogIn className="h-3.5 w-3.5" />}
                        Clock In
                      </button>
                    )}
                    {shift.clockIn && !shift.clockOut && (
                      <button
                        onClick={() => handleClockOut(shift._id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {isBusy ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <LogOut className="h-3.5 w-3.5" />}
                        Clock Out
                      </button>
                    )}
                    {shift.clockIn && shift.clockOut && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

    Promise.all([
      schedulesAPI.getShifts({ startDate: today, endDate: today }),
      schedulesAPI.getShifts({ startDate: weekStart, endDate: weekEnd }),
      usersAPI.getAll(),
      messagesAPI.getConversations(),
      timeCorrectionAPI.getAll({ status: 'pending' }),
      schedulesAPI.getTimeOff({ status: 'pending' }),
    ])
      .then(([todayRes, weekRes, empRes, convRes, corrRes, toRes]) => {
        setTodayShifts(todayRes.data);
        setWeekShifts(weekRes.data);
        setEmployees(empRes.data);
        setConversations(convRes.data.slice(0, 5));
        setPendingCorrections(corrRes.data.length);
        setPendingTimeOff(toRes.data.length);
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
            {key === 'timeoff' && isAdmin && pendingTimeOff > 0 && (
              <span className="ml-1.5 bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingTimeOff}
              </span>
            )}
            {key === 'timecorrection' && isAdmin && pendingCorrections > 0 && (
              <span className="ml-1.5 bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingCorrections}
              </span>
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
      {activeTab === 'shiftexchange' && (
        <ShiftExchangeTab user={user} />
      )}
      {activeTab === 'timeoff' && (
        <TimeOffTab user={user} />
      )}
      {activeTab === 'timecorrection' && (
        <TimeCorrectionTab user={user} />
      )}
    </div>
  );
}
