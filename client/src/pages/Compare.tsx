import { useState } from 'react';
import { ComparisonTable, Cmp } from '../components/ComparisonTable';
import { Async, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { Paper } from '../types';

export function Compare() {
  const { current } = useProject(); const [sel, setSel] = useState<string[]>([]); const [out, setOut] = useState<Cmp | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.get<{ papers: Paper[] }>(`/papers?projectId=${current!.id}&limit=50&sort=title`), [current?.id], !!current);
  const run = async () => { setBusy(true); setErr(''); try { setOut(await api.post<Cmp>('/compare', { paperIds: sel })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s));
  return (
    <>
      <PageHeader title="Comparative Analysis" subtitle="Select two to six papers and compare their objectives, methods, datasets, findings, limitations and future work." actions={<button className="btnPrimary" disabled={sel.length < 2 || busy} onClick={run}>{busy ? 'Comparing' : `Compare ${sel.length || ''} papers`}</button>} />
      {!current ? <EmptyState title="No active project" /> : (
        <Async loading={loading} error={error} onRetry={reload}>
          {data && data.papers.length < 2 ? <EmptyState title="Add at least two papers" hint="Comparison needs two or more analyzed papers." /> : (
            <ul className="card mb-5 grid max-h-72 gap-px overflow-y-auto md:grid-cols-2">{data?.papers.map((p) => (
              <li key={p.id}><label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-raised/50"><input type="checkbox" className="mt-1" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} /><span>{p.title}<span className="block text-xs text-muted">{p.publicationYear} {p.analyzed ? '' : '\u00b7 not analyzed yet'}</span></span></label></li>))}</ul>
          )}
        </Async>
      )}
      {err && <p role="alert" className="mb-3 text-sm text-bad">{err}</p>}
      {out && <ComparisonTable data={out} />}
    </>
  );
}
