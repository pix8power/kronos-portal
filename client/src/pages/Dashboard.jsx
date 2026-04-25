import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, eachDayOfInterval, parseISO, differenceInCalendarDays } from 'date-fns';
import {
  Calendar, Clock, TrendingUp, ChevronRight, Users,
  AlarmClockPlus, Plus, Check, X, Trash2, AlertCircle, ArrowLeftRight,
  UserCircle, ChevronRight as Arrow, Download,
} from 'lucide-react';
import { schedulesAPI, timeCorrectionAPI, exchangeAPI, profileAPI } from '../services/api';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ExchangeCardSkeleton, StaffGridSkeleton } from '../components/Skeleton';

const ALL_TABS = [
  { key: 'overview',       label: 'Overview',         privileged: true },
  { key: 'shiftexchange',  label: 'Shift Exchange',   privileged: false },
  { key: 'timeoff',        label: 'Time Off',         privileged: false },
  { key: 'timecorrection', label: 'Time Correction',  privileged: false },
];
const PRIVILEGED_ROLES = ['admin', 'manager', 'charge_nurse'];

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
  const { isSupported: webAuthnSupported, authenticatePasskey } = useWebAuthn();

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
  const [pendingEntries, setPendingEntries] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState('biometric'); // 'biometric' | 'password'

  const load = () => {
    setLoading(true);
    timeCorrectionAPI
      .getAll(filterStatus ? { status: filterStatus } : {})
      .then((res) => setRequests(res.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterStatus]);

  const [exportWeeks, setExportWeeks] = useState('2');

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const weeks = exportWeeks === 'all' ? 0 : exportWeeks;
      const base = import.meta.env.VITE_API_URL || '/api';
      const r = await fetch(`${base}/timecorrections/export?weeks=${weeks}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Export failed' }));
        alert(err.message || 'Export failed');
        return;
      }
      const text = await r.text();
      if (!text || text.split('\n').length < 2) {
        alert('No time correction data found for this period.');
        return;
      }
      const filename = `time-corrections-${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([text], { type: 'text/csv' });
      const file = new File([blob], filename, { type: 'text/csv' });

      // Web Share API — works on iOS Safari including PWA
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Time Corrections Report' });
        return;
      }

      // Desktop fallback — data URL
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement('a');
        a.href = reader.result;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

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
    // Default to biometric if supported, otherwise password
    setAuthMode(webAuthnSupported ? 'biometric' : 'password');
    setPendingEntries(filled);
    setConfirmPassword('');
    setConfirmError('');
  };

  const doSubmitRequest = async (password) => {
    const res = await timeCorrectionAPI.submit({ entries: pendingEntries, password });
    setRequests((prev) => [res.data, ...prev]);
    setShowForm(false);
    setEntries([emptyEntry(), emptyEntry(), emptyEntry(), emptyEntry()]);
    setPendingEntries(null);
    setConfirmPassword('');
  };

  const handleBiometricConfirm = async () => {
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      await authenticatePasskey();
      // Biometric verified — submit without password (use a sentinel that server accepts)
      // We still need a password for the server; prompt for it once after biometric
      setAuthMode('password-after-biometric');
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setConfirmError('Biometric prompt was cancelled. Use password instead.');
      } else if (err?.response?.data?.message) {
        setConfirmError(err.response.data.message);
      } else {
        setConfirmError('Biometric authentication failed. Try your password instead.');
      }
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!confirmPassword) return setConfirmError('Please enter your password to confirm.');
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      await doSubmitRequest(confirmPassword);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit.';
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('invalid')) {
        setConfirmError('Incorrect password. Please try again.');
      } else {
        setConfirmError(msg);
      }
    } finally {
      setConfirmSubmitting(false);
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
      {/* Confirmation modal */}
      {pendingEntries && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Confirm Submission</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              By submitting this time correction request, I certify under penalty of applicable law that the information provided is true, accurate, and complete to the best of my knowledge. I understand that submitting false, misleading, or fraudulent time records may result in disciplinary action, termination of employment, and/or legal consequences. I acknowledge that this submission constitutes an electronic record and carries the same legal weight as a handwritten signature.
            </p>

            {/* Biometric prompt */}
            {authMode === 'biometric' && (
              <>
                <p className="text-sm font-medium text-gray-700 mb-4 text-center">
                  Verify your identity to submit
                </p>
                <button
                  onClick={handleBiometricConfirm}
                  disabled={confirmSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
                >
                  <span className="text-lg">🔒</span>
                  {confirmSubmitting ? 'Verifying...' : 'Use Face ID / Fingerprint'}
                </button>
                <button
                  onClick={() => { setAuthMode('password'); setConfirmError(''); }}
                  className="w-full text-sm text-blue-600 hover:underline py-1"
                >
                  Use password instead
                </button>
              </>
            )}

            {/* Password prompt (direct or after biometric fallback) */}
            {(authMode === 'password' || authMode === 'password-after-biometric') && (
              <>
                {authMode === 'password-after-biometric' && (
                  <p className="text-xs text-gray-500 mb-3 text-center">
                    Biometric verified. Enter your password to complete.
                  </p>
                )}
                {authMode === 'password' && (
                  <p className="text-sm font-medium text-gray-700 mb-2">Enter your password to confirm:</p>
                )}
                <input
                  type="password"
                  placeholder="Your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmSubmit()}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  autoFocus
                />
                {webAuthnSupported && authMode === 'password' && (
                  <button
                    onClick={() => { setAuthMode('biometric'); setConfirmError(''); }}
                    className="w-full text-sm text-blue-600 hover:underline py-1 mb-2"
                  >
                    Use biometrics instead
                  </button>
                )}
              </>
            )}

            {confirmError && <p className="text-red-500 text-xs mb-3">{confirmError}</p>}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setPendingEntries(null); setConfirmPassword(''); setConfirmError(''); }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {(authMode === 'password' || authMode === 'password-after-biometric') && (
                <button
                  onClick={handleConfirmSubmit}
                  disabled={confirmSubmitting || !confirmPassword}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {confirmSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <div className="flex items-center gap-1">
              <select
                value={exportWeeks}
                onChange={(e) => setExportWeeks(e.target.value)}
                className="px-2 py-2 text-sm border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="2">Last 2 wks</option>
                <option value="4">Last 4 wks</option>
                <option value="8">Last 8 wks</option>
                <option value="all">All time</option>
              </select>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 border border-l-0 border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-r-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          )}
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
  const [myShiftDates, setMyShiftDates] = useState(new Set()); // all shift dates (YYYY-MM-DD) for off-day calc
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ shiftId: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [approving, setApproving] = useState(null);
  const [responding, setResponding] = useState(null);
  const [expandedPicker, setExpandedPicker] = useState({}); // exchangeId → [selectedDates]

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
      const allShifts = shiftsRes.data || [];
      setMyShiftDates(new Set(allShifts.map((s) => s.date)));
      setMyShifts(allShifts.filter((s) => !openShiftIds.has(s._id)));
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

  const handleRespond = async (exchangeId, response, availableDates) => {
    setResponding(exchangeId + response);
    try {
      const res = await exchangeAPI.respond(exchangeId, { response, availableDates });
      if (response === 'declined') {
        setAvailable((prev) => prev.filter((e) => e._id !== exchangeId));
      } else {
        setAvailable((prev) => prev.map((e) => (e._id === exchangeId ? res.data : e)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResponding(null);
    }
  };

  const openPicker = (exchangeId) => {
    setExpandedPicker((prev) => {
      if (prev[exchangeId] !== undefined) return prev; // already open
      const next = Object.assign({}, prev);
      next[exchangeId] = [];
      return next;
    });
  };

  const closePicker = (exchangeId) => {
    setExpandedPicker((prev) => {
      const next = Object.assign({}, prev);
      delete next[exchangeId];
      return next;
    });
  };

  const toggleDate = (exchangeId, dateStr) => {
    setExpandedPicker((prev) => {
      const cur = prev[exchangeId] || [];
      const next = Object.assign({}, prev);
      next[exchangeId] = cur.includes(dateStr) ? cur.filter((d) => d !== dateStr) : cur.concat(dateStr);
      return next;
    });
  };

  const submitAvailable = async (exchange) => {
    const dates = expandedPicker[exchange._id] || [];
    await handleRespond(exchange._id, 'available', dates);
    setExpandedPicker((prev) => {
      const next = Object.assign({}, prev);
      delete next[exchange._id];
      return next;
    });
  };

  const handlePropose = async (exchangeId, proposedAcceptedBy) => {
    setApproving(exchangeId + proposedAcceptedBy);
    try {
      const res = await exchangeAPI.propose(exchangeId, { proposedAcceptedBy });
      setRequests((prev) => prev.map((e) => (e._id === exchangeId ? res.data : e)));
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(null);
    }
  };

  const handleManagerReview = async (exchangeId, action, managerNote = '') => {
    setApproving(exchangeId + action);
    try {
      const res = await exchangeAPI.review(exchangeId, { action, managerNote });
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
    open:             'bg-yellow-100 text-yellow-700',
    pending_approval: 'bg-blue-100 text-blue-700',
    approved:         'bg-green-100 text-green-700',
    denied:           'bg-red-100 text-red-600',
    cancelled:        'bg-gray-100 text-gray-500',
  };

  const STATUS_LABEL = {
    open:             'Open',
    pending_approval: 'Awaiting Approval',
    approved:         'Approved',
    denied:           'Denied',
    cancelled:        'Cancelled',
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <ExchangeCardSkeleton key={i} />)}
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
                const pickerOpen = expandedPicker[exchange._id] !== undefined;
                const selDates = pickerOpen ? (expandedPicker[exchange._id] || []) : [];
                const myResp = exchange.responses ? exchange.responses.find((r) => (r.employee?._id || r.employee) === user._id) : null;

                // Compute off-days only when picker is open
                let offDays = [];
                if (pickerOpen) {
                  const exchDate = parseISO(exchange.date + 'T00:00:00');
                  const windowDates = eachDayOfInterval({ start: addDays(exchDate, -7), end: addDays(exchDate, 7) });
                  offDays = windowDates.filter((d) => {
                    const str = format(d, 'yyyy-MM-dd');
                    return str !== exchange.date && !myShiftDates.has(str);
                  });
                }

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

                    {/* Already responded — show selected dates */}
                    {resp === 'available' && myResp && myResp.availableDates && myResp.availableDates.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {myResp.availableDates.map((d) => (
                          <span key={d} className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                            {format(parseISO(d + 'T00:00:00'), 'MMM d')}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onTouchEnd={(e) => { e.preventDefault(); openPicker(exchange._id); }}
                        onClick={() => openPicker(exchange._id)}
                        className={`flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-lg font-medium ${
                          resp === 'available'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-50 text-green-700 border border-green-200'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        {resp === 'available' ? "I'm Available ✓" : "I'm Available"}
                      </button>
                      <button
                        type="button"
                        onTouchEnd={(e) => { e.preventDefault(); handleRespond(exchange._id, 'declined'); }}
                        onClick={() => handleRespond(exchange._id, 'declined')}
                        disabled={!!responding}
                        className={`flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-lg font-medium ${
                          resp === 'declined'
                            ? 'bg-gray-500 text-white'
                            : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}
                      >
                        <X className="h-4 w-4" />
                        Not Available
                      </button>
                    </div>

                    {/* Off-day dropdown */}
                    {pickerOpen && (
                      <div className="mt-3 border border-green-200 rounded-xl bg-green-50 p-3">
                        <p className="text-xs font-semibold text-green-800 mb-2">
                          Which of your days off can you work?
                        </p>
                        {offDays.length === 0 ? (
                          <p className="text-xs text-gray-500 italic mb-3">No days off found in this window.</p>
                        ) : (
                          <div className="flex flex-col gap-1 mb-3">
                            {offDays.map((d) => {
                              const str = format(d, 'yyyy-MM-dd');
                              const sel = selDates.includes(str);
                              return (
                                <button
                                  key={str}
                                  type="button"
                                  onTouchEnd={(e) => { e.preventDefault(); toggleDate(exchange._id, str); }}
                                  onClick={() => toggleDate(exchange._id, str)}
                                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium ${
                                    sel ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
                                  }`}
                                >
                                  <span>{format(d, 'EEEE, MMM d')}</span>
                                  {sel && <Check className="h-4 w-4 flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onTouchEnd={(e) => { e.preventDefault(); closePicker(exchange._id); }}
                            onClick={() => closePicker(exchange._id)}
                            className="flex-1 text-xs py-2.5 border border-gray-300 rounded-lg bg-white font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onTouchEnd={(e) => { e.preventDefault(); if (selDates.length > 0 && !responding) submitAvailable(exchange); }}
                            onClick={() => submitAvailable(exchange)}
                            disabled={selDates.length === 0 || !!responding}
                            className="flex-1 text-xs py-2.5 bg-green-600 disabled:bg-green-300 text-white rounded-lg font-medium"
                          >
                            {responding === exchange._id + 'available' ? 'Saving…' : 'Confirm' + (selDates.length > 0 ? ' (' + selDates.length + ')' : '')}
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
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLS[exchange.status]}`}>
                        {STATUS_LABEL[exchange.status] || exchange.status}
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

                    {exchange.status === 'pending_approval' && (
                      <div className="space-y-2">
                        {exchange.proposedAcceptedBy && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: exchange.proposedAcceptedBy?.color || '#3B82F6' }}>
                              {exchange.proposedAcceptedBy?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-xs text-gray-700">Proposed swap with <strong>{exchange.proposedAcceptedBy?.name}</strong></span>
                          </div>
                        )}
                        {isAdmin ? (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleManagerReview(exchange._id, 'approve')}
                              disabled={!!approving}
                              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {approving === exchange._id + 'approve' ? '…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                const note = prompt('Reason for denying (optional):') ?? '';
                                handleManagerReview(exchange._id, 'deny', note);
                              }}
                              disabled={!!approving}
                              className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium"
                            >
                              <X className="h-3.5 w-3.5" />
                              {approving === exchange._id + 'deny' ? '…' : 'Deny'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-blue-600">Waiting for manager approval…</p>
                        )}
                        {exchange.managerNote && (
                          <p className="text-xs text-gray-500 italic">Note: "{exchange.managerNote}"</p>
                        )}
                      </div>
                    )}

                    {exchange.status === 'denied' && (
                      <div className="text-xs text-red-600">
                        Swap not approved.{exchange.managerNote ? ` "${exchange.managerNote}"` : ' You may propose another colleague.'}
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
                              <div key={r.employee?._id} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: r.employee?.color || '#22c55e' }}
                                  >
                                    {r.employee?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span className="text-xs font-medium text-gray-800">{r.employee?.name}</span>
                                  {/* Employee proposes; admin directly approves */}
                                  {!isAdmin && (
                                    <button
                                      onClick={() => handlePropose(exchange._id, r.employee._id)}
                                      disabled={!!approving}
                                      className="ml-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
                                    >
                                      {approving === exchange._id + r.employee._id ? '…' : 'Propose'}
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleManagerReview(exchange._id, 'approve')}
                                      disabled={!!approving}
                                      className="ml-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
                                    >
                                      {approving === exchange._id + 'approve' ? '…' : 'Approve'}
                                    </button>
                                  )}
                                </div>
                                {r.availableDates?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.availableDates.map((d) => (
                                      <span key={d} className="text-[10px] bg-white text-green-700 border border-green-300 px-1.5 py-0.5 rounded">
                                        {format(parseISO(d + 'T00:00:00'), 'MMM d')}
                                      </span>
                                    ))}
                                  </div>
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

// ── Overview tab (admin / manager / charge RN only) ───────────────────────────
function OverviewTab({ user }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next, etc.
  const [weekShifts, setWeekShifts] = useState([]);
  const [loadingWeek, setLoadingWeek] = useState(true);

  const baseWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    setLoadingWeek(true);
    schedulesAPI.getShifts({
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
    }).then((res) => setWeekShifts(res.data || []))
      .finally(() => setLoadingWeek(false));
  }, [weekOffset]);

  // Build map: date → position → count
  const weekMap = {};
  const positionSet = new Set();
  weekShifts.forEach((shift) => {
    const pos = shift.position || shift.employee?.position || 'Unassigned';
    positionSet.add(pos);
    if (!weekMap[shift.date]) weekMap[shift.date] = {};
    weekMap[shift.date][pos] = (weekMap[shift.date][pos] || 0) + 1;
  });
  const positions = Array.from(positionSet).sort();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Staff Working</p>
            <p className="text-xs text-gray-400">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((n) => n - 1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekOffset((n) => n + 1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loadingWeek ? (
        <div className="p-4 space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
              {[1,2,3,4,5,6,7].map((j) => <div key={j} className="h-6 w-6 rounded-full bg-gray-200 animate-pulse flex-1" />)}
            </div>
          ))}
        </div>
      ) : positions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No shifts scheduled this week</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 w-32">Position</th>
                {weekDays.map((d) => {
                  const str = format(d, 'yyyy-MM-dd');
                  const isToday = str === today;
                  return (
                    <th key={str} className={`text-center px-2 py-2.5 font-semibold min-w-[52px] ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                      <div>{format(d, 'EEE')}</div>
                      <div className={`text-[10px] font-normal ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>{format(d, 'M/d')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {positions.map((pos) => (
                <tr key={pos} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{pos}</td>
                  {weekDays.map((d) => {
                    const str = format(d, 'yyyy-MM-dd');
                    const isToday = str === today;
                    const count = (weekMap[str] && weekMap[str][pos]) || 0;
                    return (
                      <td key={str} className={`text-center px-2 py-2.5 ${isToday ? 'bg-blue-50' : ''}`}>
                        {count === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                            ${count >= 3 ? 'bg-green-100 text-green-700' : count === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                            {count}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
}

function expiryColor(days) {
  if (days === null) return null;
  if (days < 0)   return 'bg-red-100 text-red-700 border-red-200';
  if (days <= 7)  return 'bg-red-100 text-red-700 border-red-200';
  if (days <= 14) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (days <= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
  return null; // don't show if plenty of time
}

function expiryLabel(days) {
  if (days === null) return '';
  if (days < 0)  return 'Expired';
  if (days === 0) return 'Expires today';
  return `${days}d`;
}

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [expiryItems, setExpiryItems] = useState([]);

  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role);
  const tabs = ALL_TABS.filter((t) => !t.privileged || isPrivileged);

  const [activeTab, setActiveTab] = useState(() => isPrivileged ? 'overview' : 'shiftexchange');
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [pendingExchanges, setPendingExchanges] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    Promise.all([
      timeCorrectionAPI.getAll({ status: 'pending' }),
      schedulesAPI.getTimeOff({ status: 'pending' }),
      exchangeAPI.getAll(),
      profileAPI.get(),
    ])
      .then(([corrRes, toRes, exchRes, profileRes]) => {
        setPendingCorrections(corrRes.data.length);
        setPendingTimeOff(toRes.data.length);
        const exchData = exchRes.data;
        const openCount = isAdmin
          ? (exchData.requests || []).filter((e) => e.status === 'open').length
          : (exchData.available || []).length;
        setPendingExchanges(openCount);

        const p = profileRes.data;
        const items = [
          { label: 'License', expiry: p.licenseExpiry },
          { label: 'BLS/CPR', expiry: p.blsCprExpiry },
          ...(p.certifications || []).map((c) => ({ label: c.name, expiry: c.expiry })),
        ]
          .filter((item) => item.expiry)
          .map((item) => ({ ...item, days: daysUntil(item.expiry) }))
          .filter((item) => item.days !== null && item.days <= 60)
          .sort((a, b) => a.days - b.days);
        setExpiryItems(items);
      })
      .finally(() => setLoading(false));
  }, []);

  // Real-time badge update when a new exchange request comes in
  useEffect(() => {
    if (!socket) return;
    const handler = () => setPendingExchanges((n) => n + 1);
    socket.on('shiftExchangeNew', handler);
    return () => socket.off('shiftExchangeNew', handler);
  }, [socket]);

  // Clear exchange badge when user opens the tab
  useEffect(() => {
    if (activeTab === 'shiftexchange') setPendingExchanges(0);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2 mt-6">
          {[1,2,3].map((i) => <div key={i} className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 mt-4">
          {[1,2,3,4].map((i) => <div key={i} className="flex gap-3 items-center"><div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" /><div className="flex-1 space-y-2"><div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" /><div className="h-3 w-20 bg-gray-200 rounded animate-pulse" /></div></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Profile card + greeting */}
      <Link to="/profile" className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-5 py-4 mb-5 hover:shadow-md transition-shadow group">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: user?.color || '#3B82F6' }}
        >
          {user?.avatar
            ? <img src={user.avatar} alt="avatar" className="w-14 h-14 rounded-full object-cover" />
            : user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
            {user?.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</span>
            {user?.position && <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{user.position}</span>
            </>}
            {user?.department && <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">{user.department}</span>
            </>}
          </div>
          {expiryItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {expiryItems.map((item, i) => {
                const cls = expiryColor(item.days);
                if (!cls) return null;
                return (
                  <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
                    {item.label}: {expiryLabel(item.days)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <UserCircle className="h-4 w-4" />
          <span className="hidden sm:inline">View Profile</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {tabs.map(({ key, label }) => (
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
            {key === 'shiftexchange' && pendingExchanges > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingExchanges}
              </span>
            )}
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

      {/* Tab content — key forces remount + fade-in on tab change */}
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab user={user} />}
        {activeTab === 'shiftexchange' && <ShiftExchangeTab user={user} />}
        {activeTab === 'timeoff' && <TimeOffTab user={user} />}
        {activeTab === 'timecorrection' && <TimeCorrectionTab user={user} />}
      </div>
    </div>
  );
}
