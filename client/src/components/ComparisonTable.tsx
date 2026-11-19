import { Badge } from './ui';
import { NOT_STATED } from '../utils/format';

export interface Cmp {
  papers: { id: string; title: string; year?: number }[]; rows: { dimension: string; cells: (string[] | null)[] }[];
  highlights: { similarMethods: string[]; differentApproaches: { approach: string; paper: string }[]; sharedLimitations: { theme: string; papers: string[] }[]; contradictions: { concept: string; description: string }[]; unexploredCombinations: string[] };
  note: string;
}

export function ComparisonTable({ data }: { data: Cmp }) {
  const h = data.highlights;
  return (
    <div className="space-y-5">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line"><tr><th className="w-28 px-3 py-2 text-xs uppercase text-muted">Dimension</th>{data.papers.map((p, i) => <th key={p.id} className="px-3 py-2 font-serif font-semibold">Paper {String.fromCharCode(65 + i)}<div className="text-xs font-normal text-muted">{p.title}{p.year ? ` (${p.year})` : ''}</div></th>)}</tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.dimension} className="border-b border-line/60 align-top last:border-0"><th className="px-3 py-2 text-xs uppercase tracking-wide text-muted">{r.dimension}</th>
              {r.cells.map((c, i) => <td key={i} className="px-3 py-2">{c ? <ul className="space-y-1">{c.map((t, j) => <li key={j}>{t}</li>)}</ul> : <span className="italic text-muted">{NOT_STATED}</span>}</td>)}</tr>))}</tbody>
        </table>
      </div>
      <section className="card p-4"><h2 className="mb-3 text-lg">Visual comparison summary</h2>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[['Similar methods', h.similarMethods.length], ['Different approaches', h.differentApproaches.length], ['Shared limitations', h.sharedLimitations.length], ['Contradictions', h.contradictions.length], ['Unexplored combinations', h.unexploredCombinations.length]].map(([l, v]) => <div key={l} className="rounded-md border border-line bg-bg p-3"><div className="font-serif text-2xl">{v}</div><div className="text-xs text-muted">{l}</div></div>)}</div>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div><h3 className="label">Similar methodologies</h3>{h.similarMethods.length ? <div className="flex flex-wrap gap-1">{h.similarMethods.map((m) => <Badge key={m} tone="border-good/50 text-good">{m}</Badge>)}</div> : <p className="text-muted">None shared by two or more papers.</p>}</div>
          <div><h3 className="label">Different approaches</h3>{h.differentApproaches.length ? <ul className="space-y-1">{h.differentApproaches.map((d) => <li key={d.approach}><Badge tone="border-accent/50 text-accent">{d.approach}</Badge> <span className="text-xs text-muted">only in {d.paper}</span></li>)}</ul> : <p className="text-muted">None.</p>}</div>
          <div><h3 className="label">Shared limitations</h3>{h.sharedLimitations.length ? <ul className="space-y-1">{h.sharedLimitations.map((s) => <li key={s.theme}>{s.theme} <span className="text-xs text-muted">({s.papers.length} papers)</span></li>)}</ul> : <p className="text-muted">None.</p>}</div>
          <div><h3 className="label">Contradictory findings</h3>{h.contradictions.length ? <ul className="space-y-1">{h.contradictions.map((c) => <li key={c.concept}><b>{c.concept}</b>: <span className="text-muted">{c.description}</span></li>)}</ul> : <p className="text-muted">None detected.</p>}</div>
          <div className="md:col-span-2"><h3 className="label">Unexplored combinations</h3>{h.unexploredCombinations.length ? <ul className="list-disc pl-5">{h.unexploredCombinations.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-muted">None detected among the selected papers.</p>}</div>
        </div>
        <p className="mt-3 text-xs text-muted">{data.note}</p>
      </section>
    </div>
  );
}
