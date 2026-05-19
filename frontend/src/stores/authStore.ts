import { create } from 'zustand';

interface AuthState {
  username: string | null;
  role: 'admin' | 'user' | null;
  namespace: string | null;
  setUser: (u: { username: string; role: 'admin' | 'user'; namespace: string | null }) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  username: null,
  role: null,
  namespace: null,
  setUser: ({ username, role, namespace }) => set({ username, role, namespace }),
  logout: async () => {
    await fetch('/auth/logout', { method: 'POST' });
    set({ username: null, role: null, namespace: null });
  },
}));
