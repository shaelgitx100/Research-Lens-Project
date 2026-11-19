import { describe, expect, it } from 'vitest';
import { analyzeText } from '../analysis/paperAnalyzer';
import { discoverGaps } from '../discovery/gapEngine';
import { composite } from '../discovery/scorecard';
import { buildGraph } from '../mapping/graphBuilder';
import { computeTrends } from '../Services/trendService';
import { buildCitationGraph } from '../Services/citationService';
import { DEMO_PAPERS } from '../demo/demoData';

const mapTextToSection = (t: string[], s: string) => t.map((text) => ({ text, section: s }));
const papers = DEMO_PAPERS.filter((d) => d.project === 0).map((d) => ({
  id: d.key, title: d.title, year: d.year, keywords: d.keywords,
  analysis: {
    methodology: mapTextToSection(d.methods, 'Methods'),
    datasets: mapTextToSection(d.datasets, 'Methods'),
    findings: mapTextToSection(d.findings, 'Results'),
    limitations: mapTextToSection(d.limitations, 'Limitations'),
    futureWork: mapTextToSection(d.future, 'Future Work'),
  },
}));

describe('paper analyzer', () => {
  const text = `Abstract\nThis study investigates fidelity of explanations. We find that results are consistent.\nMethods\nWe use perturbation of features on the DemoTab1 dataset.\nLimitations\nA limitation is that only linear models were evaluated.\nFuture Work\nFuture work should study non linear models.`;
  const r = analyzeText(text, 'fullText');
  it('extracts limitations and future work with sections', () => {
    expect(r.limitations[0].section).toBe('Limitations');
    expect(r.futureWork.length).toBeGreaterThan(0);
  });
  it('marks missing fields instead of inventing them', () => {
    expect(r.notExplicit).toContain('researchQuestions');
    expect(r.researchQuestions).toHaveLength(0);
  });
});

describe('gap engine', () => {
  const gaps = discoverGaps(papers);
  it('finds recurring limitation gaps with supporting papers', () => {
    expect(gaps.length).toBeGreaterThan(0);
    const ood = gaps.find((g) => /out of distribution/i.test(g.title));
    expect(ood).toBeTruthy();
    expect(ood!.supportingPaperIds.length).toBeGreaterThanOrEqual(3);
    expect(ood!.evidenceStrength.label).toBe('Evidence supported gap');
  });
  it('never returns gaps without evidence', () => {
    gaps.forEach((g) => {
      expect(g.supportingEvidence.length).toBeGreaterThan(0);
      expect(g.reasoning).toMatch(/human academic review/);
    });
  });
  it('requires at least two analyzed papers', () => { expect(discoverGaps(papers.slice(0, 1))).toEqual([]); });
});

describe('scorecard, graph, trends, citations', () => {
  it('computes a weighted composite', () => {
    expect(composite([{ key: 'a', score: 1 }, { key: 'b', score: 0 }])).toBe(50);
    expect(composite([{ key: 'a', score: 1 }, { key: 'b', score: 0 }], { a: 3, b: 1 })).toBe(75);
  });
  it('builds graph edges only between existing nodes', () => {
    const g = buildGraph({ keywords: ['Explainable AI'], topic: 'XAI' }, papers.map((p) => ({ ...p, authors: ['A'] })), []);
    const keys = new Set(g.nodes.map((n) => n.key));
    expect(g.edges.every((e) => keys.has(e.sourceKey) && keys.has(e.targetKey))).toBe(true);
  });
  it('does not label growth without enough evidence', () => {
    expect(computeTrends(papers.slice(0, 2).map((p) => ({ id: p.id, year: p.year, keywords: p.keywords }))).growth).toEqual([]);
  });
  it('links only papers present in the collection', () => {
    const c = buildCitationGraph(DEMO_PAPERS.filter((d) => d.project === 0).map((d) => ({ id: d.key, title: d.title, externalId: `demo:${d.key}`, referencedWorks: d.cites.map((x) => `demo:${x}`), keywords: [] })));
    expect(c.edges.length).toBeGreaterThan(5);
  });
});
