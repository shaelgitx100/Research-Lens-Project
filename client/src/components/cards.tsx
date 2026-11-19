import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Gap, Paper, PaperRecord, Project } from '../types';
import { CATEGORY_LABEL, fmtDate, STATUS_LABEL } from '../utils/format';
import { Badge, DemoBadge, EvidenceBadge, ProgressBar } from './ui';

export const ResearchMetricCard = ({ label, value, demo, hint }: { label: string; value: number | string; demo?: boolean; hint?: string }) => (
  <div className="card p-4"><div className="flex items-start justify-between"><div className="font-serif text-3xl">{value}</div>{demo && <DemoBadge />}</div><div className="mt-1 text-sm text-muted">{label}</div>{hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}</div>
);

export function ResearchProjectCard({ project, active, onSelect }: { project: Project; active?: boolean; onSelect?: () => void }) {
  return (
    <div className={`card p-4 transition ${active ? 'border-accent' : 'hover:border-accent/50'}`}>
      <div className="flex items-start justify-between gap-2"><Link to={`/app/workspace/${project.id}`} className="font-serif text-lg leading-snug hover:text-accent">{project.title}</Link><DemoBadge show={project.isDemo} /></div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{project.topic}</p>
      <div className="mt-3 flex flex-wrap gap-1">{project.keywords.slice(0, 5).map((k) => <Badge key={k}>{k}</Badge>)}</div>
      <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-muted"><span>{project.stats.analyzed} of {project.stats.papers} papers analyzed</span><span>{project.stats.progress}%</span></div><ProgressBar value={project.stats.progress} /></div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{STATUS_LABEL[project.status]} {'\u00b7'} {project.domain || 'No domain'} {'\u00b7'} {fmtDate(project.createdAt)}</span>{onSelect && <button className={`text-accent ${active ? 'opacity-60' : ''}`} onClick={onSelect} disabled={active}>{active ? 'Active' : 'Make active'}</button>}</div>
    </div>
  );
}

export function PaperCard({ paper, actions, selected, onToggle }: { paper: PaperRecord | Paper; actions?: ReactNode; selected?: boolean; onToggle?: () => void }) {
  const p = paper as Paper;
  return (
    <article className={`card p-4 ${selected ? 'border-accent' : ''}`}>
      <div className="flex items-start gap-3">
        {onToggle && <input type="checkbox" className="mt-1.5" checked={!!selected} onChange={onToggle} aria-label={`Select ${paper.title}`} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-serif text-base leading-snug">{p.id ? <Link to={`/app/library/${p.id}`} className="hover:text-accent">{paper.title}</Link> : paper.title}</h3>
            <div className="flex flex-wrap gap-1"><DemoBadge show={p.isDemo} />{paper.inLibrary && <Badge tone="border-good/50 text-good">In library</Badge>}{paper.openAccess && <Badge tone="border-accent/40 text-accent">Open access</Badge>}{(paper as PaperRecord).isPreprint || p.isPreprint || p.paperType === 'preprint' ? <Badge tone="border-amber/50 text-amber">Preprint</Badge> : null}</div>
          </div>
          <p className="mt-1 text-xs text-muted">{paper.authors.length ? paper.authors.slice(0, 5).join(', ') + (paper.authors.length > 5 ? ', et al.' : '') : 'Authors not available'}</p>
          {(paper as PaperRecord).institutions?.length ? <p className="text-xs text-muted">Institutions: {(paper as PaperRecord).institutions?.slice(0, 3).join(', ')}</p> : null}
          <p className="mt-0.5 text-xs text-muted">{[paper.publicationYear, paper.venue, paper.source && `Source: ${paper.source}`, paper.citationCount !== null && paper.citationCount !== undefined ? `${paper.citationCount} citations` : null, (paper as PaperRecord).referenceCount != null ? `${(paper as PaperRecord).referenceCount} references` : null].filter(Boolean).join(' \u00b7 ')}</p>
          {paper.DOI && <a className="link mt-1 inline-block text-xs" href={`https://doi.org/${paper.DOI}`} target="_blank" rel="noopener noreferrer">DOI {paper.DOI}</a>}
          {paper.publicationUrl && !paper.DOI && /^https?:\/\//.test(paper.publicationUrl) && <a className="link mt-1 inline-block text-xs" href={paper.publicationUrl} target="_blank" rel="noopener noreferrer">Paper link</a>}
          {paper.abstract ? <p className="mt-2 line-clamp-3 text-sm text-muted">{paper.abstract}</p> : <p className="mt-2 text-sm italic text-muted">No abstract available from the source.</p>}
          {paper.keywords.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{paper.keywords.slice(0, 6).map((k) => <Badge key={k}>{k}</Badge>)}</div>}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

export function PaperTable({ papers, onToggleRead }: { papers: Paper[]; onToggleRead?: (p: Paper) => void }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Title</th><th className="px-3 py-2">Year</th><th className="px-3 py-2">Venue</th><th className="px-3 py-2">Analysis</th><th className="px-3 py-2">Read</th></tr></thead>
        <tbody>
          {papers.map((p) => (
            <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-raised/40">
              <td className="px-3 py-2"><Link to={`/app/library/${p.id}`} className="hover:text-accent">{p.title}</Link> <DemoBadge show={p.isDemo} />{p.paperType === 'preprint' && <Badge tone="border-amber/50 text-amber">Preprint</Badge>}<div className="text-xs text-muted">{p.authors.slice(0, 3).join(', ')}</div></td>
              <td className="px-3 py-2 text-muted">{p.publicationYear || ''}</td><td className="max-w-[14rem] truncate px-3 py-2 text-muted">{p.venue}</td>
              <td className="px-3 py-2">{p.analyzed ? <Badge tone="border-good/50 text-good">Analyzed</Badge> : <Link to={`/app/analysis/${p.id}`} className="link text-xs">Analyze</Link>}</td>
              <td className="px-3 py-2"><input type="checkbox" checked={p.read} onChange={() => onToggleRead?.(p)} aria-label={`Mark ${p.title} as read`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResearchGapCard({ gap }: { gap: Gap }) {
  return (
    <article className="card p-4 transition hover:border-accent/50">
      <div className="flex flex-wrap items-center gap-1.5"><Badge>{CATEGORY_LABEL[gap.category]}</Badge><EvidenceBadge label={gap.evidenceStrength.label} />{gap.classification === 'researcherVerified' ? <Badge tone="border-good/50 text-good">Researcher verified gap</Badge> : <Badge tone="border-amber/50 text-amber">Potential research gap</Badge>}<DemoBadge show={gap.isDemo} /></div>
      <h3 className="mt-2 font-serif text-lg leading-snug"><Link to={`/app/gaps/${gap.id}`} className="hover:text-accent">{gap.title}</Link></h3>
      <p className="mt-1 text-sm text-muted">{gap.description}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>Coverage: {gap.evidenceStrength.supportCount} of {gap.evidenceStrength.totalAnalyzed} analyzed papers</span><span>Composite {gap.composite} of 100</span></div>
    </article>
  );
}
