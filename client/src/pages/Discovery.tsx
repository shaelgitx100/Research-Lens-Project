import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PaperCard } from '../components/cards';
import { EmptyState, ErrorState, Field, Modal, OriginBadge, PageHeader, Pagination, Spinner, TagInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { api, qs } from '../services/api';
import { PaperRecord } from '../types';

interface SearchResp { provider: string; total: number; page: number; notes: string[]; results: PaperRecord[] }
const PAGE = 10;

export function Discovery() {
  const { user } = useAuth(); const { current, refresh } = useProject();
  const [f, setF] = useState({ provider: user?.preferences.research.defaultProvider || 'openalex', q: '', author: '', keywords: '', domain: user?.preferences.research.defaultDomain || '', venue: '', paperType: '', yearFrom: '', yearTo: '', openAccess: false });
  const [data, setData] = useState<SearchResp | null>(null); const [page, setPage] = useState(1); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set()); const [msg, setMsg] = useState(''); const [manual, setManual] = useState(false); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const search = async (p = 1) => {
    setLoading(true); setError(''); setMsg(''); setSel(new Set());
    try { setData(await api.get<SearchResp>(`/papers/search${qs({ ...f, openAccess: f.openAccess ? 'true' : undefined, page: p, perPage: PAGE })}`)); setPage(p); } catch (e: any) { setError(e.message); setData(null); } finally { setLoading(false); }
  };
  const searchScholar = () => { const terms = [f.q, f.keywords, f.author && `author:${f.author}`, f.venue && `source:${f.venue}`, f.yearFrom && `after:${Number(f.yearFrom) - 1}`, f.yearTo && `before:${Number(f.yearTo) + 1}`].filter(Boolean).join(' '); if (!terms) { setError('Enter search terms before opening Google Scholar.'); return; } window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(terms)}`, '_blank', 'noopener,noreferrer'); };
  const recommendations = async (paper: PaperRecord) => { if (!paper.externalId) return; setLoading(true); setError(''); try { setData(await api.get<SearchResp>(`/papers/recommendations${qs({ paperId: paper.externalId })}`)); setPage(1); } catch (e: any) { setError(e.message); } finally { setLoading(false); } };
  const submit = (e: FormEvent) => { e.preventDefault(); if (!f.q.trim() && !f.author.trim() && !f.keywords.trim()) return setError('Enter a topic, title, keywords or an author.'); search(1); };
  const importRecords = async (records: PaperRecord[]) => {
    if (!current) return setMsg('Create or select a project first.');
    setBusy(true); setMsg('');
    try { const r = await api.post<{ created: number; skipped: number }>('/papers/import', { projectId: current.id, papers: records.map(({ inLibrary, ...rest }) => rest) }); setMsg(`${r.created} added, ${r.skipped} already in this project.`); refresh(); if (data) setData({ ...data, results: data.results.map((x) => (records.includes(x) ? { ...x, inLibrary: true } : x)) }); setSel(new Set()); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file || !current) return; setBusy(true); setMsg('');
    const fd = new FormData(); fd.append('projectId', current.id); fd.append('file', file);
    try { const r = await api.upload<{ pages: number; paper: { id: string } }>('/papers/upload', fd); setMsg(`PDF uploaded (${r.pages} pages). Open it in the library to review the title and analyze it.`); refresh(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  return (
    <>
      <PageHeader title="Paper Discovery" subtitle={current ? <>Adding to project: <b>{current.title}</b></> : 'Create a project first, then add papers to it.'} actions={<><button className="btn" onClick={() => setManual(true)}>Import manually</button><button className="btn" onClick={() => fileRef.current?.click()} disabled={busy || !current}>Upload PDF</button><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload PDF" /></>} />
      <form onSubmit={submit} className="card mb-5 space-y-3 p-4" noValidate>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Topic or title"><input className="input" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="explainable AI fidelity metrics" /></Field>
          <Field label="Author"><input className="input" value={f.author} onChange={(e) => set('author', e.target.value)} /></Field>
          <Field label="Keywords"><input className="input" value={f.keywords} onChange={(e) => set('keywords', e.target.value)} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Source"><select className="input" value={f.provider} onChange={(e) => set('provider', e.target.value)}><option value="openalex">OpenAlex</option><option value="semanticscholar">Semantic Scholar</option><option value="crossref">Crossref</option><option value="arxiv">arXiv preprints</option><option value="core">CORE (API key required)</option><option value="pubmed">PubMed</option><option value="doaj">DOAJ</option></select></Field>
          <Field label="Year from"><input className="input" inputMode="numeric" value={f.yearFrom} onChange={(e) => set('yearFrom', e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          <Field label="Year to"><input className="input" inputMode="numeric" value={f.yearTo} onChange={(e) => set('yearTo', e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          <Field label="Domain"><input className="input" value={f.domain} onChange={(e) => set('domain', e.target.value)} /></Field>
          <Field label="Venue"><input className="input" value={f.venue} onChange={(e) => set('venue', e.target.value)} /></Field>
          <Field label="Paper type"><select className="input" value={f.paperType} onChange={(e) => set('paperType', e.target.value)}><option value="">Any</option>{['journal', 'conference', 'preprint', 'book'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.openAccess} onChange={(e) => set('openAccess', e.target.checked)} />Open access only</label><div className="flex gap-2"><button type="button" className="btn" onClick={searchScholar} disabled={loading}>Search Google Scholar</button><button className="btnPrimary" disabled={loading}>{loading ? 'Searching' : 'Search publications'}</button></div></div>
      </form>
      {error && <ErrorState message={error} />}
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg} {msg.includes('PDF uploaded') && <Link className="link" to="/app/library">Open library</Link>}</p>}
      {loading && <Spinner label="Searching academic databases" />}
      {!loading && data && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span><OriginBadge kind="retrieved" /> {data.total.toLocaleString()} results from {data.provider}. Records are shown exactly as returned by the provider.</span>
            <button className="btn" disabled={!sel.size || busy} onClick={() => importRecords([...sel].map((i) => data.results[i]))}>Add {sel.size || ''} selected to project</button></div>
          {data.notes.map((n) => <p key={n} className="mb-1 text-xs text-muted">{n}</p>)}
          {data.results.length === 0 ? <EmptyState title="No results" hint="Try broader terms, another source, or import the paper manually." /> : (
            <div className="grid gap-3">{data.results.map((r, i) => <PaperCard key={`${r.externalId}${i}`} paper={r} selected={sel.has(i)} onToggle={() => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} actions={<><button className="btn" disabled={busy || r.inLibrary} onClick={() => importRecords([r])}>{r.inLibrary ? 'Added' : 'Add to project'}</button>{r.source === 'semanticscholar' && <button className="btn" disabled={loading} onClick={() => recommendations(r)}>Find related papers</button>}</>} />)}</div>
          )}
          <Pagination page={page} pages={Math.min(pages, 200)} onPage={search} />
        </>
      )}
      {!loading && !data && !error && <EmptyState title="Search the academic literature" hint="Search OpenAlex, Semantic Scholar, Crossref, arXiv, CORE, PubMed or DOAJ. Google Scholar opens in a separate tab for exploratory searches; it has no official public search API." />}
      <ManualImport open={manual} onClose={() => setManual(false)} onImport={async (r) => { await importRecords([r]); setManual(false); }} />
    </>
  );
}

function ManualImport({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (r: PaperRecord) => Promise<void> }) {
  const [f, setF] = useState({ title: '', authors: '', abstract: '', year: '', venue: '', DOI: '', url: '', keywords: [] as string[] }); const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!f.title.trim()) return setErr('A title is required.');
    if (f.url && !/^https?:\/\//i.test(f.url)) return setErr('The link must start with http or https.');
    const year = f.year ? Number(f.year) : undefined; if (f.year && (year! < 1500 || year! > 2200)) return setErr('Enter a valid year.');
    await onImport({ title: f.title.trim(), authors: f.authors.split(/[;\n]/).map((s) => s.trim()).filter(Boolean), abstract: f.abstract.trim(), publicationYear: year, venue: f.venue.trim(), paperType: 'other', DOI: f.DOI.trim() || undefined, source: 'manual', keywords: f.keywords, publicationUrl: f.url.trim(), openAccess: false, citationCount: null, referencedWorks: [] });
    setF({ title: '', authors: '', abstract: '', year: '', venue: '', DOI: '', url: '', keywords: [] }); setErr('');
  };
  return (
    <Modal open={open} onClose={onClose} title="Import a paper manually" wide>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <p className="text-xs text-muted">Enter only what the paper itself states. Leave unknown fields empty. Do not guess DOIs or authors.</p>
        <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Authors" hint="Separate with semicolons."><input className="input" value={f.authors} onChange={(e) => setF({ ...f, authors: e.target.value })} /></Field>
        <div className="grid gap-3 md:grid-cols-3"><Field label="Year"><input className="input" inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field><Field label="Venue"><input className="input" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field><Field label="DOI"><input className="input" value={f.DOI} onChange={(e) => setF({ ...f, DOI: e.target.value })} /></Field></div>
        <Field label="Paper link"><input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>
        <Field label="Keywords"><TagInput value={f.keywords} onChange={(v) => setF({ ...f, keywords: v })} /></Field>
        <Field label="Abstract" hint="Needed for analysis unless you upload the PDF."><textarea className="input min-h-[120px]" value={f.abstract} onChange={(e) => setF({ ...f, abstract: e.target.value })} /></Field>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btnPrimary">Add paper</button></div>
      </form>
    </Modal>
  );
}
