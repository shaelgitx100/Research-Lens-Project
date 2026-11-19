import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LiteratureGraph } from '../components/LiteratureGraph';
import { Async, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { GEdge, GNode } from '../types';

export function Mapping() {
  const { current } = useProject();
  const { data, loading, error, reload } = useAsync(() => api.get<{ nodes: GNode[]; edges: GEdge[] }>(`/mapping/${current!.id}`), [current?.id], !!current);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const build = async () => { setBusy(true); setMsg(''); try { const r = await api.post<{ nodes: number; edges: number }>('/mapping/build', { projectId: current!.id }); setMsg(`Map rebuilt: ${r.nodes} nodes and ${r.edges} relationships.`); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Literature Map" subtitle="Papers, authors, topics, methods, datasets, limitations and gaps connected by real extracted relationships." actions={<button className="btnPrimary" onClick={build} disabled={busy || !current}>{busy ? 'Building' : 'Rebuild map'}</button>} />
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      {!current ? <EmptyState title="No active project" hint="Create or select a project first." /> : (
        <Async loading={loading} error={error} onRetry={reload}>
          {data && data.nodes.length === 0 ? <EmptyState title="The map is empty" hint="Add papers and analyze them, then build the map. Nodes only appear for relationships found in your data." action={<div className="flex gap-2"><Link className="btn" to="/app/discovery">Add papers</Link><button className="btnPrimary" onClick={build}>Build map</button></div>} /> : data && <LiteratureGraph projectId={current.id} nodes={data.nodes} edges={data.edges} onChanged={reload} />}
        </Async>
      )}
    </>
  );
}
