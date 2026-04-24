import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarRange,
  MessageCircle,
  Users,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  ShieldCheck,
  Sun,
  Moon,
  Megaphone,
  UserCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import ProfileModal from './ProfileModal';
import NotificationBell from './NotificationBell';

const MASTER_SCHEDULE_ROLES = ['admin', 'manager', 'charge_nurse'];
const AUDIT_LOG_ROLES = ['admin', 'manager'];
const STAFF_ROLES = ['admin', 'manager', 'charge_nurse'];

const baseNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { activeDepartment, setActiveDepartment } = useAuth();
  const { unreadMessages, clearUnreadMessages, unreadNotifications, clearUnreadNotifications } = useSocket();
  const { dark, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef(null);

  // Clear badges when on the relevant page
  useEffect(() => {
    if (location.pathname === '/messages' && unreadMessages > 0) clearUnreadMessages();
  }, [location.pathname, unreadMessages, clearUnreadMessages]);

  useEffect(() => {
    if (location.pathname === '/' && unreadNotifications > 0) clearUnreadNotifications();
  }, [location.pathname, unreadNotifications, clearUnreadNotifications]);

  // Close dept dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (deptRef.current && !deptRef.current.contains(e.target)) setDeptOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isMultiDept = (user?.departments?.length > 1) || user?.role === 'admin';

  const navItems = [
    ...baseNavItems,
    ...(STAFF_ROLES.includes(user?.role) ? [{ to: '/employees', label: 'Staff', icon: Users }] : []),
    ...(MASTER_SCHEDULE_ROLES.includes(user?.role) ? [{ to: '/master-schedule', label: 'Master Schedule', icon: CalendarRange }] : []),
    ...(AUDIT_LOG_ROLES.includes(user?.role) ? [{ to: '/audit-log', label: 'Audit Log', icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="px-4 mx-auto">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-500 dark:text-blue-400">
            <img src="/icon-192.png" alt="Kronos" className="h-7 w-7 rounded-full" />
            <span>KronosPortal</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {to === '/messages' && unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
                {to === '/' && unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            {/* Department switcher — shown for managers/admins with multiple depts */}
            {isMultiDept && (
              <div ref={deptRef} className="relative">
                <button
                  onClick={() => setDeptOpen(!deptOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{activeDepartment || 'All Departments'}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                {deptOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                    <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch Department</p>
                    <button
                      onClick={() => { setActiveDepartment(null); setDeptOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${!activeDepartment ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                    >
                      All Departments
                      {!activeDepartment && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                    </button>
                    {(user?.departments?.length > 0 ? user.departments : [user?.department]).filter(Boolean).map((dept) => (
                      <button
                        key={dept}
                        onClick={() => { setActiveDepartment(dept); setDeptOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${activeDepartment === dept ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                      >
                        {dept}
                        {activeDepartment === dept && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <NotificationBell />
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors"
              title="Edit profile"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: user?.color || '#3B82F6' }}
                >
                  {initials}
                </div>
              )}
              <div className="text-sm text-left">
                <p className="font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-500 dark:text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</span>
                  {!isMultiDept && activeDepartment && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 leading-none">
                        {activeDepartment}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
            <Link
              to="/help"
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Profile modal */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                location.pathname === to
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {to === '/messages' && unreadMessages > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
              {to === '/' && unreadNotifications > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: user?.color || '#3B82F6' }}
              >
                {initials}
              </div>
            )}
            <span className="flex-1">My Profile</span>
            {activeDepartment && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {activeDepartment}
              </span>
            )}
          </button>

          {/* Mobile department switcher for managers */}
          {isMultiDept && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Department</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setActiveDepartment(null); setOpen(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!activeDepartment ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                >
                  All
                </button>
                {(user?.departments?.length > 0 ? user.departments : [user?.department]).filter(Boolean).map((dept) => (
                  <button
                    key={dept}
                    onClick={() => { setActiveDepartment(dept); setOpen(false); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${activeDepartment === dept ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Link
            to="/help"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <HelpCircle className="h-4 w-4" />
            Help & FAQ
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
