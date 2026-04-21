import { useState, useEffect } from 'react';
import { Megaphone, Pin, Trash2, Plus, X, ChevronDown } from 'lucide-react';
import { announcementsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];
const ALL_ROLES = ['admin', 'manager', 'charge_nurse', 'employee'];

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', targetRoles: [], pinned: false });
  const [saving, setSaving] = useState(false);

  const isPrivileged = PRIVILEGED.includes(user?.role);

  useEffect(() => {
    announcementsAPI.getAll()
      .then((res) => setAnnouncements(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.body) return;
    setSaving(true);
    try {
      const res = await announcementsAPI.create(form);
      setAnnouncements((prev) => [res.data, ...prev]);
      setForm({ title: '', body: '', targetRoles: [], pinned: false });
      setShowForm(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handlePin = async (id, pinned) => {
    try {
      const res = await announcementsAPI.pin(id, !pinned);
      setAnnouncements((prev) => prev.map((a) => a._id === id ? res.data : a).sort((a, b) => b.pinned - a.pinned || new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await announcementsAPI.delete(id);
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
    } catch (err) { console.error(err); }
  };

  const toggleRole = (role) => {
    setForm((f) => ({
      ...f,
      targetRoles: f.targetRoles.includes(role) ? f.targetRoles.filter((r) => r !== role) : [...f.targetRoles, role],
    }));
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-blue-600" /> Announcements
        </h1>
        {isPrivileged && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'New'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3 animate-fade-in">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title *" className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Message *" className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Send to (leave empty for all):</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button key={role} onClick={() => toggleRole(role)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${form.targetRoles.includes(role) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'}`}>
                  {role.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
              Pin to top
            </label>
            <button onClick={handleCreate} disabled={saving || !form.title || !form.body}
              className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading...</div>}

      {!loading && announcements.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No announcements yet.</p>
        </div>
      )}

      {announcements.map((ann) => (
        <div key={ann._id} className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm p-4 space-y-2 ${ann.pinned ? 'border-blue-300 dark:border-blue-700' : 'border-gray-100 dark:border-gray-700'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {ann.pinned && <Pin className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{ann.title}</h3>
            </div>
            {isPrivileged && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handlePin(ann._id, ann.pinned)} className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title={ann.pinned ? 'Unpin' : 'Pin'}>
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(ann._id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ann.body}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: ann.createdBy?.color || '#3B82F6' }}>
              {ann.createdBy?.name?.[0]}
            </div>
            <span>{ann.createdBy?.name}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}</span>
            {ann.targetRoles?.length > 0 && <span className="ml-auto">→ {ann.targetRoles.map((r) => r.replace('_', ' ')).join(', ')}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
