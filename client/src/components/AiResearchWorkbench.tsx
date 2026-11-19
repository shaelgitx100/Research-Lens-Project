import { useState } from 'react';
import { Sparkles } from 'lucide-react';

type Feature = 'paper-summary' | 'methodology' | 'literature-review' | 'research-gap' | 'research-questions' | 'hypothesis' | 'research-proposal' | 'citation-analysis' | 'pdf-analysis' | 'research-assistant';
type Result = { title: string; summary: string; sections: { heading: string; content: string }[]; recommendations: string[]; evidence: { claim: string; quote: string; sourceLocation: string }[]; confidence: string; limitations: string[] };
const features: { id: Feature; label: string }[] = [
  { id: 'paper-summary', label: 'Paper summary' }, { id: 'methodology', label: 'Methodology analysis' },
  { id: 'literature-review', label: 'Literature review' }, { id: 'research-gap', label: 'Research gaps' },
  { id: 'research-questions', label: 'Research questions' }, { id: 'hypothesis', label: 'Hypothesis development' },
  { id: 'research-proposal', label: 'Research proposal' }, { id: 'citation-analysis', label: 'Citation analysis' },
  { id: 'pdf-analysis', label: 'PDF analysis' }, { id: 'research-assistant', label: 'Research assistant' },
];

export default function AiResearchWorkbench({ paperId, projectId, initialFeature = 'paper-summary', headers }: { paperId?: string; projectId?: string; initialFeature?: Feature; headers: Record<string, string> }) {
  const [feature, setFeature] = useState<Feature>(initialFeature);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const run = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch(`/api/ai/features/${feature}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(paperId ? { paperId } : {}), ...(projectId ? { projectId } : {}), ...(prompt.trim() ? { topic: prompt.trim(), question: prompt.trim() } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status}).`);
      setResult(data.result.result as Result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI request failed.'); }
    finally { setBusy(false); }
  };
  return <section className="panel ai-workbench">
    <div className="section-kicker">GEMINI RESEARCH TOOLS</div><h2>Research workbench</h2>
    <p>Run focused research tasks on this saved paper or provide a topic. Outputs are saved to your account and require researcher review.</p>
    <div className="workbench-controls"><label>Research feature<select value={feature} onChange={(event) => setFeature(event.target.value as Feature)}>{features.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Topic, question, or extra context<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={3} placeholder="Add a research topic or a specific question. For a saved paper, this is optional." /></label>
      <button className="button primary" onClick={() => void run()} disabled={busy || (!paperId && !projectId && !prompt.trim())}>{busy ? 'Working with Gemini…' : 'Run live analysis'} <Sparkles size={15}/></button></div>
    <div className="notice">Submitting sends the selected paper text and your prompt to Google Gemini. Exact source quotes are checked before display.</div>
    {error && <div className="alert" role="alert">{error}</div>}
    {result && <div className="ai-feature-result" aria-live="polite"><div className="ai-feature-title"><h3>{result.title}</h3><span>{result.confidence} confidence</span></div><p>{result.summary}</p>
      {result.sections.map((section, index) => <section key={`${section.heading}-${index}`}><h4>{section.heading}</h4><p>{section.content}</p></section>)}
      {result.recommendations.length > 0 && <section><h4>Recommendations</h4><ul>{result.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      {result.evidence.length > 0 && <section><h4>Verified source evidence</h4>{result.evidence.map((item, index) => <blockquote key={index}><strong>{item.claim}</strong><br/>“{item.quote}”<small>{item.sourceLocation}</small></blockquote>)}</section>}
      {result.limitations.length > 0 && <section><h4>Limitations</h4><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
    </div>}
  </section>;
}
