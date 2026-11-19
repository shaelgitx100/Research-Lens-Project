import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CitationGraph, CitationData } from '../components/CitationGraph';
import { Async, Badge, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';

interface Graph extends CitationData { influential: { id: string; title: string; citationsInLibrary: number }[]; clusters: { paperIds: string[]; size: number }[]; coverage: { totalPapers: number; papersWithReferenceData: number; linksFound: number; note: string } }
interface Rel { paper: { id: string; title: string }; cites: { id: string; title: string; year?: number }[]; citedBy: { id: string; title: string; year?: number }[]; related: { id: string; title: string; sharedReferences: number }[]; totalReferencesStored: number; citationCount: number | null; externalCiting?: { title: string; year?: number; DOI?: string; authors: string[] }[]; externalNote?: string }

export function Citations() {
  const { current } = useProject(); const [sel, setSel] = useState<string | null>(null); const [live, setLive] = useState(false);
  const g = useAsync(() => api.get<Graph>(`/citations/project/${current!.id}`), [current?.id], !!current);
  const r = useAsync(() => api.get<Rel>(`/citations/${sel}${live ? '?live=true' : ''}`), [sel, live], !!sel);
  const title = (id: string) => g.data?.nodes.find((n) => n.id === id)?.title || id;
  return (
    <>
      <PageHeader title="Citation Network" subtitle="Citation relationships between papers in the active project, built only from stored reference data." />
      {!current ? <EmptyState title="No active project" /> : (
        <Async loading={g.loading} error={g.error} onRetry={g.reload}>
          {g.data && g.data.nodes.length === 0 ? <EmptyState title="No papers yet" /> : g.data && (
            <div className="space-y-5">
              <div className="card px-4 py-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge tone="border-accent/50 text-accent">Coverage</Badge>{g.data.coverage.papersWithReferenceData} of {g.data.coverage.totalPapers} papers have reference lists. {g.data.coverage.linksFound} links found inside this project.</div><p className="mt-1 text-xs text-muted">{g.data.coverage.note} Relationships are never inferred or invented.</p></div>
              <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <div><CitationGraph data={g.data} selectedId={sel} onSelect={setSel} /><p className="mt-2 text-xs text-muted">Arrows point from the citing paper to the cited paper. Larger gold nodes are cited by other papers in this project.</p></div>
                <aside className="card space-y-3 self-start p-4 text-sm">
                  {!sel ? <p className="text-muted">Select a paper to inspect its citation relationships.</p> : (
                    <Async loading={r.loading} error={r.error} onRetry={r.reload}>
                      {r.data && (<>
                        <h3 className="font-serif text-base"><Link className="hover:text-accent" to={`/app/library/${sel}`}>{title(sel)}</Link></h3>
                        <div className="text-xs text-muted">Reported citation count: {r.data.citationCount ?? 'not available'} {'\u00b7'} {r.data.totalReferencesStored} references stored</div>
                        {([['Cites (in this project)', r.data.cites], ['Cited by (in this project)', r.data.citedBy]] as const).map(([l, list]) => <div key={l}><h4 className="label">{l}</h4>{list.length ? <ul className="space-y-1">{list.map((p) => <li key={p.id}><button className="text-left text-accent" onClick={() => setSel(p.id)}>{p.title}</button></li>)}</ul> : <p className="text-xs text-muted">None found.</p>}</div>)}
                        <div><h4 className="label">Related publications</h4>{r.data.related.length ? <ul className="space-y-1">{r.data.related.map((p) => <li key={p.id}><button className="text-left text-accent" onClick={() => setSel(p.id)}>{p.title}</button> <span className="text-xs text-muted">({p.sharedReferences} shared references)</span></li>)}</ul> : <p className="text-xs text-muted">None share two or more references.</p>}</div>
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />Also look up citing works live (OpenAlex papers only)</label>
                        {r.data.externalNote && <p className="text-xs text-muted">{r.data.externalNote}</p>}
                        {r.data.externalCiting && <ul className="space-y-1 text-xs">{r.data.externalCiting.map((c, i) => <li key={i}>{c.title} {c.year ? `(${c.year})` : ''}</li>)}</ul>}
                      </>)}
                    </Async>
                  )}
                </aside>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <section className="card p-4"><h2 className="mb-2 text-lg">Influential papers in this project</h2>{g.data.influential.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{g.data.influential.map((p) => <li key={p.id}><button className="text-left hover:text-accent" onClick={() => setSel(p.id)}>{p.title}</button> <span className="text-xs text-muted">cited by {p.citationsInLibrary}</span></li>)}</ol> : <p className="text-sm text-muted">No in project citations were found.</p>}</section>
                <section className="card p-4"><h2 className="mb-2 text-lg">Publication clusters</h2>{g.data.clusters.length ? <ul className="space-y-2 text-sm">{g.data.clusters.map((c, i) => <li key={i}>Cluster {i + 1}: {c.size} connected papers<div className="text-xs text-muted">{c.paperIds.map(title).join('; ')}</div></li>)}</ul> : <p className="text-sm text-muted">No connected clusters yet.</p>}</section>
              </div>
            </div>
          )}
        </Async>
      )}
    </>
  );
}
