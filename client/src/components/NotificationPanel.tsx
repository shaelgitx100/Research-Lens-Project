import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Notice } from '../types';
import { fmtDateTime } from '../utils/format';
import { Icon } from './ui';

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const load = () => api.get<{ notifications: Notice[]; unread: number }>('/notifications').then((r) => { setItems(r.notifications); setUnread(r.unread); }).catch(() => undefined);
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, []);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const toggle = () => { setOpen((o) => !o); if (!open) load(); };
  const markAll = async () => { await api.post('/notifications/read', {}); load(); };
  return (
    <div className="relative" ref={ref}>
      <button className="btnGhost relative" onClick={toggle} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}><Icon name="bell" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 text-[10px] font-semibold" style={{ color: 'rgb(var(--bg))' }}>{unread}</span>}</button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-80 max-w-[90vw] shadow-xl fadeUp">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm"><span className="font-semibold">Notifications</span><button className="text-xs text-accent" onClick={markAll}>Mark all read</button></div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-sm text-muted">Nothing yet.</li>}
            {items.map((n) => (
              <li key={n.id}><button className="w-full px-3 py-2 text-left text-sm hover:bg-raised/60" onClick={() => { if (n.link) nav(n.link); setOpen(false); }}>
                <span className={n.read ? 'text-muted' : ''}>{n.message}</span><span className="block text-[11px] text-muted">{fmtDateTime(n.createdAt)}</span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
