import { q } from '../Middleware/validate';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { ResearchGap } from '../Models/ResearchGap';
import { ResearchProject } from '../Models/ResearchProject';
import { ResearchQuestion } from '../Models/ResearchQuestion';
import { asyncHandler } from '../Utils/asyncHandler';
import { pageMeta, pageParams } from '../Utils/pagination';
import { escapeRegex, truncate } from '../Utils/text';

const ALL = ['papers', 'authors', 'topics', 'keywords', 'methodologies', 'gaps', 'questions', 'projects'];

export const globalSearch = asyncHandler(async (req, res) => {
  const p = q(req);
  const owner = req.user!.id;
  const re = new RegExp(escapeRegex(p.q), 'i');
  const types: string[] = p.types ? p.types.split(',').filter((t: string) => ALL.includes(t)) : ALL;
  const results: { type: string; id: string; title: string; subtitle: string; link: string }[] = [];

  const pf: any = { ownerId: owner };
  if (p.year) pf.publicationYear = p.year;
  if (p.domain) pf.domain = new RegExp(escapeRegex(p.domain), 'i');
  if (p.venue) pf.venue = new RegExp(escapeRegex(p.venue), 'i');
  if (p.paperType) pf.paperType = p.paperType;
  if (p.status) {
    const ids = await PaperAnalysis.find({ ownerId: owner, analysisStatus: 'completed' }).distinct('paperId');
    pf._id = p.status === 'analyzed' ? { $in: ids } : { $nin: ids };
  }
  const paperMatch = { ...pf, $or: [{ title: re }, { abstract: re }, { authors: re }, { keywords: re }] };
  const needPapers = types.some((t) => ['papers', 'authors', 'keywords', 'topics'].includes(t));
  const papers: any[] = needPapers ? await Paper.find(paperMatch).select('title authors keywords publicationYear venue domain').limit(100).lean() : [];

  if (types.includes('papers')) papers.forEach((x) => results.push({ type: 'paper', id: String(x._id), title: x.title, subtitle: `${(x.authors || []).slice(0, 2).join(', ')}${x.publicationYear ? ` (${x.publicationYear})` : ''}`, link: `/app/library/${x._id}` }));
  if (types.includes('authors')) {
    const seen = new Set<string>();
    papers.forEach((x) => (x.authors || []).filter((a: string) => re.test(a)).forEach((a: string) => { if (!seen.has(a)) { seen.add(a); results.push({ type: 'author', id: a, title: a, subtitle: 'Author in your library', link: `/app/library?q=${encodeURIComponent(a)}` }); } }));
  }
  if (types.includes('keywords') || types.includes('topics')) {
    const seen = new Set<string>();
    papers.forEach((x) => (x.keywords || []).filter((k: string) => re.test(k)).forEach((k: string) => { const lk = k.toLowerCase(); if (!seen.has(lk)) { seen.add(lk); results.push({ type: 'keyword', id: k, title: k, subtitle: 'Keyword', link: `/app/library?q=${encodeURIComponent(k)}` }); } }));
  }
  if (types.includes('methodologies')) {
    const an: any[] = await PaperAnalysis.find({ ownerId: owner, 'methodology.text': re }).select('paperId methodology').limit(30).lean();
    const titles = new Map((await Paper.find({ _id: { $in: an.map((a) => a.paperId) }, ...pf }).select('title').lean()).map((t: any) => [String(t._id), t.title]));
    an.forEach((a) => { if (titles.has(String(a.paperId))) results.push({ type: 'methodology', id: String(a.paperId), title: truncate(a.methodology.find((m: any) => re.test(m.text))?.text || '', 140), subtitle: titles.get(String(a.paperId)) as string, link: `/app/analysis/${a.paperId}` }); });
  }
  if (types.includes('gaps')) (await ResearchGap.find({ ownerId: owner, $or: [{ title: re }, { description: re }] }).select('title evidenceStrength').limit(30).lean()).forEach((g: any) => results.push({ type: 'gap', id: String(g._id), title: g.title, subtitle: g.evidenceStrength?.label || '', link: `/app/gaps/${g._id}` }));
  if (types.includes('questions')) (await ResearchQuestion.find({ ownerId: owner, question: re }).select('question status').limit(30).lean()).forEach((x: any) => results.push({ type: 'question', id: String(x._id), title: x.question, subtitle: x.status, link: '/app/questions' }));
  if (types.includes('projects')) (await ResearchProject.find({ ownerId: owner, $or: [{ title: re }, { topic: re }, { keywords: re }] }).select('title topic').limit(20).lean()).forEach((x: any) => results.push({ type: 'project', id: String(x._id), title: x.title, subtitle: x.topic, link: `/app/workspace/${x._id}` }));

  const page = pageParams(p.page, p.limit, 50, 15);
  res.json({ results: results.slice(page.skip, page.skip + page.limit), pagination: pageMeta(results.length, page) });
});
