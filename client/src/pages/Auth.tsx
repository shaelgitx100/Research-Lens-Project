import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Field } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const pwErr = (v: string) => (v.length < 10 ? 'Use at least 10 characters.' : !/[A-Za-z]/.test(v) ? 'Include a letter.' : !/\d/.test(v) ? 'Include a number.' : '');

const Shell = ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
  <main className="mx-auto flex max-w-md flex-col px-4 py-14"><div className="card p-6 fadeUp"><h1 className="text-2xl">{title}</h1><div className="mt-5">{children}</div></div>{footer && <p className="mt-4 text-center text-sm text-muted">{footer}</p>}</main>
);
const Err = ({ m }: { m: string }) => (m ? <p role="alert" className="text-sm text-bad">{m}</p> : null);

export function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation() as any;
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!emailOk(email)) return setErr('Enter a valid email address.'); if (!password) return setErr('Enter your password.');
    setBusy(true); setErr('');
    try { await login(email.trim(), password); nav(loc.state?.from?.startsWith('/app') ? loc.state.from : '/app', { replace: true }); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Sign in" footer={<>New to ResearchLens? <Link className="link" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email"><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Err m={err} /><button className="btnPrimary w-full" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
        <div className="text-center text-sm"><Link className="link" to="/forgot">Forgot your password?</Link></div>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr('Enter your name.'); if (!emailOk(f.email)) return setErr('Enter a valid email address.'); const p = pwErr(f.password); if (p) return setErr(p);
    setBusy(true); setErr('');
    try { await register(f.name.trim(), f.email.trim(), f.password, f.role); nav('/app', { replace: true }); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" footer={<>Already registered? <Link className="link" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name"><input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Password" hint="At least 10 characters with a letter and a number."><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <Field label="I am a"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="student">Student</option><option value="researcher">Researcher</option><option value="supervisor">Supervisor</option></select></Field>
        <Err m={err} /><button className="btnPrimary w-full" disabled={busy}>{busy ? 'Creating account' : 'Create account'}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!emailOk(email)) return setErr('Enter a valid email address.'); setErr(''); try { setMsg((await api.post<{ message: string }>('/auth/forgot', { email: email.trim() })).message); } catch (x: any) { setErr(x.message); } };
  return (
    <Shell title="Reset your password" footer={<Link className="link" to="/login">Back to sign in</Link>}>
      {msg ? <p className="text-sm text-good">{msg}</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate><Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Err m={err} /><button className="btnPrimary w-full">Send reset link</button></form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const { token } = useParams(); const nav = useNavigate();
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); const p = pwErr(pw); if (p) return setErr(p); try { await api.post('/auth/reset', { token, password: pw }); setDone(true); setTimeout(() => nav('/login'), 1500); } catch (x: any) { setErr(x.message); } };
  return (
    <Shell title="Choose a new password">
      {done ? <p className="text-sm text-good">Password updated. Redirecting to sign in.</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate><Field label="New password" hint="At least 10 characters with a letter and a number."><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field><Err m={err} /><button className="btnPrimary w-full">Update password</button></form>
      )}
    </Shell>
  );
}
