import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PaperTable } from '../components/cards';
import { Async, Badge, DemoBadge, EmptyState, Field, OriginBadge, PageHeader, Pagination, TagInput } from '../components/ui';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api, qs } from '../services/api';
import { Analysis, Paper, Pagination as P } from '../types';
import { FIELD_LABEL, NOT_STATED } from '../utils/format';

export function Library() {
  const { current } = useProject(); const [sp] = useSearchParams();
  const [scope, setScope] = useState<'project' | 'all'>('project');
  const [f, setF] = useState({ q: sp.get('q') || '', year: '', collection: '', tag: '', read: '', analysis: '', sort: 'added' }); const [page, setPage] = useState(1);
  const dq = useDebounce(f.q, 350);
  useEffect(() => setPage(1), [dq, f.year, f.collection, f.tag, f.read, f.analysis, f.sort, scope]);
  const url = `/papers${qs({ ...f, q: dq, projectId: scope === 'project' ? current?.id : undefined, page, limit: 20 })}`;
  const { data, loading, error, reload, setData } = useAsync(() => api.get<{ papers: Paper[]; pagination: P }>(url), [url], scope === 'all' || !!current);
  const toggleRead = async (p: Paper) => { await api.patch(`/papers/${p.id}`, { read: !p.read }); setData((d) => (d ? { ...d, papers: d.papers.map((x) => (x.id === p.id ? { ...x, read: !x.read } : x)) } : d)); };
  return (
    <>
      <PageHeader title="Literature Library" subtitle="Saved papers with notes, tags, collections and read status." actions={<Link className="btnPrimary" to="/app/discovery">Add papers</Link>} />
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-4 lg:grid-cols-8">
        <div className="md:col-span-2"><Field label="Search"><input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Title, author, keyword, note" /></Field></div>
        <Field label="Scope"><select className="input" value={scope} onChange={(e) => setScope(e.target.value as any)}><option value="project">Active project</option><option value="all">All projects</option></select></Field>
        <Field label="Year"><input className="input" inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
        <Field label="Collection"><input className="input" value={f.collection} onChange={(e) => setF({ ...f, collection: e.target.value })} /></Field>
        <Field label="Tag"><input className="input" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} /></Field>
        <Field label="Status"><select className="input" value={f.analysis || f.read} onChange={(e) => { const v = e.target.value; setF({ ...f, analysis: ['analyzed', 'unanalyzed'].includes(v) ? v : '', read: ['true', 'false'].includes(v) ? v : '' }); }}><option value="">Any</option><option value="analyzed">Analyzed</option><option value="unanalyzed">Not analyzed</option><option value="true">Read</option><option value="false">Unread</option></select></Field>
        <Field label="Sort"><select className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="added">Recently added</option><option value="title">Title</option><option value="date">Publication year</option><option value="relevance">Relevance</option></select></Field>
      </div>
      <Async loading={loading} error={error} onRetry={reload}>
        {data && data.papers.length === 0 ? <EmptyState title="No papers found" hint="Add papers from Paper Discovery or adjust the filters." /> : data && (<><PaperTable papers={data.papers} onToggleRead={toggleRead} /><Pagination page={data.pagination.page} pages={data.pagination.pages} onPage={setPage} /></>)}
      </Async>
    </>
  );
}

export function PaperDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get<{ paper: Paper & { fullTextLength: number }; analysis: Analysis | null }>(`/papers/${id}`), [id]);
  const [notes, setNotes] = useState(''); const [tags, setTags] = useState<string[]>([]); const [cols, setCols] = useState<string[]>([]); const [saved, setSaved] = useState('');
  useEffect(() => { if (data) { setNotes(data.paper.notes); setTags(data.paper.tags); setCols(data.paper.collections); } }, [data]);
  const p = data?.paper;
  const save = async () => { await api.patch(`/papers/${id}`, { notes, tags: tags.map((t) => t.trim()).filter(Boolean), collections: cols.map((t) => t.trim()).filter(Boolean) }); setSaved('Saved'); setTimeout(() => setSaved(''), 1500); };
  const remove = async () => { if (!window.confirm('Remove this paper from the library?')) return; await api.del(`/papers/${id}`); nav('/app/library'); };
  const sections = ['researchObjective', 'methodology', 'findings', 'limitations', 'futureWork'] as const;
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {p && (<>
        <PageHeader title={p.title} subtitle={[p.authors.join(', '), p.publicationYear, p.venue].filter(Boolean).join(' \u00b7 ')} actions={<><DemoBadge show={p.isDemo} /><Link className="btnPrimary" to={`/app/analysis/${p.id}`}>{data?.analysis ? 'View analysis' : 'Analyze paper'}</Link><Link className="btn" to="/app/citations">Citations</Link><button className="btn" onClick={remove}>Remove</button></>} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="card space-y-3 p-4">
              <div className="flex items-center gap-2"><h2 className="text-lg">Bibliographic information</h2><OriginBadge kind="retrieved" /></div>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                {[['Source', p.source], ['Type', p.paperType], ['Year', p.publicationYear], ['Venue', p.venue], ['Citation count', p.citationCount ?? 'Not available'], ['Open access', p.openAccess ? 'Yes' : 'No or unknown'], ['External identifier', p.externalId]].map(([k, v]) => v !== undefined && v !== '' && <div key={String(k)}><dt className="label">{k}</dt><dd className="break-words text-muted">{String(v)}</dd></div>)}
                <div><dt className="label">DOI</dt><dd>{p.DOI ? <a className="link" href={`https://doi.org/${p.DOI}`} target="_blank" rel="noopener noreferrer">{p.DOI}</a> : <span className="text-muted">Not available</span>}</dd></div>
                {p.publicationUrl && /^https?:\/\//.test(p.publicationUrl) && <div><dt className="label">Paper link</dt><dd><a className="link break-all" href={p.publicationUrl} target="_blank" rel="noopener noreferrer">{p.publicationUrl}</a></dd></div>}
              </dl>
              <div><span className="label">Keywords</span><div className="flex flex-wrap gap-1">{p.keywords.map((k) => <Badge key={k}>{k}</Badge>)}{!p.keywords.length && <span className="text-sm text-muted">None stored</span>}</div></div>
              <div><span className="label">Abstract</span><p className="text-sm leading-relaxed text-muted">{p.abstract || 'No abstract stored.'}</p></div>
              {p.source !== 'manual' && p.source !== 'pdf' && <p className="text-xs text-muted">Retrieved metadata is preserved and cannot be edited. Use notes and tags for your own information.</p>}
            </section>
            <section className="card space-y-4 p-4">
              <div className="flex items-center justify-between"><h2 className="text-lg">Extracted analysis</h2>{data?.analysis && <OriginBadge kind="source" />}</div>
              {!data?.analysis ? <p className="text-sm text-muted">This paper has not been analyzed yet.</p> : sections.map((s) => (
                <div key={s}><h3 className="label">{FIELD_LABEL[s]}</h3>{data.analysis![s].length ? <ul className="list-disc space-y-1 pl-5 text-sm">{data.analysis![s].map((e, i) => <li key={i}>{e.text} <span className="text-xs text-muted">({[e.section, e.page && `p. ${e.page}`].filter(Boolean).join(', ') || 'source'})</span></li>)}</ul> : <p className="text-sm italic text-muted">{NOT_STATED}</p>}</div>
              ))}
            </section>
          </div>
          <aside className="card space-y-4 self-start p-4">
            <h2 className="text-lg">Your notes</h2>
            <Field label="Personal notes"><textarea className="input min-h-[140px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={8000} /></Field>
            <Field label="Research tags" hint="Comma separated."><TagInput value={tags} onChange={setTags} /></Field>
            <Field label="Collections" hint="Comma separated."><TagInput value={cols} onChange={setCols} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.read} onChange={async (e) => { await api.patch(`/papers/${id}`, { read: e.target.checked }); reload(); }} />Marked as read</label>
            <div className="flex items-center gap-3"><button className="btnPrimary" onClick={save}>Save</button><span className="text-sm text-good" role="status">{saved}</span></div>
            {p.hasFullText && <p className="text-xs text-muted">Full text stored ({Math.round(p.fullTextLength / 1000)}k characters).</p>}
          </aside>
        </div>
      </>)}
    </Async>
  );
}
