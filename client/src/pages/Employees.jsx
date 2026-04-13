import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { messagesAPI } from '../services/api';
import { Users, Search, MessageCircle, Mail, Phone, Shield } from 'lucide-react';

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-orange-100 text-orange-700',
  employee: 'bg-gray-100 text-gray-600',
};

export default function Employees() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersAPI.getAll()
      .then((res) => setEmployees(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleMessage = async (empId) => {
    try {
      await messagesAPI.createDirect(empId);
      navigate('/messages');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (empId, role) => {
    try {
      const res = await usersAPI.updateRole(empId, role);
      setEmployees((prev) => prev.map((e) => (e._id === empId ? res.data : e)));
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.position || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Employees
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {employees.length} total · {employees.filter((e) => onlineUsers.has(e._id) || e.isOnline).length} online
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => {
          const isOnline = onlineUsers.has(emp._id) || emp.isOnline;
          const initials = emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          const isMe = emp._id === user?._id;

          return (
            <div
              key={emp._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: emp.color }}
                  >
                    {initials}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">
                      {emp.name} {isMe && <span className="text-xs text-gray-400">(you)</span>}
                    </p>
                  </div>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${ROLE_COLORS[emp.role]}`}>
                    {emp.role}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {emp.position && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="h-3.5 w-3.5 text-gray-400" />
                    <span>{emp.position}{emp.department ? ` · ${emp.department}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <span className="truncate">{emp.email}</span>
                </div>
                {emp.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{emp.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                  {isOnline ? '● Online' : '○ Offline'}
                </span>
                <div className="flex gap-2">
                  {isAdmin && !isMe && (
                    <select
                      value={emp.role}
                      onChange={(e) => handleRoleChange(emp._id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {!isMe && (
                    <button
                      onClick={() => handleMessage(emp._id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
