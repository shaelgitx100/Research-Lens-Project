import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSignIn } from '../features/auth/authHooks';

export default function RegisterPage() {
  const { register, loading, error } = useSignIn();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); try { await register({ name, email, password }); window.location.assign('/'); } catch { /* Error is shown below the form. */ } }
  return <div className="auth-shell"><section className="auth-card"><div className="section-kicker">START YOUR RESEARCH WORKSPACE</div><h1>Create an account</h1><p>Save papers, projects, and analysis in your private workspace.</p><form onSubmit={submit}><label className="form-label">Name<input required autoComplete="name" maxLength={100} value={name} onChange={(event)=>setName(event.target.value)}/></label><label className="form-label">Email<input required type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)}/></label><label className="form-label">Password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event)=>setPassword(event.target.value)}/></label>{error&&<div className="alert" role="alert">{error}</div>}<button className="button primary auth-submit" disabled={loading}>{loading?'Creating account':'Create account'} <ArrowRight size={15}/></button></form></section></div>;
}
