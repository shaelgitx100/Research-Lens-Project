import { ReactNode, useEffect } from 'react';
import { EVIDENCE_TONE } from '../utils/format';

const ICONS: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3', book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5', beaker: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  graph: 'M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.7 6.5l8.6 3M17 12l-7.5 6', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1-1.5 2M12 17h.01', chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  columns: 'M3 4h7v16H3zM14 4h7v16h-7z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', file: 'M6 3h8l5 5v13H6zM14 3v5h5', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 .6a7 7 0 0 0-1.6-.9L15 4H9l-.4 2.7a7 7 0 0 0-1.6.9L5 7 3 11l2 1a7 7 0 0 0 0 2l-2 1 2 4 2-.6c.5.4 1 .7 1.6.9L9 20h6l.4-2.7c.6-.2 1.1-.5 1.6-.9l2 .6 2-4-2-1c.1-.7.1-1.3 0-2z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8zM10 20a2 2 0 0 0 4 0', menu: 'M4 6h16M4 12h16M4 18h16', x: 'M6 6l12 12M18 6L6 18', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  plus: 'M12 5v14M5 12h14', check: 'M5 12l5 5L20 7', up: 'M12 19V5M5 12l7-7 7 7',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] || ICONS.grid} /></svg>;
}

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />{label}</div>
);
export const Badge = ({ children, tone = 'border-line text-muted', title }: { children: ReactNode; tone?: string; title?: string }) => <span title={title} className={`badge ${tone}`}>{children}</span>;
export const DemoBadge = ({ show = true }: { show?: boolean }) => (show ? <Badge tone="border-amber/50 text-amber" title="Fictional demonstration record">DEMO</Badge> : null);
export const EvidenceBadge = ({ label }: { label: string }) => <Badge tone={EVIDENCE_TONE[label] || EVIDENCE_TONE['Insufficient evidence']}>{label}</Badge>;
export const OriginBadge = ({ kind }: { kind: 'source' | 'ai' | 'user' | 'gap' | 'verified' | 'retrieved' }) => {
  const m = {
    source: ['Source derived finding', 'border-good/50 text-good'], ai: ['AI generated interpretation', 'border-amber/50 text-amber'], user: ['User written', 'border-accent/50 text-accent'],
    gap: ['Potential research gap', 'border-amber/50 text-amber'], verified: ['Researcher verified gap', 'border-good/50 text-good'], retrieved: ['Retrieved metadata', 'border-accent/50 text-accent'],
  }[kind];
  return <Badge tone={m[1]}>{m[0]}</Badge>;
};

export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center"><div className="font-serif text-lg">{title}</div>{hint && <p className="max-w-md text-sm text-muted">{hint}</p>}{action && <div className="mt-2">{action}</div>}</div>
);
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div role="alert" className="card flex items-center justify-between gap-3 border-bad/50 px-4 py-3 text-sm"><span className="text-bad">{message}</span>{onRetry && <button className="btn" onClick={onRetry}>Retry</button>}</div>
);
export function Async({ loading, error, onRetry, children }: { loading: boolean; error: string | null; onRetry?: () => void; children: ReactNode }) {
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return <>{children}</>;
}
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3 noPrint">
    <div><h1 className="text-2xl md:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}</label>
);
export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded bg-raised" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded bg-accent transition-all" style={{ width: `${value}%` }} /></div>
);
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm noPrint">
      <button className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-muted">Page {page} of {pages}</span>
      <button className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 noPrint" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`card mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-5 fadeUp`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg">{title}</h2><button className="btnGhost" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}
export const TagInput = ({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => (
  <input className="input" placeholder={placeholder} value={value.join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trimStart()).filter((s, i, a) => s !== '' || i === a.length - 1))} onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
);
