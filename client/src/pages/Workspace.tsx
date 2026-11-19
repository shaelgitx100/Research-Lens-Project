import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PaperCard, ResearchProjectCard } from '../components/cards';
import { Async, Badge, DemoBadge, EmptyState, Field, Modal, PageHeader, ProgressBar, TagInput } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { Paper, Project } from '../types';
import { fmtDate, STATUS_LABEL } from '../utils/format';

function ProjectForm({ initial, onSaved, onCancel }: { initial?: Project; onSaved: (p: Project) => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: initial?.title || '', topic: initial?.topic || '', domain: initial?.domain || '', description: initial?.description || '', objectives: (initial?.objectives || []).join('\n'), keywords: initial?.keywords || [] as string[] });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (f.title.trim().length < 3 || f.topic.trim().length < 3) return setErr('Title and topic need at least 3 characters.');
    setBusy(true); setErr('');
    const body = { title: f.title.trim(), topic: f.topic.trim(), domain: f.domain.trim(), description: f.description.trim(), objectives: f.objectives.split('\n').map((s) => s.trim()).filter(Boolean), keywords: f.keywords.map((k) => k.trim()).filter(Boolean) };
    try { const r = initial ? await api.put<{ project: Project }>(`/projects/${initial.id}`, body) : await api.post<{ project: Project }>('/projects', body); onSaved(r.project); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Project title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} /></Field>
      <Field label="Research topic"><input className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} maxLength={300} /></Field>
      <Field label="Research domain"><input className="input" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="For example Machine Learning" maxLength={80} /></Field>
      <Field label="Research objectives" hint="One objective per line."><textarea className="input min-h-[80px]" value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></Field>
      <Field label="Keywords" hint="Separate with commas. Keywords become topic nodes in the literature map."><TagInput value={f.keywords} onChange={(v) => setF({ ...f, keywords: v })} /></Field>
      <Field label="Background (optional)"><textarea className="input min-h-[60px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btnPrimary" disabled={busy}>{busy ? 'Saving' : initial ? 'Save changes' : 'Create project'}</button></div>
    </form>
  );
}

export function Workspace() {
  const { projects, currentId, setCurrentId, refresh, loading } = useProject(); const [sp, setSp] = useSearchParams(); const nav = useNavigate();
  const [open, setOpen] = useState(sp.get('new') === '1');
  useEffect(() => { if (sp.get('new') === '1') { setOpen(true); setSp({}, { replace: true }); } }, [sp, setSp]);
  return (
    <>
      <PageHeader title="Research Workspace" subtitle="Create and manage research projects. The active project is used by discovery, analysis, gaps, maps and reports." actions={<button className="btnPrimary" onClick={() => setOpen(true)}>New project</button>} />
      {!loading && projects.length === 0 ? <EmptyState title="No research projects yet" hint="Create a project, or load the demo environment from the dashboard to explore a guided example." action={<button className="btnPrimary" onClick={() => setOpen(true)}>Create a project</button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <ResearchProjectCard key={p.id} project={p} active={p.id === currentId} onSelect={() => setCurrentId(p.id)} />)}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New research project" wide>
        <ProjectForm onCancel={() => setOpen(false)} onSaved={async (p) => { setOpen(false); await refresh(); setCurrentId(p.id); nav(`/app/workspace/${p.id}`); }} />
      </Modal>
    </>
  );
}

export function WorkspaceDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { refresh, setCurrentId } = useProject();
  const { data, loading, error, reload } = useAsync(() => api.get<{ project: Project }>(`/projects/${id}`), [id]);
  const papers = useAsync(() => api.get<{ papers: Paper[] }>(`/papers?projectId=${id}&limit=50&sort=date`), [id]);
  const [edit, setEdit] = useState(false); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const p = data?.project;
  useEffect(() => { if (p) setCurrentId(p.id); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (label: string, fn: () => Promise<string | void>) => { setBusy(label); setMsg(''); try { const m = await fn(); if (m) setMsg(m); reload(); papers.reload(); refresh(); } catch (e: any) { setMsg(e.message); } finally { setBusy(''); } };
  const analyzeAll = () => run('analyze', async () => {
    const todo = (papers.data?.papers || []).filter((x) => !x.analyzed); let ok = 0, skipped = 0;
    for (const x of todo) { try { await api.post(`/papers/${x.id}/analyze`, {}); ok++; } catch { skipped++; } }
    return `Analyzed ${ok} papers.${skipped ? ` ${skipped} skipped because they have no abstract or text.` : ''}`;
  });
  const status = (s: string) => run('status', async () => { await api.put(`/projects/${id}`, { status: s }); });
  const remove = async () => { if (!window.confirm('Delete this project and all of its papers, analyses, gaps, questions and reports?')) return; await api.del(`/projects/${id}`); await refresh(); nav('/app/workspace'); };
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {p && (<>
        <PageHeader title={p.title} subtitle={p.topic} actions={<><DemoBadge show={p.isDemo} /><button className="btn" onClick={() => setEdit(true)}>Edit</button><button className="btn" onClick={remove}>Delete</button></>} />
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-2 space-y-4">
            <div><span className="label">Status</span><div className="flex flex-wrap gap-1.5">{Object.entries(STATUS_LABEL).map(([k, v]) => <button key={k} onClick={() => status(k)} className={`badge cursor-pointer ${p.status === k ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink'}`}>{v}</button>)}</div></div>
            <div><span className="label">Analysis progress</span><div className="mb-1 text-sm text-muted">{p.stats.analyzed} of {p.stats.papers} papers analyzed</div><ProgressBar value={p.stats.progress} /></div>
            {p.objectives.length > 0 && <div><span className="label">Objectives</span><ul className="list-disc space-y-1 pl-5 text-sm">{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
            <div><span className="label">Keywords</span><div className="flex flex-wrap gap-1">{p.keywords.map((k) => <Badge key={k}>{k}</Badge>)}{!p.keywords.length && <span className="text-sm text-muted">None yet</span>}</div></div>
            {p.description && <div><span className="label">Background</span><p className="text-sm text-muted">{p.description}</p></div>}
            <div className="text-xs text-muted">Domain: {p.domain || 'Not set'} {'\u00b7'} Created {fmtDate(p.createdAt)}</div>
          </section>
          <section className="card p-4"><h2 className="mb-3 text-lg">Workflow</h2>
            <div className="flex flex-col gap-2">
              <Link className="btn" to="/app/discovery">1. Discover papers</Link>
              <button className="btn" disabled={!!busy || !p.stats.papers} onClick={analyzeAll}>{busy === 'analyze' ? 'Analyzing' : '2. Analyze all papers'}</button>
              <button className="btn" disabled={!!busy} onClick={() => run('map', async () => { const r = await api.post<{ nodes: number; edges: number }>('/mapping/build', { projectId: id }); return `Map built: ${r.nodes} nodes, ${r.edges} relationships.`; })}>3. Build literature map</button>
              <button className="btn" disabled={!!busy} onClick={() => run('gaps', async () => { const r = await api.post<{ created: number }>('/gaps/discover', { projectId: id }); return `${r.created} potential gaps identified.`; })}>4. Discover research gaps</button>
              <button className="btn" disabled={!!busy} onClick={() => run('q', async () => { const r = await api.post<{ created: number }>('/questions/generate', { projectId: id }); return `${r.created} candidate questions generated.`; })}>5. Generate questions</button>
              <button className="btn" disabled={!!busy} onClick={() => run('report', async () => { const r = await api.post<{ report: { _id: string } }>('/reports/generate', { projectId: id }); nav(`/app/reports/${r.report._id}`); })}>6. Generate report</button>
            </div>
            {msg && <p role="status" className="mt-3 text-sm text-muted">{msg}</p>}
          </section>
        </div>
        <h2 className="mb-3 mt-8 text-xl">Papers in this project</h2>
        <Async loading={papers.loading} error={papers.error} onRetry={papers.reload}>
          {papers.data && papers.data.papers.length === 0 ? <EmptyState title="No papers yet" hint="Search academic databases, import metadata manually, or upload a PDF." action={<Link className="btnPrimary" to="/app/discovery">Discover papers</Link>} /> : <div className="grid gap-3">{papers.data?.papers.map((x) => <PaperCard key={x.id} paper={x} />)}</div>}
        </Async>
        <Modal open={edit} onClose={() => setEdit(false)} title="Edit project" wide><ProjectForm initial={p} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); refresh(); }} /></Modal>
      </>)}
    </Async>
  );
}
