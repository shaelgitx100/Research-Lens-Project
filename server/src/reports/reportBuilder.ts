import { matchFamilies } from '../analysis/taxonomy';
import { SCORE_DIMENSIONS, SCORECARD_FORMULA, composite, Dimension } from '../discovery/scorecard';

export interface RPaper {
  id: string; title: string; authors: string[]; year?: number; venue?: string; DOI?: string; publicationUrl?: string; isDemo?: boolean; abstract?: string;
  analysis?: { findings: { text: string }[]; limitations: { text: string }[]; methodology: { text: string }[] };
}
export interface RGap { title: string; category: string; description: string; classification: string; label: string; supportCount: number; supportingPaperIds: string[]; evidence: { paperId: string; excerpt: string }[]; scorecard?: Dimension[] }
export interface RQuestion { question: string; status: string; feasibility: string }

export function formatCitation(p: RPaper): string {
  const a = p.authors.length ? (p.authors.length > 6 ? `${p.authors.slice(0, 6).join(', ')}, et al.` : p.authors.join(', ')) : 'Author not stored';
  const parts = [`${a} (${p.year ?? 'year not stored'}). ${p.title}.`];
  if (p.venue) parts.push(`${p.venue}.`);
  if (p.DOI) parts.push(`https://doi.org/${p.DOI}`);
  else if (p.publicationUrl && /^https?:\/\//.test(p.publicationUrl)) parts.push(p.publicationUrl);
  if (p.isDemo) parts.push('[DEMO record, not a real publication]');
  return parts.join(' ');
}

export function buildReport(input: { title: string; project: { topic: string; description: string; objectives: string[]; keywords: string[]; domain: string }; papers: RPaper[]; gaps: RGap[]; questions: RQuestion[] }) {
  const { project, gaps, questions } = input;
  const papers = [...input.papers].sort((a, b) => (a.authors[0] || a.title).localeCompare(b.authors[0] || b.title));
  const ref = new Map(papers.map((p, i) => [p.id, i + 1]));
  const cite = (ids: string[]) => ids.map((id) => ref.get(id)).filter(Boolean).sort((a, b) => a! - b!).map((n) => `[${n}]`).join(' ');
  const years = papers.map((p) => p.year).filter(Boolean) as number[];
  const lines: string[] = [];
  const demo = papers.some((p) => p.isDemo);

  lines.push(`# ${input.title}`, '');
  if (demo) lines.push('> This report was generated from DEMO records. The papers are fictional examples and must not be cited as real publications.', '');
  lines.push('> Labels: Source derived finding (extracted from a stored paper), AI generated interpretation (produced by ResearchLens rules), Potential research gap (needs human review), Researcher verified gap (confirmed by you).', '');

  lines.push('## 1. Research topic', '', project.topic, '');
  if (project.objectives.length) lines.push('Objectives:', ...project.objectives.map((o) => `* ${o}`), '');
  if (project.keywords.length) lines.push(`Keywords: ${project.keywords.join(', ')}`, '');

  lines.push('## 2. Research background', '', project.description || 'Not provided by the researcher. Add background text when editing this report.', '');

  lines.push('## 3. Literature overview', '', `This report covers ${papers.length} papers${years.length ? ` published between ${Math.min(...years)} and ${Math.max(...years)}` : ''}. ${papers.filter((p) => p.analysis).length} have a stored analysis.`, '');

  lines.push('## 4. Reviewed publications', '', ...papers.map((p, i) => `${i + 1}. ${p.title}${p.year ? ` (${p.year})` : ''}${p.isDemo ? ' [DEMO]' : ''}`), '');

  const fam = new Map<string, number[]>();
  papers.forEach((p, i) => matchFamilies((p.analysis?.methodology || []).map((e) => e.text).join(' ')).forEach((m) => fam.set(m.family.label, [...(fam.get(m.family.label) || []), i + 1])));
  lines.push('## 5. Methodology comparison', '', 'AI generated interpretation of methodology text:', '');
  if (fam.size) lines.push('| Approach | Papers | Count |', ...[...fam.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `| ${k} | ${v.map((n) => `[${n}]`).join(' ')} | ${v.length} |`));
  else lines.push('No recognizable methodology families were found in the analyzed text.');
  lines.push('');

  lines.push('## 6. Major findings', '', 'Source derived findings:', '');
  papers.forEach((p) => { const f = p.analysis?.findings[0]; if (f) lines.push(`* ${f.text} ${cite([p.id])}`); });
  lines.push('');

  lines.push('## 7. Identified limitations', '', 'Source derived limitations acknowledged by the authors:', '');
  papers.forEach((p) => p.analysis?.limitations.slice(0, 2).forEach((l) => lines.push(`* ${l.text} ${cite([p.id])}`)));
  lines.push('');

  lines.push('## 8. Potential research gaps', '', 'Every gap below is a Potential research gap unless marked Researcher verified. Coverage is relative to the collected papers only.', '');
  gaps.forEach((g, i) => lines.push(`${i + 1}. **${g.title}** (${g.classification === 'researcherVerified' ? 'Researcher verified gap' : 'Potential research gap'}; ${g.label}; ${g.supportCount} supporting papers ${cite(g.supportingPaperIds)})`, `   ${g.description}`));
  if (!gaps.length) lines.push('No gaps have been generated yet.');
  lines.push('');

  lines.push('## 9. Supporting evidence', '');
  gaps.forEach((g) => { lines.push(`### ${g.title}`, ''); g.evidence.slice(0, 4).forEach((e) => lines.push(`> ${e.excerpt} ${cite([e.paperId])}`, '')); });

  lines.push('## 10. Suggested research questions', '', 'Generated proposals that require human academic review.', '');
  questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question} (${q.status}; feasibility ${q.feasibility})`));
  if (!questions.length) lines.push('No research questions have been generated yet.');
  lines.push('');

  lines.push('## 11. Research opportunities', '', SCORECARD_FORMULA, '');
  const scored = gaps.filter((g) => g.scorecard?.length).map((g) => ({ g, c: composite(g.scorecard!) })).sort((a, b) => b.c - a.c);
  if (scored.length) {
    lines.push(`| Gap | ${SCORE_DIMENSIONS.map((d) => d.label).join(' | ')} | Composite |`);
    scored.forEach(({ g, c }) => lines.push(`| ${g.title} | ${SCORE_DIMENSIONS.map((d) => g.scorecard!.find((x) => x.key === d.key)?.score ?? '').join(' | ')} | ${c} |`));
  } else lines.push('No scored opportunities available.');
  lines.push('');

  lines.push('## 12. References', '', ...papers.map((p, i) => `${i + 1}. ${formatCitation(p)}`), '');

  return {
    reportContent: lines.join('\n'),
    references: papers.map((p) => ({ paperId: p.id, citation: formatCitation(p), isDemo: !!p.isDemo })),
  };
}
