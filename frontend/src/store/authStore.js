import { create } from 'zustand';
import * as authService from '../services/authService';
import { hasSessionHintCookie } from '../services/apiClient';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  initialized: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.login(email, password);
      set({
        user: data.user,
        isAuthenticated: true,
        loading: false,
        initialized: true,
      });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.register(email, password);
      set({
        user: data.user,
        isAuthenticated: true,
        loading: false,
        initialized: true,
      });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: async () => {
    await authService.logout();
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
      initialized: true,
      error: null,
    });
  },

  restoreSession: async () => {
    if (!hasSessionHintCookie()) {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        initialized: true,
        error: null,
      });
      return;
    }

    set({ loading: true });
    try {
      const data = await authService.getMe({ authFailureMode: 'silent' });
      set({
        user: data.user,
        isAuthenticated: true,
        loading: false,
        initialized: true,
      });
    } catch (err) {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        initialized: true,
        error: err.status === 401 ? null : err.message,
      });
    }
  },

  isAdmin: () => get().user?.role === 'admin',
  isBanned: () => get().user?.isBanned === true,
}));

export default useAuthStore;
