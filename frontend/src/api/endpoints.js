import api from './client';

export const authApi = {
  profile: () => api.get('/auth/profile'),
  users: () => api.get('/auth/users'),
};

export const uploadApi = {
  preview: (formData) => api.post('/upload/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  create: (formData) => api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params) => api.get('/upload', { params }),
  status: (jobId) => api.get(`/upload/${jobId}`),
};

export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', { params }),
  filters: () => api.get('/dashboard/filters'),
};

export const reconciliationApi = {
  trigger: (payload) => api.post('/reconciliation/trigger', payload),
  results: (params) => api.get('/reconciliation/results', { params }),
  stats: (params) => api.get('/reconciliation/stats', { params }),
  manualCorrection: (resultId, payload) => api.patch(`/reconciliation/manual-correction/${resultId}`, payload),
};

export const auditApi = {
  recordTimeline: (recordId) => api.get(`/audit/record/${recordId}`),
  jobTimeline: (uploadJobId) => api.get(`/audit/job/${uploadJobId}`),
};
