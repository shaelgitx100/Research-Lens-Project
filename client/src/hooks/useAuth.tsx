import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthCtx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>; setUser: (u: User) => void;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function applyTheme(t: string) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('rlTheme', t); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const setUser = useCallback((u: User) => { setUserState(u); applyTheme(u.preferences?.theme || 'dark'); }, []);

  useEffect(() => {
    applyTheme(localStorage.getItem('rlTheme') || 'dark');
    api.get<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => setUserState(null)).finally(() => setLoading(false));
  }, [setUser]);

  const value: AuthCtx = {
    user, loading, setUser,
    login: async (email, password) => setUser((await api.post<{ user: User }>('/auth/login', { email, password })).user),
    register: async (name, email, password, role) => setUser((await api.post<{ user: User }>('/auth/register', { name, email, password, role })).user),
    logout: async () => { await api.post('/auth/logout'); setUserState(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
