import { extractDatasetNames, LIMITATION_THEMES, matchFamilies } from '../analysis/taxonomy';
import { truncate } from '../Utils/text';

export interface GPaper { id: string; title: string; authors: string[]; keywords: string[]; abstract?: string; analysis?: { methodology: { text: string }[]; datasets: { text: string }[]; limitations: { text: string }[] } }
export interface GGap { id: string; title: string; category: string; description: string; supportingPaperIds: string[]; meta?: Record<string, string> }
export interface GNode { key: string; label: string; type: string; description: string; relatedEntityId?: string }
export interface GEdge { sourceKey: string; targetKey: string; relationshipType: string; evidencePaperIds: string[]; description: string }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function buildGraph(project: { keywords: string[]; topic: string }, papers: GPaper[], gaps: GGap[]): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const addNode = (n: GNode) => { if (!nodes.has(n.key)) nodes.set(n.key, n); };
  const addEdge = (e: GEdge) => { if (nodes.has(e.sourceKey) && nodes.has(e.targetKey)) edges.push(e); };

  const topics = project.keywords.map((k) => ({ key: `topic:${norm(k)}`, label: k, re: new RegExp(norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '[\\s-]?'), 'i') }));
  topics.forEach((t) => addNode({ key: t.key, label: t.label, type: 'topic', description: `Research topic keyword of this project (${project.topic}).` }));

  for (const p of papers) {
    const pk = `paper:${p.id}`;
    addNode({ key: pk, label: p.title, type: 'paper', description: truncate(p.abstract || 'No abstract stored.', 300), relatedEntityId: p.id });

    p.authors.slice(0, 4).forEach((a) => {
      const ak = `author:${norm(a)}`;
      addNode({ key: ak, label: a, type: 'author', description: 'Author listed in the stored paper metadata.' });
      addEdge({ sourceKey: ak, targetKey: pk, relationshipType: 'authored', evidencePaperIds: [p.id], description: `${a} is listed as an author.` });
    });

    const hay = `${p.title} ${p.keywords.join(' ')} ${p.abstract || ''}`;
    topics.forEach((t) => { if (t.re.test(hay)) addEdge({ sourceKey: t.key, targetKey: pk, relationshipType: 'investigates', evidencePaperIds: [p.id], description: `Paper metadata mentions ${t.label}.` }); });

    p.keywords.slice(0, 4).forEach((k) => {
      if (topics.some((t) => t.re.test(k))) return;
      const kk = `keyword:${norm(k)}`;
      addNode({ key: kk, label: k, type: 'keyword', description: 'Keyword from the stored paper metadata.' });
      addEdge({ sourceKey: pk, targetKey: kk, relationshipType: 'hasKeyword', evidencePaperIds: [p.id], description: `Listed as a keyword of the paper.` });
    });

    const a = p.analysis;
    if (!a) continue;
    const mText = a.methodology.map((e) => e.text).join(' ');
    for (const { family, group } of matchFamilies(mText)) {
      const mk = `methodology:${family.id}`;
      addNode({ key: mk, label: family.label, type: 'methodology', description: `${group.label} family detected in analyzed methodology text.` });
      addEdge({ sourceKey: pk, targetKey: mk, relationshipType: 'usesMethod', evidencePaperIds: [p.id], description: `Methodology text matches ${family.label}.` });
    }
    for (const d of extractDatasetNames(a.datasets.map((e) => e.text).join(' '))) {
      const dk = `dataset:${norm(d)}`;
      addNode({ key: dk, label: d, type: 'dataset', description: 'Dataset name found in the analyzed dataset text.' });
      addEdge({ sourceKey: pk, targetKey: dk, relationshipType: 'evaluatedOn', evidencePaperIds: [p.id], description: `Dataset text names ${d}.` });
    }
    for (const lim of a.limitations) {
      const themes = LIMITATION_THEMES.filter((t) => t.re.test(lim.text));
      const targets = themes.length
        ? themes.map((t) => ({ key: `limitation:${t.id}`, label: t.label }))
        : [{ key: `limitation:${norm(lim.text).slice(0, 60)}`, label: truncate(lim.text, 70) }];
      for (const t of targets) {
        addNode({ key: t.key, label: t.label, type: 'limitation', description: 'Limitation acknowledged by the authors.' });
        addEdge({ sourceKey: pk, targetKey: t.key, relationshipType: 'reportsLimitation', evidencePaperIds: [p.id], description: truncate(lim.text, 240) });
      }
    }
  }

  for (const g of gaps) {
    const gk = `gap:${g.id}`;
    addNode({ key: gk, label: g.title, type: 'gap', description: g.description, relatedEntityId: g.id });
    for (const id of g.supportingPaperIds) addEdge({ sourceKey: gk, targetKey: `paper:${id}`, relationshipType: 'supportedBy', evidencePaperIds: [id], description: 'Paper provides evidence for this potential gap.' });
    for (const t of LIMITATION_THEMES) {
      if (g.meta?.focus && t.label.toLowerCase() === g.meta.focus) addEdge({ sourceKey: gk, targetKey: `limitation:${t.id}`, relationshipType: 'addresses', evidencePaperIds: g.supportingPaperIds, description: 'Gap is derived from this recurring limitation.' });
    }
  }
  return { nodes: [...nodes.values()], edges };
}
