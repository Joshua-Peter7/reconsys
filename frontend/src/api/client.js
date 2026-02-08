import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_API_BASE_URL. Set it in frontend/.env');
}

const api = axios.create({
  baseURL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('recons.auth');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch {
      // Ignore malformed localStorage entries.
    }
  }
  return config;
});

export default api;
