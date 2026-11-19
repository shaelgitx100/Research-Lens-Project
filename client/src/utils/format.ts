import type { AnalysisField } from '../types';

export function formatYear(value?: number | string | null): string { return value ? String(value) : 'Year unknown'; }
export function formatAuthors(authors?: string[]): string { return authors?.length ? authors.join(', ') : 'Author details unavailable'; }
export function truncate(text: string, maxLength = 240): string { return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`; }

export const CATEGORY_LABEL: Record<string, string> = {
  limitation: 'Limitations', methodology: 'Methodology', dataset: 'Dataset',
  model: 'Model', contradiction: 'Contradictory findings', futureWork: 'Future work',
};

export const STATUS_LABEL: Record<string, string> = {
  planning: 'Planning', collecting: 'Collecting papers', analyzing: 'Analyzing',
  reviewing: 'Reviewing', completed: 'Completed',
};

export const DEMO_STATS = {
  papers: 24, topics: 8, limitations: 18, gaps: 6, questions: 12, activeProjects: 3,
};

export const FIELD_LABEL: Record<AnalysisField, string> = {
  researchObjective: 'Research objective',
  methodology: 'Methodology',
  findings: 'Key findings',
  limitations: 'Limitations',
  futureWork: 'Future work',
};

export const NOT_STATED = 'Not explicitly stated in the source.';
export const EVIDENCE_TONE: Record<string, string> = {
  'Evidence supported gap': 'border-good/50 text-good',
  'Potential research opportunity': 'border-amber/50 text-amber',
  'Emerging research direction': 'border-accent/50 text-accent',
  'Insufficient evidence': 'border-line text-muted',
};

export const NODE_COLOR: Record<string, string> = {
  paper: 'rgb(var(--accent))', author: 'rgb(var(--good))', topic: 'rgb(var(--amber))',
  keyword: 'rgb(var(--accent))', methodology: 'rgb(var(--good))', dataset: 'rgb(var(--amber))',
  limitation: 'rgb(var(--bad))', gap: 'rgb(var(--amber))',
};

export function fmtDate(value?: string | Date | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
}

export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}
