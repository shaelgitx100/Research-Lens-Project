import { Link } from 'react-router-dom';
import { DEMO_STATS } from '../utils/format';
import { Badge } from '../components/ui';

const GRAPH_NODES = [
  { x: 300, y: 200, r: 11, c: '#e0b45e', l: 'Research topic' }, { x: 140, y: 110, r: 7, c: '#60b0d2', l: 'Paper' }, { x: 470, y: 90, r: 7, c: '#60b0d2', l: 'Paper' },
  { x: 120, y: 280, r: 7, c: '#60b0d2', l: 'Paper' }, { x: 500, y: 290, r: 7, c: '#60b0d2', l: 'Paper' }, { x: 300, y: 70, r: 6, c: '#7dc9a3', l: 'Method' },
  { x: 300, y: 330, r: 6, c: '#e08a6e', l: 'Limitation' }, { x: 420, y: 190, r: 6, c: '#b08ad6', l: 'Dataset' }, { x: 190, y: 190, r: 6, c: '#7dc9a3', l: 'Method' },
  { x: 560, y: 180, r: 9, c: '#f0d070', l: 'Emerging area' },
];
const GRAPH_EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [2, 5], [4, 7], [3, 6], [1, 8], [7, 9], [4, 9]];

function HeroGraph() {
  return (
    <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label="Illustration of a knowledge graph linking papers, topics and emerging research areas">
      {GRAPH_EDGES.map(([a, b], i) => <line key={i} x1={GRAPH_NODES[a].x} y1={GRAPH_NODES[a].y} x2={GRAPH_NODES[b].x} y2={GRAPH_NODES[b].y} stroke="rgb(var(--muted))" strokeOpacity="0.5" className="pulseLine" style={{ animationDelay: `${i * 0.3}s` }} />)}
      {GRAPH_NODES.map((n, i) => (
        <g key={i} className="drift" style={{ animationDelay: `${i * 0.6}s` }}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} /><circle cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke={n.c} strokeOpacity="0.35" />
          <text x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">{n.l}</text>
        </g>
      ))}
    </svg>
  );
}

const CAPS = [
  ['Academic Paper Discovery', 'Search OpenAlex, Crossref and Semantic Scholar, or import papers and upload PDFs. Retrieved metadata is never altered or invented.'],
  ['Literature Analysis', 'Extract objectives, methods, datasets, findings, limitations and future work, each tied to a section and page.'],
  ['Research Gap Detection', 'Compare studies to surface repeated limitations, methodological imbalance, dataset limits and conflicting findings.'],
  ['Knowledge Graph Mapping', 'Explore papers, authors, methods, datasets and limitations as an interactive graph built from real extracted relationships.'],
  ['Citation Network Analysis', 'See which papers cite one another inside your collection, with honest coverage notes when reference data is missing.'],
  ['Research Question Generation', 'Turn evidence supported gaps into candidate questions with methodology, datasets, metrics and feasibility. Always labeled as proposals.'],
];
const STEPS = ['Research Topic', 'Paper Collection', 'Literature Analysis', 'Gap Identification', 'Research Questions'];

export function Landing() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-14 md:grid-cols-2 md:pt-20">
        <div className="fadeUp">
          <Badge tone="border-accent/40 text-accent">Academic research intelligence</Badge>
          <h1 className="mt-4 text-4xl leading-tight md:text-5xl">Discover the Research Nobody Has Explored Yet.</h1>
          <p className="mt-4 max-w-xl text-muted">Analyze academic literature, uncover research limitations, map scientific knowledge, and discover evidence supported opportunities for your next research project.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="btnPrimary">Start Discovering</Link>
            <Link to="/app/workspace" className="btn">Explore Research Workspace</Link>
          </div>
          <p className="mt-6 font-serif text-sm italic text-muted">See the research. Find the gap. Create the future.</p>
        </div>
        <div className="card p-3"><HeroGraph /><p className="px-2 pb-1 text-[11px] text-muted">Illustration only. In the app every connection comes from stored paper metadata or analyzed text.</p></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl">Finding a research gap by hand is slow and unreliable</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[['Too much literature', 'Thousands of papers appear every year in a single subfield. No one can read them all closely.'], ['Limitations hide in the text', 'Authors state limits and future work in passing. Spotting the same limit across ten papers takes weeks.'], ['Claims need evidence', 'A gap is only credible when you can point to the exact sentences and papers that support it.']].map(([t, d]) => (
            <div key={t} className="card p-5"><h3 className="text-lg">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-3xl">Platform capabilities</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CAPS.map(([t, d]) => <div key={t} className="card p-5 transition hover:border-accent/50"><h3 className="text-lg">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-5">
          {STEPS.map((s, i) => <li key={s} className="card relative p-4"><span className="font-serif text-2xl text-accent">{i + 1}</span><div className="mt-1 text-sm">{s}</div></li>)}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-3xl">Research intelligence preview</h2>
        <p className="mt-1 text-sm text-muted">Example dashboard with demonstration numbers. Nothing here comes from real papers.</p>
        <div className="card mt-5 p-5">
          <div className="mb-4 flex items-center gap-2"><Badge tone="border-amber/50 text-amber">DEMO DATA</Badge></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[['Papers', DEMO_STATS.papers], ['Topics', DEMO_STATS.topics], ['Limitations', DEMO_STATS.limitations], ['Potential gaps', DEMO_STATS.gaps], ['Questions', DEMO_STATS.questions]].map(([l, v]) => (
              <div key={l} className="rounded-md border border-line bg-bg p-3"><div className="font-serif text-2xl">{v}</div><div className="text-xs text-muted">{l}</div></div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line bg-bg p-4 text-sm"><div className="mb-1 text-xs uppercase tracking-wide text-muted">Potential research gap</div>Fidelity metrics are mostly evaluated on linear or simple models.<div className="mt-2"><Badge tone="border-good/50 text-good">Evidence supported gap</Badge> <span className="text-xs text-muted">4 of 10 papers</span></div></div>
            <div className="rounded-md border border-line bg-bg p-4 text-sm"><div className="mb-1 text-xs uppercase tracking-wide text-muted">Knowledge relationships</div>Paper to method, dataset and limitation links are extracted from analyzed text and shown in an interactive map.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Your next research breakthrough starts with a better question.</h2>
        <div className="mt-7 flex justify-center gap-3"><Link to="/register" className="btnPrimary">Start Discovering</Link><Link to="/features" className="btn">See all features</Link></div>
      </section>
    </main>
  );
}
