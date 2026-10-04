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
      // Ignore sessionStorage parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** Backend errors arrive as { error: { code, message } }; older handlers send a plain string. */
function errorMessage(body) {
  const e = body?.error;
  if (typeof e === 'string') return e;
  return e?.message || body?.message || null;
}

/** Error that keeps the server's error code and HTTP status for callers that need them. */
function apiError(message, body, status) {
  const err = new Error(message);
  err.code = body?.error?.code || null;
  err.status = status ?? null;
  return err;
}

// Response interceptor: unwrap envelope and handle 401
apiClient.interceptors.response.use(
  (response) => {
    // If backend returns standard envelope { ok: true, data: ..., error: null }
    if (response.data && typeof response.data === 'object' && 'ok' in response.data) {
      if (!response.data.ok) {
        return Promise.reject(apiError(errorMessage(response.data) || 'Server reported request failure', response.data, response.status));
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

    const message = errorMessage(error.response?.data) || error.message || 'Network communication error';
    return Promise.reject(apiError(message, error.response?.data, error.response?.status));
  }
);

export default apiClient;
