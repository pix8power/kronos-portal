import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { notificationsAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';

const TYPE_COLORS = {
  shift_assigned: 'bg-blue-100 text-blue-600',
  shift_deleted: 'bg-red-100 text-red-600',
  timeoff_approved: 'bg-green-100 text-green-600',
  timeoff_denied: 'bg-red-100 text-red-600',
  exchange_response: 'bg-yellow-100 text-yellow-600',
  exchange_approved: 'bg-green-100 text-green-600',
  message: 'bg-purple-100 text-purple-600',
};

export default function NotificationBell() {
  const { getSocket } = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const dropRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time new notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnread((n) => n + 1);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [getSocket]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = async () => {
    setOpen((v) => !v);
  };

  const handleRead = async (notif) => {
    if (!notif.read) {
      await notificationsAPI.markRead(notif._id);
      setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, read: true } : n));
      setUnread((c) => Math.max(0, c - 1));
    }
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  const handleMarkAll = async () => {
    await notificationsAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div ref={dropRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleRead(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
