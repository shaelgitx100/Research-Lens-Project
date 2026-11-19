import { LIMITATION_THEMES, matchFamilies, GROUPS } from '../analysis/taxonomy';
import { discoverGaps } from '../discovery/gapEngine';
import { GapPaper } from '../discovery/types';
import { truncate } from '../Utils/text';

const cell = (evs: { text: string }[] = []) => (evs.length ? evs.map((e) => truncate(e.text, 260)) : null);

export function comparePapers(papers: GapPaper[]) {
  const rows = (
    [
      ['Objective', 'researchObjective'], ['Methodology', 'methodology'], ['Dataset', 'datasets'], ['Findings', 'findings'],
      ['Limitations', 'limitations'], ['Future work', 'futureWork'],
    ] as const
  ).map(([label, field]) => ({ dimension: label, cells: papers.map((p) => cell((p.analysis as any)?.[field])) }));

  const modelRow = {
    dimension: 'Model',
    cells: papers.map((p) => {
      const m = matchFamilies((p.analysis?.methodology || []).map((e) => e.text).join(' '), GROUPS.filter((g) => g.kind === 'model'));
      return m.length ? m.map((x) => x.family.label) : null;
    }),
  };
  rows.splice(3, 0, modelRow as any);

  const fam = papers.map((p) => new Set(matchFamilies((p.analysis?.methodology || []).map((e) => e.text).join(' ')).map((m) => m.family.label)));
  const all = new Set(fam.flatMap((s) => [...s]));
  const similarMethods = [...all].filter((f) => fam.filter((s) => s.has(f)).length >= 2);
  const differentApproaches = [...all].filter((f) => fam.filter((s) => s.has(f)).length === 1).map((f) => ({ approach: f, paper: papers[fam.findIndex((s) => s.has(f))].title }));

  const sharedLimitations = LIMITATION_THEMES.map((t) => ({
    theme: t.label,
    papers: papers.filter((p) => (p.analysis?.limitations || []).some((e) => t.re.test(e.text))).map((p) => p.title),
  })).filter((x) => x.papers.length >= 2);

  const contradictions = discoverGaps(papers).filter((g) => g.category === 'contradiction').map((g) => ({ concept: g.meta.focus, description: g.description, evidence: g.supportingEvidence.slice(0, 4) }));

  const method = GROUPS.find((g) => g.id === 'evaluationStrategy')!.families;
  const model = GROUPS.find((g) => g.id === 'modelClass')!.families;
  const usedPair = (a: string, b: string) => fam.some((s) => s.has(a) && s.has(b));
  const unexplored: string[] = [];
  for (const m of method) for (const d of model) {
    if (all.has(m.label) && all.has(d.label) && !usedPair(m.label, d.label)) unexplored.push(`${m.label} with ${d.label}`);
  }

  return {
    papers: papers.map((p) => ({ id: p.id, title: p.title, year: p.year })),
    rows,
    highlights: { similarMethods, differentApproaches, sharedLimitations, contradictions, unexploredCombinations: unexplored.slice(0, 6) },
    note: 'Highlights are produced by keyword rules over analyzed text and need human review.',
  };
}
