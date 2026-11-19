import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, TopicChart } from '../charts/charts';
import { ResearchMetricCard } from '../components/cards';
import { Async, Badge, DemoBadge, EvidenceBadge, PageHeader, ProgressBar } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { CATEGORY_LABEL, DEMO_STATS, fmtDate, STATUS_LABEL } from '../utils/format';

interface Dash {
  counts: typeof DEMO_STATS; realPapers: number;
  recentPapers: { id: string; title: string; year?: number; isDemo: boolean }[]; recentAnalyses: { paperId: string; title: string; at: string }[];
  recentProjects: { id: string; title: string; status: string; isDemo: boolean; createdAt: string }[];
  gapOverview: { category: string; count: number }[]; topicDistribution: { keyword: string; count: number }[];
  progress: { id: string; title: string; status: string; isDemo: boolean; papers: number; analyzed: number; progress: number }[];
  emerging: { keyword: string; earlier: number; later: number; total: number }[];
  discoveries: { id: string; title: string; label: string; composite: number; excerpt?: string; isDemo: boolean }[];
}

export function Dashboard() {
  const { user } = useAuth(); const { refresh, projects } = useProject(); const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get<Dash>('/dashboard'), []);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const loadDemo = async () => { setBusy(true); setMsg(''); try { await api.post('/demo/load'); await refresh(); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  const demo = !!data && data.realPapers === 0;
  const c = demo ? DEMO_STATS : data?.counts;
  return (
    <>
      <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] || 'researcher'}`} subtitle="Your research intelligence overview." actions={<>
        {projects.some((p) => p.isDemo) ? null : <button className="btn" onClick={loadDemo} disabled={busy}>{busy ? 'Loading demo' : 'Load demo environment'}</button>}
        <button className="btnPrimary" onClick={() => nav('/app/workspace?new=1')}>New research project</button></>} />
      {msg && <p className="mb-4 text-sm text-bad" role="alert">{msg}</p>}
      <Async loading={loading} error={error} onRetry={reload}>
        {data && c && (
          <div className="space-y-6">
            {demo && <div className="card flex flex-wrap items-center gap-2 border-amber/40 px-4 py-3 text-sm"><DemoBadge /><span className="text-muted">The numbers below are demonstration data. They will switch to your real counts once you collect and analyze papers.</span></div>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <ResearchMetricCard label="Papers collected" value={c.papers} demo={demo} /><ResearchMetricCard label="Research topics" value={c.topics} demo={demo} /><ResearchMetricCard label="Identified limitations" value={c.limitations} demo={demo} />
              <ResearchMetricCard label="Potential research gaps" value={c.gaps} demo={demo} /><ResearchMetricCard label="Research questions" value={c.questions} demo={demo} /><ResearchMetricCard label="Active research projects" value={c.activeProjects} demo={demo} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="card p-4 lg:col-span-2">
                <h2 className="mb-3 text-lg">Research activity</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><h3 className="label">Recently analyzed</h3><ul className="space-y-1.5 text-sm">{data.recentAnalyses.length ? data.recentAnalyses.map((a) => <li key={a.paperId}><Link className="hover:text-accent" to={`/app/analysis/${a.paperId}`}>{a.title}</Link></li>) : <li className="text-muted">No analyses yet.</li>}</ul></div>
                  <div><h3 className="label">Recent projects</h3><ul className="space-y-1.5 text-sm">{data.recentProjects.length ? data.recentProjects.map((p) => <li key={p.id}><Link className="hover:text-accent" to={`/app/workspace/${p.id}`}>{p.title}</Link> <DemoBadge show={p.isDemo} /><div className="text-xs text-muted">{STATUS_LABEL[p.status]} {'\u00b7'} {fmtDate(p.createdAt)}</div></li>) : <li className="text-muted">No projects yet.</li>}</ul></div>
                  <div><h3 className="label">New papers</h3><ul className="space-y-1.5 text-sm">{data.recentPapers.length ? data.recentPapers.map((p) => <li key={p.id}><Link className="hover:text-accent" to={`/app/library/${p.id}`}>{p.title}</Link> <DemoBadge show={p.isDemo} /></li>) : <li className="text-muted">No papers yet.</li>}</ul></div>
                </div>
              </section>
              <section className="card p-4"><h2 className="mb-3 text-lg">Research gap overview</h2><BarChart color="rgb(var(--amber))" items={data.gapOverview.map((g) => ({ label: CATEGORY_LABEL[g.category] || g.category, value: g.count }))} /><Link to="/app/gaps" className="link mt-3 inline-block text-sm">View all gaps</Link></section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="card p-4"><h2 className="mb-3 text-lg">Research topic distribution</h2><TopicChart items={data.topicDistribution.map((t) => ({ label: t.keyword, value: t.count }))} /></section>
              <section className="card p-4"><h2 className="mb-3 text-lg">Literature analysis progress</h2>
                <ul className="space-y-3">{data.progress.length ? data.progress.map((p) => <li key={p.id} className="text-sm"><div className="mb-1 flex justify-between gap-2"><Link to={`/app/workspace/${p.id}`} className="truncate hover:text-accent">{p.title}</Link><span className="text-muted">{p.progress}%</span></div><ProgressBar value={p.progress} /></li>) : <li className="text-sm text-muted">No active projects.</li>}</ul></section>
              <section className="card p-4"><h2 className="mb-1 text-lg">Emerging research areas</h2><p className="mb-3 text-xs text-muted">Shown only when a keyword has at least 4 papers over 3 or more years. Describes your collection, not the whole field.</p>
                <ul className="space-y-2 text-sm">{data.emerging.length ? data.emerging.map((e) => <li key={e.keyword} className="flex justify-between"><span>{e.keyword}</span><Badge tone="border-good/50 text-good">{e.earlier} to {e.later} papers</Badge></li>) : <li className="text-muted">Not enough dated papers to support a trend claim.</li>}</ul></section>
            </div>

            <section className="card p-4"><h2 className="mb-3 text-lg">Recent discoveries</h2>
              {data.discoveries.length === 0 ? <p className="text-sm text-muted">Analyze papers and run gap discovery to see evidence supported findings here.</p> : (
                <ul className="divide-y divide-line">{data.discoveries.map((d) => (
                  <li key={d.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><Link to={`/app/gaps/${d.id}`} className="font-serif hover:text-accent">{d.title}</Link><EvidenceBadge label={d.label} /><DemoBadge show={d.isDemo} /></div>{d.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">Source excerpt: {d.excerpt}</p>}</li>
                ))}</ul>)}
            </section>
          </div>
        )}
      </Async>
    </>
  );
}
