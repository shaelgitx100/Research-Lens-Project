import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Async, Badge, DemoBadge, EmptyState, OriginBadge, PageHeader } from '../components/ui';
import { PaperAnalysisPanel } from '../components/PaperAnalysisPanel';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { Analysis as A, Paper } from '../types';

export function Analysis() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <Picker />;
}

function Picker() {
  const { current } = useProject();
  const { data, loading, error, reload } = useAsync(() => api.get<{ papers: Paper[] }>(`/papers?projectId=${current!.id}&limit=50&sort=title`), [current?.id], !!current);
  return (
    <>
      <PageHeader title="Paper Analysis" subtitle="Select a saved paper to extract its objective, methodology, datasets, findings, limitations and future work." />
      <Async loading={loading} error={error} onRetry={reload}>
        {!current ? <EmptyState title="No active project" hint="Create or select a project first." /> : data && data.papers.length === 0 ? <EmptyState title="No papers to analyze" action={<Link className="btnPrimary" to="/app/discovery">Discover papers</Link>} /> : (
          <ul className="card divide-y divide-line">{data?.papers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div className="min-w-0"><div className="truncate font-serif">{p.title} <DemoBadge show={p.isDemo} /></div><div className="text-xs text-muted">{p.authors.slice(0, 3).join(', ')} {p.publicationYear ? `\u00b7 ${p.publicationYear}` : ''}</div></div>
              <div className="flex items-center gap-2">{p.analyzed ? <Badge tone="border-good/50 text-good">Analyzed</Badge> : <Badge>Not analyzed</Badge>}<Link className="btn" to={`/app/analysis/${p.id}`}>{p.analyzed ? 'Review' : 'Analyze'}</Link></div></li>
          ))}</ul>
        )}
      </Async>
    </>
  );
}

function Detail({ id }: { id: string }) {
  const { data, loading, error, reload } = useAsync(() => api.get<{ paper: Paper & { fullTextLength: number }; analysis: A | null }>(`/papers/${id}`), [id]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const fileRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<A | null>(null);
  useEffect(() => { if (data) setAnalysis(data.analysis); }, [data]);
  const p = data?.paper;
  const run = async (useFullText: boolean) => {
    setBusy(true); setMsg('');
    try { const r = await api.post<{ analysis: A; warning?: string }>(`/papers/${id}/analyze`, { useFullText }); setAnalysis(r.analysis); setMsg(r.warning || 'Analysis complete.'); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return; setBusy(true); setMsg(''); const fd = new FormData(); fd.append('file', file);
    try { const r = await api.upload<{ pages: number }>(`/papers/${id}/pdf`, fd); setMsg(`PDF text extracted from ${r.pages} pages. Run the analysis to use it.`); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {p && (<>
        <PageHeader title={p.title} subtitle={[p.authors.slice(0, 4).join(', '), p.publicationYear, p.venue].filter(Boolean).join(' \u00b7 ')} actions={<>
          <DemoBadge show={p.isDemo} /><Link className="btn" to={`/app/library/${p.id}`}>Paper details</Link>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Upload PDF</button><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload PDF" />
          {p.hasFullText && <button className="btn" onClick={() => run(true)} disabled={busy}>Analyze full text</button>}
          <button className="btnPrimary" onClick={() => run(false)} disabled={busy}>{busy ? 'Working' : analysis ? 'Re-analyze abstract' : 'Analyze abstract'}</button></>} />
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted"><OriginBadge kind="source" /><span>Extraction uses transparent keyword rules. Nothing is invented. Items it cannot find read "Not explicitly stated in the source." Review and edit before relying on them.</span></div>
        {msg && <p role="status" className="mb-4 text-sm text-muted">{msg}</p>}
        {analysis ? <PaperAnalysisPanel paperId={p.id} analysis={analysis} onSaved={setAnalysis} /> : <EmptyState title="Not analyzed yet" hint={p.abstract || p.hasFullText ? 'Run the analysis to extract structured findings.' : 'This paper has no abstract or text. Add an abstract in the library or upload the PDF.'} />}
      </>)}
    </Async>
  );
}
