import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSignIn } from '../features/auth/authHooks';

export default function LoginPage() {
  const { login, loading, error } = useSignIn();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); try { await login({ email, password }); window.location.assign('/'); } catch { /* Error is shown below the form. */ } }
  return <div className="auth-shell"><section className="auth-card"><div className="section-kicker">PRIVATE RESEARCH WORKSPACE</div><h1>Welcome back</h1><p>Sign in to access your saved papers and projects.</p><form onSubmit={submit}><label className="form-label">Email<input required type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)}/></label><label className="form-label">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)}/></label>{error&&<div className="alert" role="alert">{error}</div>}<button className="button primary auth-submit" disabled={loading}>{loading?'Signing in':'Sign in'} <ArrowRight size={15}/></button></form><small className="auth-note">The API and MongoDB must be configured to sign in.</small></section></div>;
}
