import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? children : <section className="panel"><h2>Sign in required</h2><p>Log in to access your saved research.</p><a className="button primary" href="/login">Go to sign in</a></section>;
}
