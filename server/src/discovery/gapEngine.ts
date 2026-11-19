import { GROUPS, LIMITATION_THEMES } from '../analysis/taxonomy';
import { bigrams, escapeRegex, stem, truncate, uniq } from '../Utils/text';
import { EvidenceLabel, Ev, GapCategory, GapDraft, GapEvidence, GapPaper } from './types';

const POS = /\b(improv\w*|outperform\w*|reliable|robust|consistent|effective|accurate|faithful)\b/i;
const NEG = /\b(fail\w*|degrad\w*|unreliable|inconsistent|sensitive|unstable|vulnerable|poor|worse|disagree\w*)\b|not robust|does not/i;

export function levelFor(support: number, total: number, category: GapCategory): EvidenceLabel {
  const cov = total ? support / total : 0;
  if (support >= 3 || (support >= 2 && cov >= 0.3 && category !== 'futureWork')) return 'Evidence supported gap';
  if (support === 2) return category === 'futureWork' ? 'Emerging research direction' : 'Potential research opportunity';
  return 'Insufficient evidence';
}

const joined = (evs: Ev[] = []) => evs.map((e) => e.text).join(' ');

function evOf(paper: GapPaper, evs: Ev[], kind: GapEvidence['kind'], max = 2): GapEvidence[] {
  return evs.slice(0, max).map((e) => ({ paperId: paper.id, excerpt: e.text, section: e.section, page: e.page, kind }));
}

function build(args: {
  papers: GapPaper[]; N: number; category: GapCategory; key: string; title: string; description: string;
  evidence: GapEvidence[]; supportIds: string[]; matcher: RegExp; meta?: Record<string, string>;
  related?: string[]; authorLimitations?: string[]; future?: string[]; directions: string[]; why: string;
}): GapDraft {
  const ids = uniq(args.supportIds);
  const titles = ids.map((id) => args.papers.find((p) => p.id === id)?.title).filter(Boolean).slice(0, 5).join('; ');
  const support = ids.length;
  return {
    title: args.title,
    description: args.description,
    category: args.category,
    supportingPaperIds: ids,
    supportingEvidence: args.evidence,
    reasoning: `${args.why} Supporting papers include: ${titles}. This is based only on the ${args.N} analyzed papers in this collection and does not show that the topic is unexplored in the wider literature. Treat it as a potential research gap that requires human academic review.`,
    evidenceStrength: { label: levelFor(support, args.N, args.category), supportCount: support, totalAnalyzed: args.N, coverage: Math.round((support / Math.max(1, args.N)) * 100) / 100 },
    relatedMethodologies: args.related || [],
    authorLimitations: (args.authorLimitations || []).slice(0, 5),
    futureRecommendations: (args.future || []).slice(0, 5),
    suggestedDirections: args.directions,
    meta: args.meta || {},
    signature: `${args.category}:${args.key}`,
    matcher: args.matcher,
  };
}

export function discoverGaps(papers: GapPaper[]): GapDraft[] {
  const analyzed = papers.filter((p) => p.analysis);
  const N = analyzed.length;
  if (N < 2) return [];
  const drafts: GapDraft[] = [];

  // A, C, D. Limitation based gaps (also covers dataset and model categories)
  for (const theme of LIMITATION_THEMES) {
    const hits = analyzed.map((p) => ({ p, evs: p.analysis!.limitations.filter((e) => theme.re.test(e.text)) })).filter((h) => h.evs.length);
    if (hits.length < 2) continue;
    const category: GapCategory = theme.kind === 'dataset' ? 'dataset' : theme.kind === 'model' ? 'model' : 'limitation';
    const future = hits.flatMap((h) => h.p.analysis!.futureWork.filter((e) => theme.re.test(e.text)).map((e) => e.text));
    const label = theme.label.toLowerCase();
    drafts.push(
      build({
        papers, N, category, key: theme.id,
        title: `Recurring ${category === 'limitation' ? 'limitation' : category + ' limitation'}: ${theme.label}`,
        description: `${hits.length} of ${N} analyzed papers acknowledge ${label}.`,
        evidence: hits.flatMap((h) => evOf(h.p, h.evs, 'limitation', 1)),
        supportIds: hits.map((h) => h.p.id), matcher: theme.re, meta: { focus: label },
        authorLimitations: hits.flatMap((h) => h.evs.map((e) => e.text)), future,
        directions: [`Design a controlled study that isolates ${label}.`, `Replicate representative studies from this collection while varying ${label}.`],
        why: `Several independent studies report ${label} as a limitation, which suggests the issue is not yet resolved in this collection.`,
      })
    );
  }

  // B. Methodology and model based gaps
  for (const group of GROUPS.filter((g) => g.id !== 'studyDesign')) {
    const counts = group.families.map((f) => ({ f, papers: analyzed.filter((p) => f.re.test(joined(p.analysis!.methodology))) }));
    const m = uniq(counts.flatMap((c) => c.papers.map((p) => p.id))).length;
    if (m < 3) continue;
    const dominant = [...counts].sort((a, b) => b.papers.length - a.papers.length)[0];
    if (dominant.papers.length / m < 0.6) continue;
    for (const c of counts) {
      if (c === dominant || c.papers.length > 1) continue;
      const interest = analyzed.filter((p) => !c.papers.includes(p) && c.f.re.test(joined([...p.analysis!.futureWork, ...p.analysis!.limitations])));
      if (c.papers.length === 0 && interest.length === 0) continue;
      const category: GapCategory = group.kind === 'model' ? 'model' : 'methodology';
      const evidence = [
        ...dominant.papers.slice(0, 3).flatMap((p) => evOf(p, p.analysis!.methodology.filter((e) => dominant.f.re.test(e.text)), 'methodology', 1)),
        ...c.papers.flatMap((p) => evOf(p, p.analysis!.methodology.filter((e) => c.f.re.test(e.text)), 'methodology', 1)),
        ...interest.flatMap((p) => evOf(p, [...p.analysis!.futureWork, ...p.analysis!.limitations].filter((e) => c.f.re.test(e.text)), 'futureWork', 1)),
      ];
      drafts.push(
        build({
          papers, N, category, key: `${group.id}:${c.f.id}`,
          title: `${c.f.label} receives less attention than ${dominant.f.label}`,
          description: `${dominant.papers.length} of ${m} papers reporting ${group.label.toLowerCase()} use ${dominant.f.label.toLowerCase()}, while ${c.papers.length} use ${c.f.label.toLowerCase()}.`,
          evidence, supportIds: [...dominant.papers, ...c.papers, ...interest].map((p) => p.id), matcher: c.f.re,
          meta: { dominant: dominant.f.label, minority: c.f.label, group: group.label, focus: c.f.label.toLowerCase() },
          related: [dominant.f.label, c.f.label],
          future: interest.flatMap((p) => p.analysis!.futureWork.filter((e) => c.f.re.test(e.text)).map((e) => e.text)),
          directions: [`Compare ${c.f.label.toLowerCase()} with ${dominant.f.label.toLowerCase()} on identical models and datasets.`, 'Report how closely the two approaches agree on rankings and conclusions.'],
          why: `Within this collection ${dominant.f.label.toLowerCase()} dominates ${group.label.toLowerCase()}, while ${c.f.label.toLowerCase()} is used by few papers${interest.length ? ' even though other authors call for it' : ''}.`,
        })
      );
    }
  }

  // E. Contradiction based gaps
  const concepts = new Map<string, Set<string>>();
  for (const p of analyzed) for (const k of p.keywords) {
    const key = k.toLowerCase().trim();
    if (key.length < 4) continue;
    if (!concepts.has(key)) concepts.set(key, new Set());
    concepts.get(key)!.add(p.id);
  }
  const contradictions: GapDraft[] = [];
  for (const [concept, ids] of concepts) {
    if (ids.size < 2) continue;
    const re = new RegExp(escapeRegex(concept), 'i');
    const pos: { p: GapPaper; e: Ev }[] = [], neg: { p: GapPaper; e: Ev }[] = [];
    for (const p of analyzed) for (const e of p.analysis!.findings) {
      if (!re.test(e.text)) continue;
      const isPos = POS.test(e.text), isNeg = NEG.test(e.text);
      if (isPos && !isNeg) pos.push({ p, e });
      else if (isNeg && !isPos) neg.push({ p, e });
    }
    const posIds = uniq(pos.map((x) => x.p.id)), negIds = uniq(neg.map((x) => x.p.id));
    if (!posIds.length || !negIds.length || posIds.every((id) => negIds.includes(id) && posIds.length === 1 && negIds.length === 1)) continue;
    contradictions.push(
      build({
        papers, N, category: 'contradiction', key: concept, title: `Conflicting findings on ${concept}`,
        description: `Some analyzed papers report favorable findings about ${concept} while others report unfavorable or inconsistent findings.`,
        evidence: [...pos.slice(0, 2), ...neg.slice(0, 2)].map(({ p, e }) => ({ paperId: p.id, excerpt: e.text, section: e.section, page: e.page, kind: 'finding' as const })),
        supportIds: [...posIds, ...negIds], matcher: re, meta: { focus: concept },
        directions: ['Run a controlled replication across the conditions used in the conflicting papers.', 'Document which experimental factors explain the divergence.'],
        why: `Papers that mention ${concept} describe findings in opposite directions. Differences in models, datasets or evaluation conditions may explain this, which has not been verified.`,
      })
    );
  }
  drafts.push(...contradictions.sort((a, b) => b.supportingPaperIds.length - a.supportingPaperIds.length).slice(0, 4));

  // F. Future work aggregation
  const byPhrase = new Map<string, { id: string; e: Ev }[]>();
  for (const p of analyzed) {
    const seen = new Set<string>();
    for (const e of p.analysis!.futureWork) for (const b of uniq(bigrams(e.text))) {
      if (seen.has(b)) continue;
      seen.add(b);
      if (!byPhrase.has(b)) byPhrase.set(b, []);
      byPhrase.get(b)!.push({ id: p.id, e });
    }
  }
  const ranked = [...byPhrase.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
  const usedSets: string[] = [];
  for (const [phrase, hits] of ranked) {
    const setKey = hits.map((h) => h.id).sort().join(',');
    if (usedSets.includes(setKey)) continue;
    usedSets.push(setKey);
    const words = phrase.split(' ');
    const re = new RegExp(words.map((w) => escapeRegex(w) + '\\w*').join('\\s+'), 'i');
    drafts.push(
      build({
        papers, N, category: 'futureWork', key: phrase, title: `Author recommended direction: ${phrase}`,
        description: `${hits.length} analyzed papers explicitly recommend future work involving ${phrase}.`,
        evidence: hits.slice(0, 4).map(({ id, e }) => ({ paperId: id, excerpt: e.text, section: e.section, page: e.page, kind: 'futureWork' as const })),
        supportIds: hits.map((h) => h.id), matcher: re, meta: { focus: phrase },
        future: hits.map((h) => h.e.text),
        directions: [`Pursue the direction the authors recommend: ${phrase}.`, 'Scope a pilot study using datasets named in the supporting papers.'],
        why: `Authors of different papers independently list ${phrase} as future work.`,
      })
    );
    if (drafts.filter((d) => d.category === 'futureWork').length >= 5) break;
  }

  const seenSig = new Set<string>();
  return drafts
    .filter((d) => (seenSig.has(d.signature) ? false : (seenSig.add(d.signature), true)))
    .sort((a, b) => b.evidenceStrength.supportCount - a.evidenceStrength.supportCount);
}

export { truncate, stem };
