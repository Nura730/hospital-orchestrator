/**
 * @file client.js
 * Axios HTTP client instance with authentication and envelope unwrapping interceptors.
 */

import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: inject JWT Bearer token
apiClient.interceptors.request.use(
  (config) => {
    try {
      const storedAuth = sessionStorage.getItem('mediorchestra_auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        const token = parsed?.state?.token || parsed?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: unwrap envelope and handle 401
apiClient.interceptors.response.use(
  (response) => {
    // If backend returns standard envelope { ok: true, data: ..., error: null }
    if (response.data && typeof response.data === 'object' && 'ok' in response.data) {
      if (!response.data.ok) {
        return Promise.reject(new Error(response.data.error || 'Server reported request failure'));
      }
      return response.data; // returns { ok: true, data: ..., error: null }
    }
    // Plain payload
    return { ok: true, data: response.data, error: null };
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Unauthorized: clear cached auth state
      sessionStorage.removeItem('mediorchestra_auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Network communication error';

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
