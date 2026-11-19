import { useEffect, type ReactNode } from 'react';

export default function Modal({ title, children, onClose, open = true }: { title: string; children: ReactNode; onClose: () => void; open?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" className="modal-close icon-btn" aria-label="Close dialog" onClick={onClose}>×</button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
