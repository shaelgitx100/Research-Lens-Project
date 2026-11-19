import { useEffect, useMemo, useState } from 'react';
import { Markdown } from '../utils/markdown';
import { Async, Badge, EmptyState, Field, OriginBadge, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useProject } from '../hooks/useProject';
import { api } from '../services/api';
import { Paper } from '../types';

interface Theme { themeId: string; title: string; paperIds: string[]; summary: string; summaryOrigin: 'sourceDerived' | 'userWritten' | 'aiSuggested'; notes: string }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const cite = (p: Paper) => `${p.authors.slice(0, 3).join(', ') || 'Author not stored'}${p.authors.length > 3 ? ', et al.' : ''} (${p.publicationYear ?? 'n.d.'}). ${p.title}.${p.venue ? ` ${p.venue}.` : ''}${p.DOI ? ` https://doi.org/${p.DOI}` : ''}${p.isDemo ? ' [DEMO record]' : ''}`;

export function ReviewBuilder() {
  const { current } = useProject();
  const rev = useAsync(() => api.get<{ review: { themes: Theme[] } }>(`/reviews/${current!.id}`), [current?.id], !!current);
  const pap = useAsync(() => api.get<{ papers: Paper[] }>(`/papers?projectId=${current!.id}&limit=50&sort=title`), [current?.id], !!current);
  const [themes, setThemes] = useState<Theme[]>([]); const [msg, setMsg] = useState(''); const [draft, setDraft] = useState('');
  useEffect(() => { if (rev.data) setThemes(rev.data.review.themes); }, [rev.data]);
  const papers = pap.data?.papers || []; const byId = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const upd = (i: number, patch: Partial<Theme>) => setThemes((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setThemes((t) => { const n = [...t]; const j = i + d; if (j < 0 || j >= n.length) return t; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => { try { await api.put(`/reviews/${current!.id}`, { themes }); setMsg('Review saved.'); } catch (e: any) { setMsg(e.message); } };
  const suggest = async () => { try { const r = await api.post<{ themes: Theme[]; note: string }>(`/reviews/${current!.id}/suggest`); setThemes(r.themes); setMsg(r.note); } catch (e: any) { setMsg(e.message); } };
  const build = () => {
    const used = new Map<string, number>(); const order: Paper[] = [];
    themes.forEach((t) => t.paperIds.forEach((id) => { const p = byId.get(id); if (p && !used.has(id)) { used.set(id, order.length + 1); order.push(p); } }));
    const lines = ['# Literature review draft', '', '> Draft assembled from your themes. Source derived summaries, your own text and AI suggestions are marked. Review and rewrite before use.', ''];
    themes.forEach((t, i) => {
      lines.push(`## ${i + 1}. ${t.title}`, '');
      if (t.summary.trim()) lines.push(`${t.summary.trim()} ${t.paperIds.map((id) => `[${used.get(id)}]`).filter((x) => x !== '[undefined]').join(' ')}`, '', `Origin of summary: ${t.summaryOrigin === 'sourceDerived' ? 'Source derived' : t.summaryOrigin === 'aiSuggested' ? 'AI suggested' : 'User written'}.`, '');
      if (t.notes.trim()) lines.push(`Notes (user written): ${t.notes.trim()}`, '');
    });
    lines.push('## References', '', ...order.map((p, i) => `${i + 1}. ${cite(p)}`));
    setDraft(lines.join('\n'));
  };
  return (
    <>
      <PageHeader title="Literature Review Builder" subtitle="Group papers into themes, add summaries and notes, and draft a structured review." actions={<><button className="btn" onClick={suggest} disabled={!current}>Suggest themes</button><button className="btn" onClick={() => setThemes((t) => [...t, { themeId: uid(), title: 'New theme', paperIds: [], summary: '', summaryOrigin: 'userWritten', notes: '' }])}>Add theme</button><button className="btnPrimary" onClick={save}>Save review</button></>} />
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      {!current ? <EmptyState title="No active project" /> : (
        <Async loading={rev.loading || pap.loading} error={rev.error || pap.error} onRetry={() => { rev.reload(); pap.reload(); }}>
          {themes.length === 0 ? <EmptyState title="No themes yet" hint="Add a theme or let ResearchLens suggest themes from shared keywords." /> : (
            <div className="space-y-4">{themes.map((t, i) => (
              <section key={t.themeId} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2"><input className="input !w-auto min-w-[16rem] flex-1 font-serif text-base" value={t.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label="Theme title" maxLength={200} />
                  <button className="btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">Up</button><button className="btn" onClick={() => move(i, 1)} disabled={i === themes.length - 1} aria-label="Move down">Down</button><button className="btnGhost" onClick={() => setThemes((x) => x.filter((_, j) => j !== i))}>Delete</button></div>
                <div><span className="label">Papers in this theme</span><div className="flex flex-wrap gap-1.5">{t.paperIds.map((id) => <Badge key={id} tone="border-accent/40 text-accent">{byId.get(id)?.title.slice(0, 48) || 'Missing paper'} <button className="ml-1" aria-label="Remove paper" onClick={() => upd(i, { paperIds: t.paperIds.filter((x) => x !== id) })}>x</button></Badge>)}</div>
                  <select className="input mt-2 !w-auto" value="" onChange={(e) => e.target.value && upd(i, { paperIds: [...new Set([...t.paperIds, e.target.value])] })} aria-label="Add paper to theme"><option value="">Add a paper</option>{papers.filter((p) => !t.paperIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.title.slice(0, 80)}</option>)}</select></div>
                <Field label="Summary"><textarea className="input min-h-[90px]" value={t.summary} onChange={(e) => upd(i, { summary: e.target.value, summaryOrigin: 'userWritten' })} /></Field>
                <div className="flex items-center gap-2 text-xs text-muted">Origin: <OriginBadge kind={t.summaryOrigin === 'sourceDerived' ? 'source' : t.summaryOrigin === 'aiSuggested' ? 'ai' : 'user'} />{t.summaryOrigin === 'sourceDerived' && 'Editing the text marks it as user written.'}</div>
                <Field label="Literature notes"><textarea className="input" value={t.notes} onChange={(e) => upd(i, { notes: e.target.value })} /></Field>
              </section>))}</div>
          )}
          <div className="mt-6 flex gap-2"><button className="btnPrimary" onClick={build} disabled={!themes.length}>Draft structured review</button>{draft && <button className="btn" onClick={() => navigator.clipboard?.writeText(draft)}>Copy Markdown</button>}{draft && <button className="btn" onClick={() => window.print()}>Print</button>}</div>
          {draft && <div className="card printArea mt-4 p-5"><Markdown source={draft} /></div>}
        </Async>
      )}
    </>
  );
}
