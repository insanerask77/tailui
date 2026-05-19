import { create } from 'zustand';

interface AuthState {
  username: string | null;
  setUser: (username: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  username: null,
  setUser: (username) => set({ username }),
  logout: async () => {
    await fetch('/auth/logout', { method: 'POST' });
    set({ username: null });
  },
}));
