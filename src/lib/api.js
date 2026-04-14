import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const saved = localStorage.getItem('core_gym_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global suspension and session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response;
      
      // Don't intercept for login/register/reset paths
      const isAuthPath = config.url.includes('/auth/login') || 
                        config.url.includes('/auth/register') || 
                        config.url.includes('/auth/forgot-password');

      if (!isAuthPath) {
        if (status === 403 && data?.isSuspended) {
          localStorage.removeItem('core_gym_user');
          window.location.href = '/login?suspended=1';
        } else if (status === 401) {
          localStorage.removeItem('core_gym_user');
          window.location.href = '/login?expired=1';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
