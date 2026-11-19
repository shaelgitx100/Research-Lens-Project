import { BarChart, ResearchTimeline } from '../charts/charts';
import { Async, Badge, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';

interface T {
  totalPapers: number; datedPapers: number; publicationsPerYear: { year: number; count: number }[]; keywords: { keyword: string; count: number }[];
  methods: { label: string; group: string; count: number }[]; underrepresented: string[]; domains: { domain: string; count: number }[];
  growth: { keyword: string; earlier: number; later: number; years: number[]; total: number; direction: string }[]; topicRelations: { phrase: string; count: number }[]; notes: string[];
}

export function Trends() {
  const { current } = useProject();
  const { data, loading, error, reload } = useAsync(() => api.get<T>(`/trends/${current!.id}`), [current?.id], !!current);
  return (
    <>
      <PageHeader title="Research Trends" subtitle="Analytics computed from the publication metadata and analyses stored in this project." />
      {!current ? <EmptyState title="No active project" /> : (
        <Async loading={loading} error={error} onRetry={reload}>
          {data && data.totalPapers === 0 ? <EmptyState title="No papers to analyze" hint="Add papers to see publication trends." /> : data && (
            <div className="space-y-6">
              {data.notes.map((n) => <p key={n} className="card px-4 py-2.5 text-xs text-muted">{n}</p>)}
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-4"><h2 className="mb-3 text-lg">Publications per year</h2><ResearchTimeline data={data.publicationsPerYear} /><p className="mt-1 text-xs text-muted">{data.datedPapers} of {data.totalPapers} papers have a publication year.</p></section>
                <section className="card p-4"><h2 className="mb-3 text-lg">Popular research keywords</h2><BarChart items={data.keywords.slice(0, 10).map((k) => ({ label: k.keyword, value: k.count }))} /></section>
                <section className="card p-4"><h2 className="mb-3 text-lg">Frequently used methods</h2><BarChart color="rgb(112 190 142)" items={data.methods.slice(0, 10).map((m) => ({ label: m.label, value: m.count }))} /><p className="mt-2 text-xs text-muted">Detected by keyword rules in analyzed methodology text.</p></section>
                <section className="card p-4"><h2 className="mb-3 text-lg">Research domain distribution</h2><BarChart color="rgb(var(--amber))" items={data.domains.map((d) => ({ label: d.domain, value: d.count }))} /></section>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <section className="card p-4 lg:col-span-2"><h2 className="mb-1 text-lg">Emerging or declining subtopics</h2><p className="mb-3 text-xs text-muted">Reported only for keywords with at least 4 papers across 3 or more years. This describes your collection, not the whole field.</p>
                  {data.growth.length === 0 ? <p className="text-sm text-muted">The available time series does not support any emerging or declining claim.</p> : <ul className="space-y-2 text-sm">{data.growth.map((g) => <li key={g.keyword} className="flex flex-wrap items-center justify-between gap-2"><span>{g.keyword} <span className="text-xs text-muted">({g.years[0]} to {g.years[g.years.length - 1]}, {g.total} papers)</span></span><Badge tone={g.direction === 'increasing' ? 'border-good/50 text-good' : 'border-amber/50 text-amber'}>{g.direction}: {g.earlier} then {g.later}</Badge></li>)}</ul>}</section>
                <section className="card p-4"><h2 className="mb-2 text-lg">Underrepresented methods</h2>{data.underrepresented.length ? <div className="flex flex-wrap gap-1">{data.underrepresented.map((u) => <Badge key={u}>{u}</Badge>)}</div> : <p className="text-sm text-muted">None detected.</p>}<p className="mt-2 text-xs text-muted">Methods used by only one analyzed paper.</p></section>
              </div>
              <section className="card p-4"><h2 className="mb-2 text-lg">Topic relationships</h2>{data.topicRelations.length ? <div className="flex flex-wrap gap-1.5">{data.topicRelations.map((t) => <Badge key={t.phrase}>{t.phrase} ({t.count})</Badge>)}</div> : <p className="text-sm text-muted">No repeated keyword phrases yet.</p>}</section>
            </div>
          )}
        </Async>
      )}
    </>
  );
}
