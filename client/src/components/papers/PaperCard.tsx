import { FileText } from 'lucide-react';
import type { Paper } from '../../types';

export default function PaperCard({ paper, onOpen }: { paper: Paper; onOpen?: (paper: Paper) => void }) {
  const content = <><span className="paper-icon"><FileText size={17}/></span><span className="paper-card-content"><strong>{paper.title}</strong><small>{paper.authors?.join(', ') || 'Author details unavailable'} · {paper.publicationYear ?? 'Year unknown'}{paper.venue ? ` · ${paper.venue}` : ''}</small>{paper.abstract&&<span className="paper-card-abstract">{paper.abstract}</span>}</span></>;
  return onOpen ? <button className="paper-card" type="button" onClick={() => onOpen(paper)}>{content}</button> : <article className="paper-card">{content}</article>;
}
