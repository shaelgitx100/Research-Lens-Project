import { GROUPS, matchFamilies } from '../analysis/taxonomy';
import { bigrams, uniq } from '../Utils/text';

export interface TPaper { id: string; year?: number; keywords: string[]; domain?: string; venue?: string; methodology?: string }

export function computeTrends(papers: TPaper[]) {
  const dated = papers.filter((p) => p.year);
  const perYear = new Map<number, number>();
  dated.forEach((p) => perYear.set(p.year!, (perYear.get(p.year!) || 0) + 1));
  const years = [...perYear.keys()].sort((a, b) => a - b);
  const publicationsPerYear = years.map((y) => ({ year: y, count: perYear.get(y)! }));

  const kwYear = new Map<string, Map<number, number>>();
  const kwTotal = new Map<string, number>();
  for (const p of dated) for (const k of uniq(p.keywords.map((x) => x.toLowerCase().trim()).filter(Boolean))) {
    kwTotal.set(k, (kwTotal.get(k) || 0) + 1);
    if (!kwYear.has(k)) kwYear.set(k, new Map());
    kwYear.get(k)!.set(p.year!, (kwYear.get(k)!.get(p.year!) || 0) + 1);
  }
  const keywords = [...kwTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([keyword, count]) => ({ keyword, count }));

  const methodCounts = new Map<string, { label: string; group: string; count: number }>();
  for (const p of papers) {
    if (!p.methodology) continue;
    for (const { group, family } of matchFamilies(p.methodology)) {
      const cur = methodCounts.get(family.id) || { label: family.label, group: group.label, count: 0 };
      cur.count++;
      methodCounts.set(family.id, cur);
    }
  }
  const methods = [...methodCounts.values()].sort((a, b) => b.count - a.count);
  const underrepresented = methods.filter((m) => m.count === 1).map((m) => m.label);

  const domains = new Map<string, number>();
  papers.forEach((p) => { const d = p.domain || 'Unspecified'; domains.set(d, (domains.get(d) || 0) + 1); });

  // Growth is only reported when the evidence supports it: at least 4 papers across at least 3 years,
  // with more papers in the later half of the keyword's observed span than in the earlier half.
  const growth: { keyword: string; earlier: number; later: number; years: number[]; total: number; direction: 'increasing' | 'decreasing' }[] = [];
  for (const [k, total] of kwTotal) {
    const map = kwYear.get(k)!;
    const ys = [...map.keys()].sort((a, b) => a - b);
    if (total < 4 || ys.length < 3) continue;
    const mid = ys[Math.floor(ys.length / 2)];
    let earlier = 0, later = 0;
    for (const [y, c] of map) (y < mid ? (earlier += c) : (later += c));
    if (later > earlier) growth.push({ keyword: k, earlier, later, years: ys, total, direction: 'increasing' });
    else if (earlier > later) growth.push({ keyword: k, earlier, later, years: ys, total, direction: 'decreasing' });
  }

  const phrases = new Map<string, number>();
  papers.forEach((p) => uniq(p.keywords.flatMap((k) => bigrams(k))).forEach((b) => phrases.set(b, (phrases.get(b) || 0) + 1)));

  return {
    totalPapers: papers.length,
    datedPapers: dated.length,
    publicationsPerYear,
    keywords,
    methods,
    underrepresented,
    domains: [...domains.entries()].map(([domain, count]) => ({ domain, count })),
    growth: growth.sort((a, b) => b.total - a.total).slice(0, 8),
    topicRelations: [...phrases.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([phrase, count]) => ({ phrase, count })),
    notes: [
      dated.length < 8 ? `Only ${dated.length} papers carry a publication year, so trend conclusions are weak.` : null,
      'Emerging or declining labels appear only for keywords with at least 4 papers across at least 3 years, and describe this collection, not the whole field.',
    ].filter(Boolean) as string[],
    groupsUsed: GROUPS.map((g) => g.label),
  };
}
