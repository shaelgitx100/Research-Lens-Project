import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Async, Badge, DemoBadge, EmptyState, Field, Modal, PageHeader, Pagination, TagInput } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api, qs } from '../services/api';
import { Pagination as P, Question } from '../types';

const DISCLAIMER = 'Generated proposal. Requires human academic review before use.';
const tone: Record<string, string> = { High: 'border-good/50 text-good', Medium: 'border-amber/50 text-amber', Low: 'border-bad/50 text-bad', Unassessed: 'border-line text-muted' };

export function Questions() {
  const { current } = useProject();
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const url = `/questions${qs({ projectId: current?.id, status, page, limit: 20 })}`;
  const { data, loading, error, reload } = useAsync(() => api.get<{ questions: Question[]; pagination: P }>(url), [url], !!current);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [edit, setEdit] = useState<Question | 'new' | null>(null); const [cmp, setCmp] = useState<string[]>([]);
  const generate = async () => { setBusy(true); setMsg(''); try { const r = await api.post<{ created: number }>('/questions/generate', { projectId: current!.id }); setMsg(`${r.created} new candidate questions generated.`); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  const patch = async (q: Question, body: Partial<Question>) => { await api.patch(`/questions/${q.id}`, body); reload(); };
  const remove = async (q: Question) => { if (window.confirm('Delete this question?')) { await api.del(`/questions/${q.id}`); reload(); } };
  const picked = (data?.questions || []).filter((q) => cmp.includes(q.id));
  return (
    <>
      <PageHeader title="Research Question Generator" subtitle="Candidate questions built from evidence supported gaps. Save, edit, compare and export them." actions={<>
        <button className="btn" onClick={() => setEdit('new')} disabled={!current}>Write a question</button>
        <a className="btn" href={`/api/questions/export${qs({ projectId: current?.id, status })}`}>Export Markdown</a>
        <button className="btnPrimary" onClick={generate} disabled={busy || !current}>{busy ? 'Generating' : 'Generate questions'}</button></>} />
      <div className="card mb-4 flex flex-wrap items-center gap-2 border-amber/40 px-4 py-2.5 text-xs text-muted"><Badge tone="border-amber/50 text-amber">Proposal</Badge>{DISCLAIMER}</div>
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      <div className="mb-4 flex gap-2">{[['', 'All'], ['proposed', 'Proposed'], ['saved', 'Saved'], ['archived', 'Archived']].map(([v, l]) => <button key={v} className={`badge cursor-pointer !px-3 !py-1 !text-sm ${status === v ? 'border-accent text-accent' : 'border-line text-muted'}`} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}</div>
      {picked.length >= 2 && (
        <section className="card mb-4 overflow-x-auto p-4"><h2 className="mb-2 text-lg">Comparison</h2><table className="w-full min-w-[600px] text-left text-sm"><tbody>
          {([['Question', (q: Question) => q.question], ['Related gap', (q: Question) => q.gap?.title || 'None'], ['Methodology', (q: Question) => q.proposedMethodology], ['Dataset', (q: Question) => q.requiredDataset], ['Metrics', (q: Question) => q.evaluationMetrics.join(', ')], ['Feasibility', (q: Question) => q.feasibility.level]] as [string, (q: Question) => string][]).map(([l, fn]) => <tr key={l} className="border-b border-line/60 align-top"><th className="w-28 px-2 py-2 text-xs uppercase text-muted">{l}</th>{picked.map((q) => <td key={q.id} className="px-2 py-2">{fn(q)}</td>)}</tr>)}</tbody></table></section>
      )}
      <Async loading={loading} error={error} onRetry={reload}>
        {data && data.questions.length === 0 ? <EmptyState title="No research questions yet" hint="Discover gaps first, then generate questions from them, or write your own." action={<Link className="btn" to="/app/gaps">Go to gaps</Link>} /> : (
          <div className="space-y-4">{data?.questions.map((q) => (
            <article key={q.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="max-w-3xl font-serif text-lg leading-snug">{q.question}</h3>
                <div className="flex flex-wrap items-center gap-1.5"><Badge>{q.status}</Badge><Badge tone={tone[q.feasibility.level]}>Feasibility {q.feasibility.level}</Badge>{q.origin === 'generated' ? <Badge tone="border-amber/50 text-amber">Proposal</Badge> : <Badge tone="border-accent/50 text-accent">User written</Badge>}<DemoBadge show={q.isDemo} /></div></div>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                {([['Motivation', q.motivation], ['Potential methodology', q.proposedMethodology], ['Required dataset', q.requiredDataset], ['Suggested evaluation metrics', q.evaluationMetrics.join(', ')], ['Expected research contribution', q.expectedContribution], ['Feasibility assessment', q.feasibility.explanation]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd className="text-muted">{v}</dd></div>)}
              </dl>
              <div className="mt-2 text-xs text-muted">{q.gap ? <>Related gap: <Link className="link" to={`/app/gaps/${q.relatedGapId}`}>{q.gap.title}</Link></> : 'No related gap'} {'\u00b7'} {q.supportingPaperIds.length} supporting papers</div>
              {q.notes && <p className="mt-2 rounded border border-line bg-bg p-2 text-sm"><span className="label">Notes</span>{q.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={cmp.includes(q.id)} onChange={() => setCmp((c) => (c.includes(q.id) ? c.filter((x) => x !== q.id) : [...c, q.id].slice(-3)))} />Compare</label>
                {q.status !== 'saved' && <button className="btn" onClick={() => patch(q, { status: 'saved' })}>Save</button>}
                {q.status !== 'archived' && <button className="btn" onClick={() => patch(q, { status: 'archived' })}>Archive</button>}
                <button className="btn" onClick={() => setEdit(q)}>Edit and notes</button><button className="btnGhost" onClick={() => remove(q)}>Delete</button></div>
            </article>))}
            <Pagination page={data!.pagination.page} pages={data!.pagination.pages} onPage={setPage} /></div>)}
      </Async>
      {edit && current && <QuestionForm key={edit === 'new' ? 'new' : edit.id} projectId={current.id} q={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function QuestionForm({ projectId, q, onClose, onSaved }: { projectId: string; q: Question | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ question: q?.question || '', motivation: q?.motivation || '', proposedMethodology: q?.proposedMethodology || '', requiredDataset: q?.requiredDataset || '', expectedContribution: q?.expectedContribution || '', notes: q?.notes || '', metrics: q?.evaluationMetrics || [] as string[] });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (f.question.trim().length < 10) return setErr('Write a complete question (at least 10 characters).');
    setBusy(true); const { metrics, ...rest } = f; const body = { ...rest, question: f.question.trim(), evaluationMetrics: metrics.map((m) => m.trim()).filter(Boolean) };
    try { if (q) await api.patch(`/questions/${q.id}`, body); else await api.post('/questions', { ...body, projectId }); onSaved(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={q ? 'Edit question' : 'Write a research question'} wide>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Research question"><textarea className="input min-h-[80px]" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} /></Field>
        <Field label="Motivation"><textarea className="input" value={f.motivation} onChange={(e) => setF({ ...f, motivation: e.target.value })} /></Field>
        <div className="grid gap-3 md:grid-cols-2"><Field label="Potential methodology"><textarea className="input" value={f.proposedMethodology} onChange={(e) => setF({ ...f, proposedMethodology: e.target.value })} /></Field><Field label="Required dataset"><textarea className="input" value={f.requiredDataset} onChange={(e) => setF({ ...f, requiredDataset: e.target.value })} /></Field></div>
        <Field label="Evaluation metrics" hint="Comma separated."><TagInput value={f.metrics} onChange={(v) => setF({ ...f, metrics: v })} /></Field>
        <Field label="Expected contribution"><textarea className="input" value={f.expectedContribution} onChange={(e) => setF({ ...f, expectedContribution: e.target.value })} /></Field>
        <Field label="Your notes"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btnPrimary" disabled={busy}>Save question</button></div>
      </form>
    </Modal>
  );
}
