import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AuthSession } from '../types';
import { clearSession, readSession, saveSession } from '../services/storage';

interface AuthContextValue { session: AuthSession | null; signIn(session: AuthSession): void; signOut(): void }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const value = useMemo<AuthContextValue>(() => ({
    session,
    signIn(next) { saveSession(next); setSession(next); },
    signOut() { clearSession(); setSession(null); },
  }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
