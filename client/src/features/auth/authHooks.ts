import { useState } from 'react';
import { authApi } from './authApi';
import type { Credentials, Registration } from './authTypes';
import { useAuth } from '../../contexts/AuthContext';

export function useSignIn() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function login(values: Credentials) {
    setLoading(true); setError(null);
    try { const session = await authApi.login(values); signIn(session); return session; }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Unable to sign in.'; setError(message); throw cause; }
    finally { setLoading(false); }
  }
  async function register(values: Registration) {
    setLoading(true); setError(null);
    try { const session = await authApi.register(values); signIn(session); return session; }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Unable to create account.'; setError(message); throw cause; }
    finally { setLoading(false); }
  }
  return { login, register, loading, error, clearError: () => setError(null) };
}
