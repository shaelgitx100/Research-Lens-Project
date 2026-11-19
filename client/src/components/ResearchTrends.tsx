import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpRight, Compass, LoaderCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './research-trends.css';

type TrendPaper = {
  title: string;
  authors?: string[];
  publicationYear?: number;
  venue?: string;
  keywords?: string[];
  publicationUrl?: string;
  DOI?: string;
  citationCount?: number | null;
  openAccess?: boolean;
};

type TrendResponse = {
  provider: string;
  query: string;
  total: number;
  yearFrom: number;
  yearTo: number;
  yearlyCounts: { year: number; count: number }[];
  papers: TrendPaper[];
  notes: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function isTrendResponse(value: unknown): value is TrendResponse {
  if (!isRecord(value)) return false;
  return typeof value.provider === 'string'
    && typeof value.query === 'string'
    && Number.isInteger(value.total)
    && Number.isInteger(value.yearFrom)
    && Number.isInteger(value.yearTo)
    && Array.isArray(value.yearlyCounts)
    && value.yearlyCounts.every((item) => isRecord(item)
      && Number.isInteger(item.year)
      && Number.isInteger(item.count))
    && Array.isArray(value.papers)
    && value.papers.every((paper) => isRecord(paper)
      && typeof paper.title === 'string'
      && (paper.authors === undefined || (Array.isArray(paper.authors) && paper.authors.every((author) => typeof author === 'string')))
      && (paper.keywords === undefined || (Array.isArray(paper.keywords) && paper.keywords.every((keyword) => typeof keyword === 'string')))
      && (paper.citationCount === undefined || paper.citationCount === null || typeof paper.citationCount === 'number'))
    && Array.isArray(value.notes)
    && value.notes.every((note) => typeof note === 'string');
}

export default function ResearchTrends({ projectTitle, onDiscover }: {
  projectTitle?: string;
  onDiscover: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState(projectTitle || '');
  const [fromYear, setFromYear] = useState(String(currentYear - 5));
  const [toYear, setToYear] = useState(String(currentYear));
  const [result, setResult] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    setQuery(projectTitle || '');
    setResult(null);
    setError('');
  }, [projectTitle]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (result?.papers || []).forEach((paper) => (paper.keywords || []).forEach((keyword) => {
      const topic = keyword.trim();
      if (topic) counts.set(topic, (counts.get(topic) || 0) + 1);
    }));
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  }, [result]);
  const visiblePapers = (result?.papers || []).filter((paper) =>
    !selectedTopic || paper.keywords?.includes(selectedTopic),
  );
  const chartData = useMemo(() => {
    if (!result) return [];
    const counts = new Map(result.yearlyCounts.map((item) => [item.year, item.count]));
    const from = result.yearFrom;
    const to = result.yearTo;
    return Array.from({ length: Math.min(to - from + 1, 701) }, (_, index) => {
      const year = from + index;
      return { year, papers: counts.get(year) || 0 };
    });
  }, [result]);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const from = Number(fromYear);
    const to = Number(toYear);
    if (!query.trim()) return setError('Enter a research topic to analyze.');
    if (!Number.isInteger(from) || from < 1500 || from > 2200 || !Number.isInteger(to) || to < 1500 || to > 2200) {
      return setError('Enter valid years between 1500 and 2200.');
    }
    if (from > to) return setError('From year must be less than or equal to to year.');
    setLoading(true);
    setError('');
    setSelectedTopic('');
    try {
      const params = new URLSearchParams({ q: query.trim(), yearFrom: String(from), yearTo: String(to) });
      const response = await fetch(`/api/papers/trends?${params}`);
      const body = await response.text();
      const data: unknown = body ? JSON.parse(body) : null;
      if (!response.ok) {
        const message = isRecord(data) && typeof data.error === 'string'
          ? data.error
          : `Trend lookup failed (${response.status}).`;
        throw new Error(message);
      }
      if (!isTrendResponse(data)) throw new Error('The trend service returned an invalid response. Please refresh and try again.');
      setResult(data);
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load live publication trends.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="research-trends">
      <section className="panel trends-overview">
        <div className="trends-heading">
          <div>
            <div className="section-kicker">LIVE ACADEMIC TREND SEARCH</div>
            <h2>{projectTitle || 'Research trends'}</h2>
            <p>Explore publication volume and highly cited papers for a research topic across a year range.</p>
          </div>
          <div className="trends-total"><TrendingUp size={17}/><strong>{result?.total.toLocaleString() || '—'}</strong><span>matching works</span></div>
        </div>

        <form className="trends-filters" onSubmit={(event) => void runSearch(event)}>
          <label className="trends-query">Research topic<input aria-label="Research topic" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={300} placeholder="e.g. secure data mining" required/></label>
          <label>From year<input type="number" inputMode="numeric" min="1500" max="2200" step="1" aria-label="Filter from year" value={fromYear} onChange={(event) => setFromYear(event.target.value)} required/></label>
          <label>To year<input type="number" inputMode="numeric" min="1500" max="2200" step="1" aria-label="Filter to year" value={toYear} onChange={(event) => setToYear(event.target.value)} required/></label>
          <button className="trends-search" type="submit" disabled={loading}>{loading ? <LoaderCircle className="trends-spin" size={14}/> : <RefreshCw size={14}/>} {loading ? 'Updating…' : result ? 'Refresh trends' : 'Show trends'}</button>
        </form>

        <div className="trends-live-note" role="status">
          <span className="trends-live-dot"/><strong>Live OpenAlex lookup</strong>
          {refreshedAt && <span>Updated {refreshedAt}</span>}
          <span>Citations are cumulative provider counts, not real-time citation velocity.</span>
        </div>
        {error && <div className="trends-error" role="alert">{error}</div>}

        {result && <>
          <div className="trends-section-head">
            <div><div className="section-kicker">PUBLICATION ACTIVITY</div><h3>Works published each year</h3></div>
            <span>{result.yearFrom.toLocaleString()}–{result.yearTo.toLocaleString()} · {result.total.toLocaleString()} works</span>
          </div>
          {chartData.length ? (
            <div className="trends-chart" aria-label="Interactive spline chart of OpenAlex publication counts by year">
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 16, right: 18, bottom: 4, left: -12 }}>
                  <defs><linearGradient id="trend-live-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#91d4ad" stopOpacity={0.3}/><stop offset="100%" stopColor="#91d4ad" stopOpacity={0.015}/></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/>
                  <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} allowDecimals={false} tickMargin={9}/>
                  <YAxis width={72} tickFormatter={(value: number) => value.toLocaleString()} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickMargin={8}/>
                  <Tooltip cursor={{ stroke: 'var(--accent)', strokeDasharray: '4 4', strokeOpacity: 0.55 }} labelFormatter={(label) => `Year ${label}`} formatter={(value) => [Number(value).toLocaleString(), 'Matching works']} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 12, boxShadow: '0 10px 28px rgba(0,0,0,.2)' }}/>
                  <Area type="monotone" dataKey="papers" name="Matching works" stroke="#91d4ad" strokeWidth={2.8} fill="url(#trend-live-fill)" dot={{ r: 3, fill: '#91d4ad', stroke: 'var(--panel)', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#91d4ad', stroke: 'var(--panel)', strokeWidth: 3 }} animationDuration={450}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="trends-no-years"><h3>No indexed works in this period</h3><p>Try a broader topic or a wider year range.</p></div>}

          {!!topicCounts.length && <div className="trends-topic-filters" aria-label="Filter highly cited papers by topic">
            <button type="button" className={!selectedTopic ? 'active' : ''} aria-pressed={!selectedTopic} onClick={() => setSelectedTopic('')}>All topics</button>
            {topicCounts.map(([topic, count]) => <button type="button" key={topic} className={selectedTopic === topic ? 'active' : ''} aria-pressed={selectedTopic === topic} onClick={() => setSelectedTopic((current) => current === topic ? '' : topic)}>{topic}<span>{count}</span></button>)}
          </div>}

          <div className="trends-results">
            <div className="trends-results-heading">
              <div><div className="section-kicker">MOST CITED IN THIS YEAR RANGE</div><h3>{selectedTopic || 'Highly cited matching papers'}</h3></div>
              <span>{visiblePapers.length} shown · up to 25</span>
            </div>
            {visiblePapers.length ? <div className="trends-paper-list">{visiblePapers.map((paper, index) => {
              const href = paper.publicationUrl || (paper.DOI ? `https://doi.org/${paper.DOI}` : '');
              return <article className="trends-paper" key={`${paper.DOI || paper.title}-${index}`}>
                <span className="trends-rank">{String(index + 1).padStart(2, '0')}</span>
                <div className="trends-paper-copy"><strong>{paper.title}</strong><p>{paper.authors?.slice(0, 5).join(', ') || 'Authors unavailable'} · {paper.publicationYear || 'Year unavailable'}{paper.venue ? ` · ${paper.venue}` : ''}</p>
                  {paper.keywords?.length ? <div className="trends-paper-topics">{paper.keywords.slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div> : null}
                </div>
                <div className="trends-citations"><ArrowDownWideNarrow size={14}/><strong>{paper.citationCount?.toLocaleString() ?? '—'}</strong><small>citations</small></div>
                {href && <a className="trends-paper-link" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${paper.title}`}><ArrowUpRight size={15}/></a>}
              </article>;
            })}</div> : <p className="trends-no-papers">No matching papers for this topic filter.</p>}
            <small className="trends-ranking-note">Ranked by cumulative citation counts reported by OpenAlex. Counts vary by provider and publication age.</small>
          </div>
        </>}

        {!result && !loading && <div className="trends-no-years"><h3>Choose a topic and year range</h3><p>Run a live OpenAlex lookup to chart publication activity and rank the most-cited matching papers.</p><button type="button" className="button primary" onClick={onDiscover}><Compass size={15}/> Discover papers</button></div>}
      </section>
    </div>
  );
}