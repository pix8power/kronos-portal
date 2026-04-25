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
  async (err) => {
    const config = err.config;
    // Retry network errors (no response) up to 2 times, with backoff
    if (!err.response && config && !config._retryCount) {
      config._retryCount = 0;
    }
    if (!err.response && config && config._retryCount < 2) {
      config._retryCount += 1;
      await new Promise((r) => setTimeout(r, 500 * config._retryCount));
      return api(config);
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('session-expired'));
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  changePasswordFirst: (data) => api.post('/auth/change-password-first', data),
};

export const usersAPI = {
  getAll: () => api.get('/users'),
  search: (q) => api.get('/users/search', { params: { q } }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  delete: (id) => api.delete(`/users/${id}`),
};

export const schedulesAPI = {
  getShifts: (params) => api.get('/schedules/shifts', { params }),
  createShift: (data) => api.post('/schedules/shifts', data),
  createShiftsBulk: (data) => api.post('/schedules/shifts/bulk', data),
  updateShift: (id, data) => api.put(`/schedules/shifts/${id}`, data),
  deleteShift: (id) => api.delete(`/schedules/shifts/${id}`),
getTimeOff: (params) => api.get('/schedules/timeoff', { params }),
  requestTimeOff: (data) => api.post('/schedules/timeoff', data),
  reviewTimeOff: (id, data) => api.patch(`/schedules/timeoff/${id}`, data),
  deleteTimeOff: (id) => api.delete(`/schedules/timeoff/${id}`),
  getAvailability: (params) => api.get('/schedules/availability', { params }),
  addAvailability: (data) => api.post('/schedules/availability', data),
  removeAvailability: (id) => api.delete(`/schedules/availability/${id}`),
  getRecurringUnavailability: () => api.get('/schedules/recurring-unavailability'),
  addRecurringUnavailability: (data) => api.post('/schedules/recurring-unavailability', data),
  removeRecurringUnavailability: (id) => api.delete(`/schedules/recurring-unavailability/${id}`),
  getAuditLog: (params) => api.get('/schedules/audit', { params }),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  createDirect: (userId) => api.post('/messages/conversations/direct', { userId }),
  createGroup: (data) => api.post('/messages/conversations/group', data),
  getMessages: (convId, page = 1) =>
    api.get(`/messages/conversations/${convId}/messages`, { params: { page } }),
  sendMessage: (convId, data) => api.post(`/messages/conversations/${convId}/messages`, data),
  deleteMessage: (id) => api.delete(`/messages/messages/${id}`),
  getUnreadCount: () => api.get('/messages/unread-count'),
  markAllRead: () => api.post('/messages/mark-all-read'),
  pinConversation: (id) => api.patch(`/messages/conversations/${id}/pin`),
  deleteConversation: (id) => api.delete(`/messages/conversations/${id}`),
};

export const exchangeAPI = {
  getAll: () => api.get('/schedules/exchanges'),
  create: (data) => api.post('/schedules/exchanges', data),
  respond: (id, data) => api.post(`/schedules/exchanges/${id}/respond`, data),
  propose: (id, data) => api.post(`/schedules/exchanges/${id}/propose`, data),
  review: (id, data) => api.patch(`/schedules/exchanges/${id}`, data),
  cancel: (id) => api.delete(`/schedules/exchanges/${id}`),
};

export const masterScheduleAPI = {
  get: () => api.get('/master-schedule'),
  create: (data) => api.post('/master-schedule', data),
  update: (id, data) => api.patch(`/master-schedule/${id}`, data),
  addEntry: (id, data) => api.post(`/master-schedule/${id}/entries`, data),
  removeEntry: (id, entryId) => api.delete(`/master-schedule/${id}/entries/${entryId}`),
  apply: (id, data) => api.post(`/master-schedule/${id}/apply`, data),
};

export const timeCorrectionAPI = {
  getAll: (params) => api.get('/timecorrections', { params }),
  submit: (data) => api.post('/timecorrections', data),
  review: (id, data) => api.patch(`/timecorrections/${id}`, data),
  delete: (id) => api.delete(`/timecorrections/${id}`),
};

export const announcementsAPI = {
  getAll: () => api.get('/announcements'),
  create: (data) => api.post('/announcements', data),
  pin: (id, pinned) => api.patch(`/announcements/${id}/pin`, { pinned }),
  delete: (id) => api.delete(`/announcements/${id}`),
};

export const openShiftsAPI = {
  getAll: (params) => api.get('/open-shifts', { params }),
  create: (data) => api.post('/open-shifts', data),
  claim: (id) => api.post(`/open-shifts/${id}/claim`),
  approve: (id, employeeId) => api.patch(`/open-shifts/${id}/approve`, { employeeId }),
  cancel: (id) => api.delete(`/open-shifts/${id}`),
};

export const recurringShiftsAPI = {
  getAll: () => api.get('/recurring-shifts'),
  create: (data) => api.post('/recurring-shifts', data),
  generate: (data) => api.post('/recurring-shifts/generate', data),
  delete: (id) => api.delete(`/recurring-shifts/${id}`),
};

export const profileAPI = {
  get: () => api.get('/profile'),
  getById: (id) => api.get(`/profile/${id}`),
  update: (data) => api.patch('/profile', data),
  uploadDocument: (formData) => api.post('/profile/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (filename) => api.delete(`/profile/documents/${filename}`),
  getIcalToken: () => api.get('/profile/ical-token'),
};

export const webAuthnAPI = {
  getRegisterOptions: () => api.get('/webauthn/register-options'),
  register: (data) => api.post('/webauthn/register', data),
  getAuthOptions: () => api.get('/webauthn/auth-options'),
  verify: (data) => api.post('/webauthn/verify', data),
  getCredentials: () => api.get('/webauthn/credentials'),
  deleteCredential: (id) => api.delete(`/webauthn/credentials/${id}`),
};

export default api;
