import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraphCanvas } from '../graph/GraphCanvas';
import { api } from '../services/api';
import { GEdge, GNode } from '../types';
import { NODE_COLOR } from '../utils/format';
import { Badge, Field } from './ui';

const TYPES = ['paper', 'author', 'topic', 'keyword', 'methodology', 'dataset', 'limitation', 'gap'];
const TYPE_LABEL: Record<string, string> = { paper: 'Papers', author: 'Authors', topic: 'Topics', keyword: 'Keywords', methodology: 'Methodologies', dataset: 'Datasets', limitation: 'Limitations', gap: 'Gaps' };

export function LiteratureGraph({ projectId, nodes, edges, onChanged }: { projectId: string; nodes: GNode[]; edges: GEdge[]; onChanged: () => void }) {
  const [types, setTypes] = useState<Set<string>>(new Set(['paper', 'topic', 'methodology', 'dataset', 'limitation', 'gap', 'keyword']));
  const [q, setQ] = useState(''); const [sel, setSel] = useState<string | null>(null); const [focus, setFocus] = useState(false); const [hlPapers, setHlPapers] = useState(false);
  const [form, setForm] = useState({ s: '', t: '', type: '', desc: '' }); const [msg, setMsg] = useState('');
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const neighbors = useMemo(() => {
    if (!sel) return new Set<string>();
    const s = new Set<string>([sel]); edges.forEach((e) => { if (e.source === sel) s.add(e.target); if (e.target === sel) s.add(e.source); }); return s;
  }, [sel, edges]);

  const visible = useMemo(() => nodes.filter((n) => types.has(n.type) && (!focus || !sel || neighbors.has(n.id))), [nodes, types, focus, sel, neighbors]);
  const vis = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const vEdges = useMemo(() => edges.filter((e) => vis.has(e.source) && vis.has(e.target)), [edges, vis]);
  const matches = useMemo(() => { const t = q.trim().toLowerCase(); return t ? new Set(visible.filter((n) => n.label.toLowerCase().includes(t)).map((n) => n.id)) : null; }, [q, visible]);
  const highlight = useMemo(() => {
    if (matches) return matches;
    if (hlPapers && sel) return new Set([...neighbors].filter((id) => byId.get(id)?.type === 'paper' || id === sel));
    return null;
  }, [matches, hlPapers, sel, neighbors, byId]);

  const node = sel ? byId.get(sel) : null;
  const rel = sel ? edges.filter((e) => e.source === sel || e.target === sel) : [];
  const toggle = (t: string) => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const addEdge = async () => {
    setMsg(''); if (!form.s || !form.t || !form.type.trim() || form.s === form.t) return setMsg('Choose two different nodes and name the relationship.');
    try { await api.post('/mapping/edges', { projectId, sourceNodeId: form.s, targetNodeId: form.t, relationshipType: form.type.trim(), description: form.desc.trim() }); setForm({ s: '', t: '', type: '', desc: '' }); onChanged(); } catch (e: any) { setMsg(e.message); }
  };
  const removeEdge = async (id: string) => { await api.del(`/mapping/edges/${id}`); onChanged(); };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input className="input !w-56" placeholder="Search nodes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search nodes" />
          <div className="flex flex-wrap gap-2">{TYPES.map((t) => <label key={t} className="flex cursor-pointer items-center gap-1.5 text-xs"><input type="checkbox" checked={types.has(t)} onChange={() => toggle(t)} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[t] }} />{TYPE_LABEL[t]}</label>)}</div>
        </div>
        <GraphCanvas ariaLabel="Interactive literature knowledge graph" nodes={visible.map((n) => ({ id: n.id, label: n.label, color: NODE_COLOR[n.type], radius: n.type === 'paper' || n.type === 'gap' ? 8 : 6, ring: n.isManual }))} edges={vEdges.map((e) => ({ id: e.id, source: e.source, target: e.target }))} selectedId={sel} highlight={highlight} onSelect={setSel} />
        <p className="mt-2 text-xs text-muted">{visible.length} nodes and {vEdges.length} relationships shown. Every link is derived from stored metadata, analyzed text, research gaps, or was added by you (ringed nodes and manual links).</p>
      </div>
      <aside className="card space-y-3 self-start p-4 text-sm">
        {!node ? <p className="text-muted">Select a node to see its details and relationships.</p> : (<>
          <div className="flex items-center gap-2"><Badge>{node.type}</Badge>{node.isManual && <Badge tone="border-accent/50 text-accent">Manual</Badge>}</div>
          <h3 className="font-serif text-base leading-snug">{node.label}</h3>
          {node.description && <p className="text-muted">{node.description}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setFocus((f) => !f)}>{focus ? 'Show full graph' : 'Expand relationships'}</button>
            <button className="btn" onClick={() => setHlPapers((h) => !h)}>{hlPapers ? 'Clear highlight' : 'Highlight connected papers'}</button>
            {node.type === 'paper' && node.relatedEntityId && <Link className="btn" to={`/app/library/${node.relatedEntityId}`}>Open paper</Link>}
            {node.type === 'gap' && node.relatedEntityId && <Link className="btn" to={`/app/gaps/${node.relatedEntityId}`}>Open gap</Link>}
          </div>
          <div><h4 className="label">Relationships ({rel.length})</h4>
            <ul className="max-h-64 space-y-2 overflow-y-auto">{rel.map((e) => { const other = byId.get(e.source === sel ? e.target : e.source); return (
              <li key={e.id} className="rounded border border-line bg-bg p-2"><button className="text-left text-accent" onClick={() => setSel(other?.id || null)}>{other?.label}</button><div className="text-[11px] text-muted">{e.source === sel ? '' : 'is the target of '}{e.relationshipType}{e.description ? `: ${e.description}` : ''}</div>{e.isManual && <button className="text-[11px] text-bad" onClick={() => removeEdge(e.id)}>Remove manual link</button>}</li>); })}</ul></div>
        </>)}
        <details className="border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Add a manual relationship</summary>
          <div className="mt-3 space-y-2">
            <Field label="From"><select className="input" value={form.s} onChange={(e) => setForm({ ...form, s: e.target.value })}><option value="">Choose node</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.type}: {n.label.slice(0, 50)}</option>)}</select></Field>
            <Field label="To"><select className="input" value={form.t} onChange={(e) => setForm({ ...form, t: e.target.value })}><option value="">Choose node</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.type}: {n.label.slice(0, 50)}</option>)}</select></Field>
            <Field label="Relationship"><input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="for example extends" maxLength={60} /></Field>
            <Field label="Description"><input className="input" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} maxLength={500} /></Field>
            {msg && <p role="alert" className="text-xs text-bad">{msg}</p>}<button className="btn" onClick={addEdge}>Add relationship</button>
          </div>
        </details>
      </aside>
    </div>
  );
}
