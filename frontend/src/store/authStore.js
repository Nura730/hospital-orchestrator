/**
 * @file authStore.js
 * Zustand store for user authentication, roles, and persisted session tokens.
 */

import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, getMe as apiGetMe } from '../api/endpoints.js';
import { ROLES, DEFAULT_USERS } from '../utils/roles.js';

const STORAGE_KEY = 'mediorchestra_auth';

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.token && data.user) {
        return {
          user: data.user,
          token: data.token,
          role: data.user.role || data.user.userType || data.user.user_type || data.role || ROLES.ADMIN,
          isAuthenticated: true,
        };
      }
    }
  } catch (err) {
    console.error('Failed to parse cached auth state:', err);
  }

  // Real backend: start signed out (a fake mock token would only produce 401s)
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  const isMock = env.VITE_USE_MOCK !== undefined ? env.VITE_USE_MOCK !== 'false' : true;
  if (!isMock) {
    return { user: null, token: null, role: null, isAuthenticated: false };
  }

  // Mock mode: default demo admin for a smooth offline experience
  const defaultAdmin = DEFAULT_USERS.admin;
  return {
    user: defaultAdmin,
    token: 'mock-jwt-token-admin',
    role: defaultAdmin.role,
    isAuthenticated: true,
  };
}

export const useAuthStore = create((set, get) => ({
  ...loadInitialState(),
  loading: false,
  error: null,

  /**
   * Log in user with credentials or demo role.
   */
  login: async ({ email, password, role }) => {
    set({ loading: true, error: null });
    try {
      const res = await apiLogin({ email, password, role });
      if (!res.ok) {
        throw new Error(res.error || 'Authentication failed');
      }

      const { user, token } = res.data;
      const stateToSave = {
        user,
        token,
        // Backend profiles carry user_type; mock users carry role
        role: user.role || user.userType || user.user_type || res.data.userType || role || ROLES.ADMIN,
        isAuthenticated: true,
        loading: false,
        error: null,
      };

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user, token, role: stateToSave.role })
        );
      } catch (e) {
        console.warn('Could not persist auth to localStorage', e);
      }

      set(stateToSave);
      return { success: true, user };
    } catch (err) {
      set({ error: err.message, loading: false });
      return { success: false, error: err.message };
    }
  },

  /**
   * Fast demo login switch by role identifier.
   */
  loginAsDemo: async (roleKey) => {
    const demoUser = DEFAULT_USERS[roleKey] || DEFAULT_USERS.admin;
    return get().login({
      // Seeded backend credentials when available (mock mode accepts anything)
      email: demoUser.backendEmail || demoUser.email,
      password: demoUser.demoPassword || 'password123',
      role: demoUser.role,
    });
  },

  /**
   * Log out active session.
   */
  logout: async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem(STORAGE_KEY);
    set({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  /**
   * Refresh current profile from backend.
   */
  fetchMe: async () => {
    if (!get().token) return;
    try {
      const res = await apiGetMe();
      if (res.ok && res.data) {
        set({ user: res.data, role: res.data.role || res.data.user_type || get().role });
      }
    } catch (err) {
      console.warn('Failed to refresh profile:', err.message);
    }
  },
}));
