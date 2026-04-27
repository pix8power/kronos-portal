import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const ACTIVE_DEPT_KEY = 'kronos_active_dept';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [activeDepartment, setActiveDepartmentState] = useState(
    () => localStorage.getItem(ACTIVE_DEPT_KEY) || null
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI
        .me()
        .then((res) => {
          const u = res.data.user;
          setUser(u);
          // On first load, default active dept to user's primary department
          const stored = localStorage.getItem(ACTIVE_DEPT_KEY);
          if (!stored && u.department) {
            setActiveDepartmentState(u.department);
            localStorage.setItem(ACTIVE_DEPT_KEY, u.department);
          }
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setActiveDepartment = (dept) => {
    setActiveDepartmentState(dept);
    if (dept) {
      localStorage.setItem(ACTIVE_DEPT_KEY, dept);
    } else {
      localStorage.removeItem(ACTIVE_DEPT_KEY);
    }
  };

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('token', res.data.token);
    const u = res.data.user;
    setUser(u);
    if (res.data.mustChangePassword) setMustChangePassword(true);
    if (u.department) setActiveDepartment(u.department);
    return u;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    localStorage.setItem('token', res.data.token);
    const u = res.data.user;
    setUser(u);
    if (u.department) {
      setActiveDepartment(u.department);
    }
    return u;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('token');
    localStorage.removeItem(ACTIVE_DEPT_KEY);
    setUser(null);
    setActiveDepartmentState(null);
    setMustChangePassword(false);
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const next = { ...prev, ...data };
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, activeDepartment, setActiveDepartment, mustChangePassword, setMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
