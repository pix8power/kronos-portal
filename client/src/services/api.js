import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  delete: (id) => api.delete(`/users/${id}`),
};

export const schedulesAPI = {
  getShifts: (params) => api.get('/schedules/shifts', { params }),
  createShift: (data) => api.post('/schedules/shifts', data),
  updateShift: (id, data) => api.put(`/schedules/shifts/${id}`, data),
  deleteShift: (id) => api.delete(`/schedules/shifts/${id}`),
  getTimeOff: () => api.get('/schedules/timeoff'),
  requestTimeOff: (data) => api.post('/schedules/timeoff', data),
  reviewTimeOff: (id, data) => api.patch(`/schedules/timeoff/${id}`, data),
};

export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  createDirect: (userId) => api.post('/messages/conversations/direct', { userId }),
  createGroup: (data) => api.post('/messages/conversations/group', data),
  getMessages: (convId, page = 1) =>
    api.get(`/messages/conversations/${convId}/messages`, { params: { page } }),
  sendMessage: (convId, data) => api.post(`/messages/conversations/${convId}/messages`, data),
  deleteMessage: (id) => api.delete(`/messages/messages/${id}`),
};

export const timeCorrectionAPI = {
  getAll: (params) => api.get('/timecorrections', { params }),
  submit: (data) => api.post('/timecorrections', data),
  review: (id, data) => api.patch(`/timecorrections/${id}`, data),
  delete: (id) => api.delete(`/timecorrections/${id}`),
};

export default api;
