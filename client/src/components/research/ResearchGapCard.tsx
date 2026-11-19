import { ArrowRight, Lightbulb } from 'lucide-react';

export interface ResearchGap { _id: string; title: string; description: string; category?: string; strength?: string }
export default function ResearchGapCard({ gap, onOpen }: { gap: ResearchGap; onOpen?: (gap: ResearchGap) => void }) {
  return <article className="panel gap-card"><div className="metric-icon highlight"><Lightbulb size={17}/></div><div className="section-kicker">{gap.category || 'RESEARCH OPPORTUNITY'}</div><h3>{gap.title}</h3><p>{gap.description}</p><div className="gap-card-footer"><span className="status-pill">{gap.strength || 'Needs review'}</span>{onOpen&&<button type="button" className="button secondary" onClick={()=>onOpen(gap)}>Review <ArrowRight size={14}/></button>}</div></article>;
}
