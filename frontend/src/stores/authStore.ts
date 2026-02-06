import { create } from 'zustand';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  user: { user_id: number; username: string; display_name?: string; role: string } | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { username, password });
    localStorage.setItem('token', data.access_token);
    set({ token: data.access_token, isAuthenticated: true });
    await get().fetchMe();
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await apiClient.get('/auth/me');
      set({ user: data });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('token');
    }
  },

  initialize: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      await get().fetchMe();
    }
  },
}));
