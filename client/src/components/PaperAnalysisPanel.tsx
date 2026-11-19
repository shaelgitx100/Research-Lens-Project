import { useState } from 'react';
import { api } from '../services/api';
import { Analysis, ANALYSIS_FIELDS, AnalysisField, Evidence } from '../types';
import { FIELD_LABEL, NOT_STATED } from '../utils/format';
import { Badge } from './ui';

export function PaperAnalysisPanel({ paperId, analysis, onSaved }: { paperId: string; analysis: Analysis; onSaved: (a: Analysis) => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, Evidence[]>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const begin = () => { setDraft(Object.fromEntries(ANALYSIS_FIELDS.map((f) => [f, analysis[f].map((e) => ({ ...e }))]))); setEdit(true); setErr(''); };
  const save = async () => {
    setBusy(true); setErr('');
    const body = Object.fromEntries(ANALYSIS_FIELDS.map((f) => [f, draft[f].filter((e) => e.text.trim()).map((e) => ({ text: e.text.trim(), section: e.section, page: e.page }))]));
    try { const r = await api.put<{ analysis: Analysis }>(`/papers/${paperId}/analysis`, body); onSaved(r.analysis); setEdit(false); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const upd = (f: AnalysisField, i: number, text: string) => setDraft((d) => ({ ...d, [f]: d[f].map((e, j) => (j === i ? { ...e, text } : e)) }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">Text basis: <Badge>{analysis.textBasis === 'fullText' ? 'Full text' : 'Abstract only'}</Badge>{analysis.textBasis !== 'fullText' && <span className="text-xs">Limitations and future work are often missing from abstracts.</span>}</div>
        {edit ? <div className="flex gap-2"><button className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btnPrimary" onClick={save} disabled={busy}>Save analysis</button></div> : <button className="btn" onClick={begin}>Edit extracted information</button>}
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {ANALYSIS_FIELDS.map((f) => {
          const items = edit ? draft[f] : analysis[f];
          return (
            <section key={f} className="card p-4">
              <h3 className="mb-2 font-serif text-lg">{FIELD_LABEL[f]}</h3>
              {items.length === 0 && !edit && <p className="text-sm italic text-muted">{NOT_STATED}</p>}
              <ul className="space-y-2">
                {items.map((e, i) => (
                  <li key={i} className="rounded-md border border-line bg-bg p-2.5 text-sm">
                    {edit ? <div className="flex gap-2"><textarea className="input min-h-[60px]" value={e.text} onChange={(x) => upd(f, i, x.target.value)} aria-label={`${FIELD_LABEL[f]} item ${i + 1}`} /><button className="btnGhost" onClick={() => setDraft((d) => ({ ...d, [f]: d[f].filter((_, j) => j !== i) }))} aria-label="Remove item">Remove</button></div> : e.text}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted"><span>Source: {[e.section, e.page && `page ${e.page}`].filter(Boolean).join(', ') || 'stored text'}</span>{e.origin === 'userEdited' && <Badge tone="border-accent/50 text-accent">User edited</Badge>}</div>
                  </li>
                ))}
              </ul>
              {edit && <button className="btn mt-2" onClick={() => setDraft((d) => ({ ...d, [f]: [...d[f], { text: '', origin: 'userEdited' as const }] }))}>Add item</button>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
