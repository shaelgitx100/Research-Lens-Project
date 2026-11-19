import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyTheme, useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { NotificationPanel } from './NotificationPanel';
import { Icon } from './ui';

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { user, logout, setUser } = useAuth();
  const { projects, currentId, setCurrentId } = useProject();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const dark = (user?.preferences.theme || 'dark') === 'dark';
  const toggleTheme = async () => { const t = dark ? 'light' : 'dark'; applyTheme(t); try { setUser((await api.put<{ user: any }>('/auth/profile', { preferences: { theme: t } })).user); } catch { /* theme still applied locally */ } };
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur noPrint">
      <button className="btnGhost lg:hidden" onClick={onMenu} aria-label="Open navigation"><Icon name="menu" /></button>
      <select className="input !w-auto max-w-[44vw] !py-1.5 md:max-w-xs" value={currentId} onChange={(e) => setCurrentId(e.target.value)} aria-label="Active research project">
        {projects.length === 0 && <option value="">No projects yet</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.isDemo ? '[DEMO] ' : ''}{p.title}</option>)}
      </select>
      <div className="flex-1" />
      <button className="btn hidden md:inline-flex" onClick={onSearch}><Icon name="search" size={16} />Search<kbd className="ml-2 rounded border border-line px-1 text-[10px] text-muted">Ctrl K</kbd></button>
      <button className="btnGhost md:hidden" onClick={onSearch} aria-label="Search"><Icon name="search" /></button>
      <button className="btnGhost" onClick={toggleTheme} aria-label="Toggle theme"><Icon name={dark ? 'sun' : 'moon'} /></button>
      <NotificationPanel />
      <div className="relative" ref={ref}>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-sm font-semibold" onClick={() => setMenu((m) => !m)} aria-label="Account menu" aria-expanded={menu}>{user?.name?.[0]?.toUpperCase()}</button>
        {menu && (
          <div className="card absolute right-0 z-50 mt-2 w-56 p-1 shadow-xl fadeUp">
            <div className="px-3 py-2 text-sm"><div className="truncate font-medium">{user?.name}</div><div className="truncate text-xs text-muted">{user?.email}</div></div>
            <button className="btnGhost w-full" onClick={() => { setMenu(false); nav('/app/settings'); }}>Profile and settings</button>
            <button className="btnGhost w-full" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
