import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  getGoogleAuthUrl: () => api.get('/auth/google'),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const gmailApi = {
  sync: () => api.post('/gmail/sync'),
  status: () => api.get('/gmail/status'),
};

export const emailsApi = {
  list: (params?: Record<string, unknown>) => api.get('/emails', { params }),
  get: (id: string) => api.get(`/emails/${id}`),
  getThread: (id: string) => api.get(`/emails/threads/${id}`),
};

export const summaryApi = {
  email: (id: string) => api.get(`/summary/emails/${id}/summary`),
  thread: (id: string) => api.get(`/summary/threads/${id}/summary`),
};

export const composeApi = {
  compose: (data: { prompt: string; to?: string; send?: boolean }) =>
    api.post('/compose', data),
  reply: (data: {
    emailId?: string;
    threadId?: string;
    instruction: string;
    send?: boolean;
    to?: string;
  }) => api.post('/reply', data),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
};

export const chatApi = {
  send: (data: { message: string; sessionId?: string }) => api.post('/chat', data),
  sessions: () => api.get('/chat/sessions'),
  getSession: (id: string) => api.get(`/chat/sessions/${id}`),
};

export const newsletterApi = {
  digest: (days?: number) => api.get('/newsletter/digest', { params: { days } }),
};
