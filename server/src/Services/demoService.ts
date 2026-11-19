import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { DEMO_AUTHORS, DEMO_GAPS, DEMO_PAPERS, DEMO_PROJECTS, DEMO_THEMES, DEMO_VENUE } from '../demo/demoData';
import { scoreDimensions } from '../discovery/scorecard';
import { generateQuestions } from '../discovery/questionGenerator';
import { levelFor } from '../discovery/gapEngine';
import { GapPaper } from '../discovery/types';
import { KnowledgeEdge } from '../Models/KnowledgeEdge';
import { KnowledgeNode } from '../Models/KnowledgeNode';
import { LiteratureReview } from '../Models/LiteratureReview';
import { Notification } from '../Models/Notification';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { ResearchGap } from '../Models/ResearchGap';
import { ResearchProject } from '../Models/ResearchProject';
import { ResearchQuestion } from '../Models/ResearchQuestion';
import { ResearchReport } from '../Models/ResearchReport';
import { rebuildGraph } from './graphService';
import { notify } from './notify';

const ev = (texts: string[], section: string) => texts.map((text) => ({ text, section, origin: 'sourceDerived' as const }));

export async function removeProjectData(ownerId: string, projectId: string) {
  const f = { ownerId, projectId };
  await Promise.all([Paper, PaperAnalysis, ResearchGap, ResearchQuestion, KnowledgeNode, KnowledgeEdge, ResearchReport, LiteratureReview].map((m: any) => m.deleteMany(f)));
}

/** includeReal false removes only DEMO records. true removes everything the owner has (used for account deletion). */
export async function removeAllForOwner(ownerId: string, includeReal: boolean) {
  const f: any = includeReal ? { ownerId } : { ownerId, isDemo: true };
  await Promise.all([Paper, PaperAnalysis, ResearchGap, ResearchQuestion, KnowledgeNode, KnowledgeEdge, ResearchReport, LiteratureReview].map((m: any) => m.deleteMany(f)));
  if (!includeReal) await ResearchProject.deleteMany(f);
  else await Notification.deleteMany({ ownerId });
}

export async function loadDemo(ownerId: string) {
  if (await ResearchProject.exists({ ownerId, isDemo: true })) return { loaded: false, message: 'The demo environment is already loaded.' };

  const projects = await ResearchProject.insertMany(DEMO_PROJECTS.map((p) => ({ ...p, ownerId, isDemo: true })));
  const projectIds = projects.map((p) => String(p._id));

  const paperDocs = DEMO_PAPERS.map((d, i) => ({
    ownerId, projectId: projectIds[d.project], title: d.title, authors: [DEMO_AUTHORS[i % 8], DEMO_AUTHORS[(i + 3) % 8]], publicationYear: d.year, venue: DEMO_VENUE,
    paperType: 'conference', source: 'demo', externalId: `demo:${d.key}`, keywords: d.keywords, publicationUrl: '', openAccess: false, citationCount: null,
    referencedWorks: d.cites.map((c) => `demo:${c}`), domain: DEMO_PROJECTS[d.project].domain,
    abstract: `${d.objective} ${d.findings[0]} (DEMO record: fictional abstract written for illustration.)`, textBasis: 'abstract', isDemo: true,
  }));
  const papers = await Paper.insertMany(paperDocs);
  const idOf = new Map(DEMO_PAPERS.map((d, i) => [d.key, String(papers[i]._id)]));

  await PaperAnalysis.insertMany(DEMO_PAPERS.map((d) => ({
    paperId: idOf.get(d.key), ownerId, projectId: projectIds[d.project],
    researchObjective: ev([d.objective], 'Abstract'), researchQuestions: [], methodology: ev(d.methods, 'Methods'), datasets: ev(d.datasets, 'Methods'),
    findings: ev(d.findings, 'Results'), limitations: ev(d.limitations, 'Limitations'), futureWork: ev(d.future, 'Future Work'), contributions: [],
    notExplicit: ['researchQuestions', 'contributions', ...(d.datasets.length ? [] : ['datasets'])], analysisStatus: 'completed', textBasis: 'abstract', isDemo: true,
  })));

  const gapPapers = (pi: number): GapPaper[] => DEMO_PAPERS.filter((d) => d.project === pi).map((d) => ({
    id: idOf.get(d.key)!, title: d.title, year: d.year, keywords: d.keywords,
    analysis: { methodology: ev(d.methods, 'Methods'), datasets: ev(d.datasets, 'Methods'), findings: ev(d.findings, 'Results'), limitations: ev(d.limitations, 'Limitations'), futureWork: ev(d.future, 'Future Work') },
  }));

  const questionBudget: any[] = [];
  for (const g of DEMO_GAPS) {
    const pool = gapPapers(g.project);
    const field = { methods: 'methodology', datasets: 'datasets', findings: 'findings', limitations: 'limitations', future: 'futureWork' } as const;
    const kind = { methods: 'methodology', datasets: 'dataset', findings: 'finding', limitations: 'limitation', future: 'futureWork' } as const;
    const supportingEvidence = g.picks.map(([key, f, idx]) => {
      const dp = DEMO_PAPERS.find((d) => d.key === key)!;
      return { paperId: idOf.get(key), excerpt: (dp as any)[f][idx], section: { methods: 'Methods', datasets: 'Methods', findings: 'Results', limitations: 'Limitations', future: 'Future Work' }[f], kind: kind[f] };
    });
    const supportingPaperIds = g.support.map((k) => idOf.get(k)!);
    const analyzed = pool.filter((p) => p.analysis);
    const draft: any = { category: g.category, supportingPaperIds, supportingEvidence: supportingEvidence.map((e) => ({ ...e, paperId: e.paperId! })), matcher: new RegExp(g.matcher, 'i') };
    const dims = scoreDimensions(draft, analyzed);
    const support = supportingPaperIds.length;
    const doc = await ResearchGap.create({
      ownerId, projectId: projectIds[g.project], title: g.title, description: g.description, category: g.category, domain: DEMO_PROJECTS[g.project].domain,
      supportingPaperIds, supportingEvidence,
      reasoning: `${g.reasoning} This is based only on the ${analyzed.length} analyzed DEMO papers and is not evidence about the real literature. Treat it as a potential research gap that requires human academic review.`,
      evidenceStrength: { label: levelFor(support, analyzed.length, g.category), supportCount: support, totalAnalyzed: analyzed.length, coverage: Math.round((support / analyzed.length) * 100) / 100 },
      relatedMethodologies: g.meta.dominant ? [g.meta.dominant, g.meta.minority] : [],
      authorLimitations: supportingEvidence.filter((e) => e.kind === 'limitation').map((e) => e.excerpt),
      futureRecommendations: supportingEvidence.filter((e) => e.kind === 'futureWork').map((e) => e.excerpt),
      suggestedDirections: g.directions, meta: g.meta, scorecard: { dimensions: dims }, signature: `demo:${g.title}`, origin: 'demo', isDemo: true,
    });
    const qs = generateQuestions({ title: g.title, category: g.category, supportingPaperIds, meta: g.meta, description: g.description, supportingEvidence: supportingEvidence.map((e) => ({ excerpt: e.excerpt })), scorecard: { dimensions: dims } }, DEMO_PROJECTS[g.project].topic, pool);
    qs.slice(0, g.questionCount).forEach((q) => questionBudget.push({ ...q, ownerId, projectId: projectIds[g.project], relatedGapId: doc._id, status: 'proposed', origin: 'generated', isDemo: true }));
  }
  await ResearchQuestion.insertMany(questionBudget);

  await LiteratureReview.create({
    ownerId, projectId: projectIds[0], isDemo: true,
    themes: DEMO_THEMES.map((t) => ({ themeId: randomUUID(), title: t.title, paperIds: t.keys.map((k) => new Types.ObjectId(idOf.get(k)!)), summary: '', summaryOrigin: 'userWritten', notes: '' })),
  });

  for (const id of projectIds) await rebuildGraph(ownerId, id);
  await notify(ownerId, 'projectUpdated', 'Demo environment loaded. All demo records are labeled DEMO.', '/app/workspace');
  return { loaded: true, projects: projectIds.length, papers: papers.length, gaps: DEMO_GAPS.length, questions: questionBudget.length };
}
