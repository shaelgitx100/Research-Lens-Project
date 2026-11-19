import { useEffect, useMemo, useRef, useState } from 'react';
import { layout } from './forceLayout';

export interface CNode { id: string; label: string; color: string; radius?: number; ring?: boolean; status?: string }
export interface CEdge { id: string; source: string; target: string; directed?: boolean; label?: string }
interface Props { nodes: CNode[]; edges: CEdge[]; selectedId?: string | null; highlight?: Set<string> | null; onSelect: (id: string | null) => void; height?: number; ariaLabel: string; draggableNodes?: boolean; degreeSized?: boolean; highContrast?: boolean }

export function GraphCanvas({ nodes, edges, selectedId, highlight, onSelect, height = 560, ariaLabel, draggableNodes = false, degreeSized = true, highContrast = false }: Props) {
  const W = 900, H = 600;
  const sig = nodes.map((n) => n.id).join('|') + '#' + edges.map((e) => e.source + '>' + e.target).join('|');
  const pos = useMemo(() => layout(nodes.map((n) => n.id), edges, W, H), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [nodeOffsets, setNodeOffsets] = useState<Map<string, { x: number; y: number }>>(() => new Map());
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const nodeDrag = useRef<{ id: string; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => { setView({ x: 0, y: 0, k: 1 }); setNodeOffsets(new Map()); }, [sig]);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W, my = ((e.clientY - rect.top) / rect.height) * H;
      setView((v) => { const k = Math.min(4, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.12 : 0.89))); const r = k / v.k; return { k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r }; });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const degree = useMemo(() => { const d = new Map<string, number>(); edges.forEach((e) => { d.set(e.source, (d.get(e.source) || 0) + 1); d.set(e.target, (d.get(e.target) || 0) + 1); }); return d; }, [edges]);
  const nb = useMemo(() => {
    const focus = selectedId || hover; if (!focus) return null;
    const s = new Set<string>([focus]); edges.forEach((e) => { if (e.source === focus) s.add(e.target); if (e.target === focus) s.add(e.source); }); return s;
  }, [selectedId, hover, edges]);

  const down = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; };
  const move = (e: React.PointerEvent) => {
    if (nodeDrag.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = e.clientX - nodeDrag.current.x, dy = e.clientY - nodeDrag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) nodeDrag.current.moved = true;
      if (nodeDrag.current.moved) setNodeOffsets((offsets) => new Map(offsets).set(nodeDrag.current!.id, {
        x: nodeDrag.current!.ox + (dx / rect.width) * W / view.k,
        y: nodeDrag.current!.oy + (dy / rect.height) * H / view.k,
      }));
      return;
    }
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect(); const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current!.vx + (dx / rect.width) * W, y: drag.current!.vy + (dy / rect.height) * H }));
  };
  const up = () => {
    if (nodeDrag.current) { nodeDrag.current = null; return; }
    if (drag.current && !drag.current.moved) onSelect(null);
    drag.current = null;
  };
  const position = (id: string) => {
    const point = pos.get(id);
    const offset = nodeOffsets.get(id);
    return point ? { x: point.x + (offset?.x || 0), y: point.y + (offset?.y || 0) } : undefined;
  };
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * f)) }));

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-bg">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ height, touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab' }} className="w-full select-none" role="img" aria-label={ariaLabel} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => (drag.current = null)}>
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="14" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="rgb(var(--muted))" /></marker></defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const a = position(e.source), b = position(e.target); if (!a || !b) return null;
            const on = nb ? nb.has(e.source) && nb.has(e.target) : true; const hl = highlight ? highlight.has(e.source) && highlight.has(e.target) : false;
            return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hl ? 'rgb(var(--accent))' : 'rgb(var(--muted))'} strokeOpacity={on ? (hl ? 0.9 : 0.45) : 0.07} strokeWidth={hl ? 1.8 : 1} markerEnd={e.directed ? 'url(#arrow)' : undefined}><title>{e.label || 'Citation relationship'}</title></line>;
          })}
          {nodes.map((n) => {
            const p = position(n.id); if (!p) return null;
            const r = (n.radius || 7) + (degreeSized ? Math.min(5, (degree.get(n.id) || 0) * 0.5) : 0);
            const dim = nb ? !nb.has(n.id) : highlight ? !highlight.has(n.id) : false;
            const showLabel = n.id === selectedId || n.id === hover || (nb?.has(n.id) ?? false) || view.k > 1.35 || (degree.get(n.id) || 0) >= 5;
            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`} opacity={dim ? (highContrast ? 0.4 : 0.18) : 1} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={n.status ? `${n.label} · ${n.status}` : n.label}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (draggableNodes) {
                    const offset = nodeOffsets.get(n.id);
                    nodeDrag.current = { id: n.id, x: e.clientX, y: e.clientY, ox: offset?.x || 0, oy: offset?.y || 0, moved: false };
                    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
                  }
                }} onClick={(e) => { e.stopPropagation(); onSelect(n.id); }} onKeyDown={(e) => e.key === 'Enter' && onSelect(n.id)}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                <circle r={r} fill={n.color} fillOpacity={highContrast ? 1 : 0.9} style={{ stroke: highContrast || n.id === selectedId ? 'currentColor' : 'rgb(var(--bg))' }} strokeWidth={highContrast ? (n.id === selectedId ? 3 : 2) : (n.id === selectedId ? 2.5 : 1.5)}>
                  {n.status && <title>{n.label} · {n.status}</title>}
                </circle>
                {n.ring && <circle r={r + 3} fill="none" stroke={n.color} strokeOpacity={0.6} />}
                {showLabel && <text y={r + 12} textAnchor="middle" fontSize={11 / Math.max(0.8, view.k * 0.9)} fill="rgb(var(--ink))" style={{ paintOrder: 'stroke', stroke: 'rgb(var(--bg))', strokeWidth: 3 }}>{n.label.length > 38 ? n.label.slice(0, 36) + '\u2026' : n.label}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button className="btn !px-2" onClick={() => zoom(1.25)} aria-label="Zoom in">+</button>
        <button className="btn !px-2" onClick={() => zoom(0.8)} aria-label="Zoom out">{'\u2212'}</button>
        <button className="btn !px-2 text-xs" onClick={() => setView({ x: 0, y: 0, k: 1 })} aria-label="Reset view">Fit</button>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">Scroll to zoom. Drag to pan. Select a node for details.</p>
    </div>
  );
}
