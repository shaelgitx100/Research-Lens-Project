import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RadarChart } from '../charts/charts';
import { ResearchGapCard } from '../components/cards';
import { Async, Badge, DemoBadge, EmptyState, EvidenceBadge, Field, OriginBadge, PageHeader, Pagination, ProgressBar } from '../components/ui';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api, qs } from '../services/api';
import { Gap, Pagination as P } from '../types';
import { CATEGORY_LABEL } from '../utils/format';
import { composite, DEFAULT_WEIGHTS, FORMULA, loadWeights } from '../utils/score';

const LABELS = ['Evidence supported gap', 'Potential research opportunity', 'Emerging research direction', 'Insufficient evidence'];
const CAVEAT = 'Potential research gaps are generated from the collected and analyzed papers only. They are not established scientific facts and do not show that a topic is unexplored in the wider literature. Human academic review is required.';

export function Gaps() {
  const { current } = useProject();
  const [tab, setTab] = useState<'gaps' | 'score'>('gaps'); const [f, setF] = useState({ category: '', label: '', q: '', classification: '' }); const [page, setPage] = useState(1);
  const dq = useDebounce(f.q, 350); useEffect(() => setPage(1), [dq, f.category, f.label, f.classification]);
  const limit = tab === 'score' ? 50 : 12;
  const url = `/gaps${qs({ ...f, q: dq, projectId: current?.id, page, limit })}`;
  const { data, loading, error, reload } = useAsync(() => api.get<{ gaps: Gap[]; pagination: P }>(url), [url], !!current);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const discover = async () => { setBusy(true); setMsg(''); try { const r = await api.post<{ created: number; analyzedPapers: number }>('/gaps/discover', { projectId: current!.id }); setMsg(`${r.created} potential gaps found across ${r.analyzedPapers} analyzed papers.`); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Research Gap Discovery" subtitle="Potential gaps found by comparing limitations, methods, datasets, models, findings and future work across analyzed papers." actions={<button className="btnPrimary" onClick={discover} disabled={busy || !current}>{busy ? 'Analyzing' : 'Discover gaps'}</button>} />
      <div className="card mb-4 flex flex-wrap items-center gap-2 border-amber/40 px-4 py-2.5 text-xs text-muted"><OriginBadge kind="gap" />{CAVEAT}</div>
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      <div className="mb-4 flex flex-wrap gap-2">{(['gaps', 'score'] as const).map((t) => <button key={t} className={`badge cursor-pointer !text-sm !px-3 !py-1 ${tab === t ? 'border-accent text-accent' : 'border-line text-muted'}`} onClick={() => setTab(t)}>{t === 'gaps' ? 'Gap list' : 'Opportunity scorecard'}</button>)}</div>
      {tab === 'gaps' && <div className="card mb-4 grid gap-3 p-4 md:grid-cols-4">
        <Field label="Search"><input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Evidence label"><select className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })}><option value="">All</option>{LABELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Review status"><select className="input" value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })}><option value="">All</option><option value="potential">Potential</option><option value="researcherVerified">Researcher verified</option></select></Field>
      </div>}
      {!current ? <EmptyState title="No active project" /> : (
        <Async loading={loading} error={error} onRetry={reload}>
          {data && data.gaps.length === 0 ? <EmptyState title="No gaps yet" hint="Analyze at least three papers, then choose Discover gaps." action={<Link className="btn" to="/app/analysis">Analyze papers</Link>} /> : data && (tab === 'gaps' ? (<><div className="grid gap-3 md:grid-cols-2">{data.gaps.map((g) => <ResearchGapCard key={g.id} gap={g} />)}</div><Pagination page={data.pagination.page} pages={data.pagination.pages} onPage={setPage} /></>) : <Scorecard gaps={data.gaps} />)}
        </Async>
      )}
    </>
  );
}

function Scorecard({ gaps }: { gaps: Gap[] }) {
  const [w, setW] = useState(loadWeights()); const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { localStorage.setItem('rlWeights', JSON.stringify(w)); }, [w]);
  const dims = gaps[0]?.scorecard?.dimensions || [];
  const rows = useMemo(() => gaps.map((g) => ({ g, c: composite(g.scorecard?.dimensions, w) })).sort((a, b) => b.c - a.c), [gaps, w]);
  const cmp = rows.filter((r) => picked.includes(r.g.id)).slice(0, 3);
  return (
    <div className="space-y-5">
      <section className="card p-4"><h2 className="mb-1 text-lg">Weights</h2><p className="mb-3 text-xs text-muted">{FORMULA}</p>
        <div className="grid gap-3 md:grid-cols-3">{dims.map((d) => <label key={d.key} className="text-sm"><div className="mb-1 flex justify-between"><span>{d.label}</span><span className="text-muted">{w[d.key]}</span></div><input type="range" min={0} max={5} step={1} value={w[d.key] ?? 1} onChange={(e) => setW({ ...w, [d.key]: Number(e.target.value) })} className="w-full" aria-label={`${d.label} weight`} /></label>)}</div>
        <button className="btn mt-3" onClick={() => setW(DEFAULT_WEIGHTS)}>Reset to equal weights</button></section>
      <section className="card overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Compare</th><th className="px-3 py-2">Opportunity</th>{dims.map((d) => <th key={d.key} className="px-2 py-2">{d.label.split(' ')[0]}</th>)}<th className="px-3 py-2">Composite</th></tr></thead>
        <tbody>{rows.map(({ g, c }) => (
          <tr key={g.id} className="border-b border-line/60 last:border-0"><td className="px-3 py-2"><input type="checkbox" checked={picked.includes(g.id)} onChange={() => setPicked((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))} aria-label={`Compare ${g.title}`} /></td>
            <td className="max-w-[20rem] px-3 py-2"><Link to={`/app/gaps/${g.id}`} className="hover:text-accent">{g.title}</Link></td>
            {dims.map((d) => <td key={d.key} className="px-2 py-2 text-muted" title={g.scorecard?.dimensions.find((x) => x.key === d.key)?.explanation}>{g.scorecard?.dimensions.find((x) => x.key === d.key)?.score.toFixed(2)}</td>)}
            <td className="px-3 py-2 font-semibold">{c}</td></tr>))}</tbody></table></section>
      {cmp.length >= 2 && <section className="card p-4"><h2 className="mb-3 text-lg">Side by side</h2><div className="grid gap-4 md:grid-cols-3">{cmp.map(({ g, c }) => <div key={g.id}><div className="mb-1 text-sm font-medium">{g.title}</div><div className="mb-1 text-xs text-muted">Composite {c}</div><RadarChart dims={g.scorecard?.dimensions || []} /></div>)}</div></section>}
      <p className="text-xs text-muted">Hover a score for its explanation. An automated score does not prove research novelty.</p>
    </div>
  );
}

export function GapDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { current } = useProject();
  const { data, loading, error, reload } = useAsync(() => api.get<{ gap: Gap; supportingPapers: { id: string; title: string; authors: string[]; publicationYear?: number; venue?: string; DOI?: string; isDemo?: boolean }[] }>(`/gaps/${id}`), [id]);
  const [note, setNote] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setNote(data.gap.reviewerNote || ''); }, [data]);
  const g = data?.gap; const papers = new Map((data?.supportingPapers || []).map((p) => [p.id, p]));
  const verify = async (verified: boolean) => { await api.patch(`/gaps/${id}`, { classification: verified ? 'researcherVerified' : 'potential', reviewerNote: note }); reload(); };
  const gen = async () => { try { const r = await api.post<{ created: number }>('/questions/generate', { projectId: g!.projectId, gapIds: [g!.id] }); setMsg(`${r.created} questions generated.`); if (r.created) nav('/app/questions'); } catch (e: any) { setMsg(e.message); } };
  const weights = loadWeights();
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {g && (<>
        <PageHeader title={g.title} subtitle={g.description} actions={<><DemoBadge show={g.isDemo} /><button className="btnPrimary" onClick={gen}>Generate questions</button><Link className="btn" to="/app/gaps">All gaps</Link></>} />
        <div className="mb-4 flex flex-wrap items-center gap-2"><Badge>{CATEGORY_LABEL[g.category]}</Badge><EvidenceBadge label={g.evidenceStrength.label} />{g.classification === 'researcherVerified' ? <OriginBadge kind="verified" /> : <OriginBadge kind="gap" />}{g.domain && <Badge>{g.domain}</Badge>}</div>
        {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="card p-4"><h2 className="mb-2 text-lg">Why is this a potential research gap?</h2><div className="mb-2"><OriginBadge kind="ai" /></div><p className="text-sm leading-relaxed text-muted">{g.reasoning}</p></section>
            <section className="card p-4"><h2 className="mb-1 text-lg">What evidence supports this gap?</h2><div className="mb-3"><OriginBadge kind="source" /></div>
              <ul className="space-y-3">{g.supportingEvidence.map((e, i) => { const p = papers.get(e.paperId); return (
                <li key={i} className="rounded-md border border-line bg-bg p-3 text-sm"><blockquote className="border-l-2 border-accent/60 pl-3">{e.excerpt}</blockquote>
                  <div className="mt-2 text-xs text-muted">{p ? <Link className="link" to={`/app/library/${p.id}`}>{p.title}</Link> : 'Paper no longer in library'} {'\u00b7'} {e.kind} {'\u00b7'} {[e.section, e.page && `page ${e.page}`].filter(Boolean).join(', ') || 'stored text'}</div></li>); })}</ul></section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Supporting publications ({data!.supportingPapers.length})</h2><ul className="space-y-1.5 text-sm">{data!.supportingPapers.map((p) => <li key={p.id}><Link className="link" to={`/app/library/${p.id}`}>{p.title}</Link> <span className="text-muted">{p.authors.slice(0, 2).join(', ')} {p.publicationYear ? `(${p.publicationYear})` : ''}</span> <DemoBadge show={p.isDemo} /></li>)}</ul></section>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="card p-4"><h2 className="mb-2 text-lg">Authors' limitations</h2>{g.authorLimitations.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{g.authorLimitations.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm italic text-muted">None directly quoted for this gap.</p>}</section>
              <section className="card p-4"><h2 className="mb-2 text-lg">Future research recommendations</h2>{g.futureRecommendations.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{g.futureRecommendations.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm italic text-muted">None directly quoted for this gap.</p>}</section>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="card p-4"><h2 className="mb-2 text-lg">Related methodologies</h2>{g.relatedMethodologies.length ? <div className="flex flex-wrap gap-1">{g.relatedMethodologies.map((m) => <Badge key={m}>{m}</Badge>)}</div> : <p className="text-sm italic text-muted">None identified.</p>}</section>
              <section className="card p-4"><h2 className="mb-2 text-lg">Suggested research directions</h2><div className="mb-2"><OriginBadge kind="ai" /></div><ul className="list-disc space-y-1 pl-5 text-sm">{g.suggestedDirections.map((x, i) => <li key={i}>{x}</li>)}</ul></section>
            </div>
          </div>
          <aside className="space-y-6 self-start">
            <section className="card p-4"><h2 className="mb-2 text-lg">Evidence strength</h2><EvidenceBadge label={g.evidenceStrength.label} />
              <div className="mt-3 text-sm text-muted">Coverage: {g.evidenceStrength.supportCount} of {g.evidenceStrength.totalAnalyzed} analyzed papers ({Math.round(g.evidenceStrength.coverage * 100)}%)</div><div className="mt-1"><ProgressBar value={Math.round(g.evidenceStrength.coverage * 100)} /></div>
              <p className="mt-2 text-xs text-muted">Coverage describes this collection only.</p></section>
            <section className="card p-4"><h2 className="mb-1 text-lg">Opportunity scorecard</h2><div className="mb-2 text-sm text-muted">Composite {composite(g.scorecard?.dimensions, weights)} of 100 with your weights</div><RadarChart dims={g.scorecard?.dimensions || []} />
              <ul className="mt-3 space-y-2 text-xs">{g.scorecard?.dimensions.map((d) => <li key={d.key}><div className="flex justify-between"><span className="font-medium">{d.label}</span><span>{d.score.toFixed(2)}</span></div><div className="text-muted">{d.explanation}</div></li>)}</ul><p className="mt-3 text-[11px] text-muted">{FORMULA}</p></section>
            <section className="card space-y-3 p-4"><h2 className="text-lg">Human review</h2>
              <Field label="Reviewer note"><textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={3000} /></Field>
              {g.classification === 'researcherVerified' ? <button className="btn" onClick={() => verify(false)}>Mark as potential again</button> : <button className="btnPrimary" onClick={() => verify(true)}>I verified this gap</button>}
              <p className="text-xs text-muted">Verify only after you have checked the cited sources and searched the wider literature.</p></section>
          </aside>
        </div>
      </>)}
    </Async>
  );
}
