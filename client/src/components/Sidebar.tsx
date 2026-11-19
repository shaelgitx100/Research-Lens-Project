import { NavLink } from 'react-router-dom';
import { Icon } from './ui';

export const NAV = [
  { to: '/app', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/app/workspace', label: 'Research Workspace', icon: 'folder' },
  { to: '/app/discovery', label: 'Paper Discovery', icon: 'search' },
  { to: '/app/library', label: 'Literature Library', icon: 'book' },
  { to: '/app/analysis', label: 'Paper Analysis', icon: 'beaker' },
  { to: '/app/mapping', label: 'Literature Map', icon: 'graph' },
  { to: '/app/gaps', label: 'Research Gaps', icon: 'target' },
  { to: '/app/questions', label: 'Research Questions', icon: 'help' },
  { to: '/app/trends', label: 'Research Trends', icon: 'chart' },
  { to: '/app/citations', label: 'Citation Network', icon: 'link' },
  { to: '/app/compare', label: 'Comparative Analysis', icon: 'columns' },
  { to: '/app/review', label: 'Review Builder', icon: 'list' },
  { to: '/app/reports', label: 'Research Reports', icon: 'file' },
  { to: '/app/settings', label: 'Settings', icon: 'gear' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden noPrint" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-line bg-surface transition-transform noPrint lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Primary navigation">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /><circle cx="11" cy="11" r="2" fill="rgb(var(--amber))" stroke="none" /></svg>
          <span className="font-serif text-lg">ResearchLens</span>
        </div>
        <nav className="space-y-0.5 overflow-y-auto p-2" style={{ height: 'calc(100% - 3.5rem)' }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink'}`}>
              <Icon name={n.icon} />{n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
