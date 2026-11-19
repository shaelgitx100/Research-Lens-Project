import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, PageHeader } from '../components/ui';
import { applyTheme, useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { User } from '../types';

const NOTIF: [string, string][] = [['paperAnalyzed', 'Paper analysis completed'], ['gapIdentified', 'Research gap identified'], ['reportGenerated', 'Report generated'], ['projectUpdated', 'Research project updated'], ['libraryUpdated', 'Literature collection updated'], ['importFailed', 'Paper import failed']];
const TABS = ['Profile', 'Account', 'Theme', 'Notifications', 'Research', 'Demo data'];

export function Settings() {
  const { user, setUser, logout } = useAuth(); const { refresh } = useProject(); const nav = useNavigate();
  const [tab, setTab] = useState('Profile'); const [msg, setMsg] = useState('');
  const [p, setP] = useState({ name: user?.name || '', institution: user?.institution || '', bio: user?.bio || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  if (!user) return null;
  const save = async (body: object, ok = 'Saved.') => { setMsg(''); try { setUser((await api.put<{ user: User }>('/auth/profile', body)).user); setMsg(ok); } catch (e: any) { setMsg(e.message); } };
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); if (pw.newPassword.length < 10 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) return setMsg('New password needs 10 or more characters with a letter and a number.');
    try { await api.put('/auth/password', pw); setPw({ currentPassword: '', newPassword: '' }); setMsg('Password changed.'); } catch (x: any) { setMsg(x.message); }
  };
  const del = async () => { if (window.prompt('Type DELETE to permanently remove your account and all data.') !== 'DELETE') return; await api.del('/auth/account'); await logout().catch(() => undefined); nav('/'); };
  const demo = async (load: boolean) => { setMsg(''); try { if (load) { const r = await api.post<{ message?: string; loaded: boolean }>('/demo/load'); setMsg(r.loaded ? 'Demo environment loaded.' : r.message || ''); } else { if (!window.confirm('Remove all DEMO projects and records?')) return; await api.del('/demo'); setMsg('Demo records removed.'); } await refresh(); } catch (e: any) { setMsg(e.message); } };
  const prefs = user.preferences;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Settings sections">{TABS.map((t) => <button key={t} onClick={() => { setTab(t); setMsg(''); }} className={`rounded-md px-3 py-2 text-left text-sm ${tab === t ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>{t}</button>)}</nav>
        <section className="card max-w-2xl space-y-4 p-5">
          {tab === 'Profile' && (<><Field label="Name"><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={80} /></Field><Field label="Institution"><input className="input" value={p.institution} onChange={(e) => setP({ ...p, institution: e.target.value })} maxLength={120} /></Field><Field label="About you"><textarea className="input" value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} maxLength={500} /></Field><button className="btnPrimary" onClick={() => save(p)}>Save profile</button></>)}
          {tab === 'Account' && (<><Field label="Email"><input className="input" value={user.email} readOnly /></Field><div className="text-sm text-muted">Role: {user.role}</div>
            <form onSubmit={changePw} className="space-y-3 border-t border-line pt-4"><h2 className="text-lg">Change password</h2><Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field><Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field><button className="btn">Update password</button></form>
            <div className="border-t border-line pt-4"><h2 className="text-lg text-bad">Delete account</h2><p className="mb-2 text-sm text-muted">Removes your account, projects, papers, analyses and reports permanently.</p><button className="btn" onClick={del}>Delete my account</button></div></>)}
          {tab === 'Theme' && (<div className="flex gap-3">{(['dark', 'light'] as const).map((t) => <button key={t} className={`card flex-1 p-4 text-left ${prefs.theme === t ? 'border-accent' : ''}`} onClick={() => { applyTheme(t); save({ preferences: { theme: t } }, 'Theme updated.'); }}><div className="font-serif text-lg capitalize">{t}</div><div className="text-xs text-muted">{t === 'dark' ? 'Default. Charcoal surfaces.' : 'Bright surfaces for print and daylight.'}</div></button>)}</div>)}
          {tab === 'Notifications' && NOTIF.map(([k, l]) => <label key={k} className="flex items-center justify-between text-sm"><span>{l}</span><input type="checkbox" checked={prefs.notifications[k] !== false} onChange={(e) => save({ preferences: { notifications: { [k]: e.target.checked } } }, 'Preferences saved.')} /></label>)}
          {tab === 'Research' && (<><Field label="Default research domain"><input className="input" defaultValue={prefs.research.defaultDomain} onBlur={(e) => save({ preferences: { research: { defaultDomain: e.target.value.trim() } } })} maxLength={80} /></Field>
            <Field label="Default academic source"><select className="input" value={prefs.research.defaultProvider} onChange={(e) => save({ preferences: { research: { defaultProvider: e.target.value } } })}>{[['openalex','OpenAlex'],['semanticscholar','Semantic Scholar'],['crossref','Crossref'],['arxiv','arXiv'],['core','CORE'],['pubmed','PubMed'],['doaj','DOAJ']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Minimum analyzed papers for gap discovery" hint="Gaps need several papers to be meaningful. Minimum 2."><input className="input" type="number" min={2} max={20} defaultValue={prefs.research.minPapersForGaps} onBlur={(e) => { const v = Math.min(20, Math.max(2, Number(e.target.value) || 3)); save({ preferences: { research: { minPapersForGaps: v } } }); }} /></Field></>)}
          {tab === 'Demo data' && (<><p className="text-sm text-muted">The demo environment adds three projects with twenty fictional paper records, analyses, gaps, questions, a map and citation links. Everything is labeled DEMO and can be removed at any time.</p><div className="flex gap-2"><button className="btnPrimary" onClick={() => demo(true)}>Load demo environment</button><button className="btn" onClick={() => demo(false)}>Remove demo records</button></div></>)}
          {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
        </section>
      </div>
    </>
  );
}
