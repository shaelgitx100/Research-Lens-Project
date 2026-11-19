import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReportPreview } from '../components/ReportPreview';
import { Async, DemoBadge, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { fmtDateTime } from '../utils/format';

interface R { id: string; title: string; projectId: string; isDemo?: boolean; createdAt: string; updatedAt: string; reportContent?: string }

export function Reports() {
  const { current } = useProject(); const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get<{ reports: R[] }>(`/reports${current ? `?projectId=${current.id}` : ''}`), [current?.id]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const gen = async () => { setBusy(true); setMsg(''); try { const r = await api.post<{ report: { _id: string } }>('/reports/generate', { projectId: current!.id }); nav(`/app/reports/${r.report._id}`); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Research Reports" subtitle="Structured reports assembled from your saved papers, analyses, gaps and questions. References come only from stored metadata." actions={<button className="btnPrimary" onClick={gen} disabled={busy || !current}>{busy ? 'Generating' : 'Generate report'}</button>} />
      {msg && <p role="alert" className="mb-3 text-sm text-bad">{msg}</p>}
      <Async loading={loading} error={error} onRetry={reload}>
        {data && data.reports.length === 0 ? <EmptyState title="No reports yet" hint="Generate a report for the active project." /> : (
          <ul className="card divide-y divide-line">{data?.reports.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><Link to={`/app/reports/${r.id}`} className="font-serif hover:text-accent">{r.title}</Link> <DemoBadge show={r.isDemo} /><div className="text-xs text-muted">Created {fmtDateTime(r.createdAt)}</div></div><Link className="btn" to={`/app/reports/${r.id}`}>Open</Link></li>)}</ul>
        )}
      </Async>
    </>
  );
}

export function ReportDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get<{ report: R }>(`/reports/${id}`), [id]);
  const [edit, setEdit] = useState(false); const [content, setContent] = useState(''); const [title, setTitle] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { if (data) { setContent(data.report.reportContent || ''); setTitle(data.report.title); } }, [data]);
  const save = async () => { try { await api.put(`/reports/${id}`, { title, reportContent: content }); setEdit(false); setMsg('Saved.'); reload(); } catch (e: any) { setMsg(e.message); } };
  const remove = async () => { if (window.confirm('Delete this report?')) { await api.del(`/reports/${id}`); nav('/app/reports'); } };
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {data && (<>
        <PageHeader title={title} subtitle={`Generated ${fmtDateTime(data.report.createdAt)}. Use the browser print dialog and choose Save as PDF to export.`} actions={<>
          <DemoBadge show={data.report.isDemo} /><Link className="btn" to="/app/reports">All reports</Link>
          {edit ? <><button className="btn" onClick={() => { setEdit(false); setContent(data.report.reportContent || ''); }}>Cancel</button><button className="btnPrimary" onClick={save}>Save</button></> : <><button className="btn" onClick={() => setEdit(true)}>Edit</button><button className="btnPrimary" onClick={() => window.print()}>Print or save PDF</button></>}
          <button className="btnGhost" onClick={remove}>Delete</button></>} />
        {msg && <p role="status" className="mb-3 text-sm text-muted noPrint">{msg}</p>}
        {edit ? (
          <div className="space-y-3 noPrint"><input className="input font-serif text-lg" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Report title" maxLength={300} />
            <textarea className="input min-h-[60vh] font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} aria-label="Report content in Markdown" />
            <p className="text-xs text-muted">Markdown subset: headings, lists, tables with pipes, quotes, bold. Do not add references that are not in your library.</p></div>
        ) : <ReportPreview content={content} />}
      </>)}
    </Async>
  );
}
