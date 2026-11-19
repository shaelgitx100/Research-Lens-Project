export interface PaperAnalysisResultData {
  summary: string;
  researchArea: string;
  objective: string;
  methodology: string;
  datasets: string;
  findings: string;
  limitations: string;
  contributions: string;
  futureWork: string;
  candidateGaps: string[];
  researchQuestions: string[];
  evidence: Array<{ claim: string; quote: string; sourceLocation: string; confidence: 'low' | 'medium' | 'high' }>;
  overallConfidence: 'low' | 'medium' | 'high';
  evidenceLimits: string[];
}

const sections: Array<[string, keyof PaperAnalysisResultData]> = [
  ['Research area', 'researchArea'], ['Objective', 'objective'], ['Methodology', 'methodology'],
  ['Datasets', 'datasets'], ['Findings', 'findings'], ['Limitations', 'limitations'],
  ['Contributions', 'contributions'], ['Future work', 'futureWork'],
];

export default function PaperAnalysisResult({ analysis }: { analysis: PaperAnalysisResultData }) {
  return <div className="deep-analysis">
    <div className="deep-analysis-head"><div><div className="section-kicker">GEMINI ANALYSIS · VERIFY AGAINST THE SOURCE</div><h2>Research intelligence brief</h2></div><span className="confidence-pill">Confidence: {analysis.overallConfidence}</span></div>
    <section className="deep-section"><h3>Summary</h3><p>{analysis.summary}</p></section>
    <section className="deep-section"><h3>Paper details</h3><div className="deep-field-grid">{sections.map(([label, key])=><article key={key}><strong>{label}</strong><p>{analysis[key] as string}</p></article>)}</div></section>
    <section className="deep-section"><h3>Candidate research directions</h3><div className="deep-columns"><div><strong>Potential gaps</strong><ul className="deep-bullets">{analysis.candidateGaps.map((item,index)=><li key={index}>{item}</li>)}</ul></div><div><strong>Research questions</strong><ul className="deep-bullets">{analysis.researchQuestions.map((item,index)=><li key={index}>{item}</li>)}</ul></div></div></section>
    <section className="deep-section"><h3>Source evidence</h3>{analysis.evidence.length ? analysis.evidence.map((item,index)=><article className="deep-evidence" key={index}><strong>{item.claim}</strong><blockquote>“{item.quote}”</blockquote><small>{item.sourceLocation} · {item.confidence} confidence</small></article>) : <p>No direct quotations were returned; verify every statement against the paper.</p>}</section>
    <section className="deep-section"><h3>Evidence limits</h3><ul className="deep-bullets">{analysis.evidenceLimits.map((item,index)=><li key={index}>{item}</li>)}</ul><small className="deep-caveat">AI generated. Candidate gaps are not proof of novelty; independently verify sources and claims.</small></section>
  </div>;
}
