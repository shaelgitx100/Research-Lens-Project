import { discoverGaps } from '../discovery/gapEngine';
import { composite, SCORE_DIMENSIONS, SCORECARD_FORMULA, scoreDimensions } from '../discovery/scorecard';
import { q } from '../Middleware/validate';
import { Paper } from '../Models/Paper';
import { ResearchGap } from '../Models/ResearchGap';
import { ResearchQuestion } from '../Models/ResearchQuestion';
import { getOwnedProject, loadGapPapers } from '../Services/projectData';
import { notify } from '../Services/notify';
import { asyncHandler } from '../Utils/asyncHandler';
import { AppError } from '../Utils/AppError';
import { escapeRegex } from '../Utils/text';
import { pageMeta, pageParams } from '../Utils/pagination';
import { User } from '../Models/User';

const CAVEAT = 'Potential research gaps are generated from the collected and analyzed papers only. They are not established scientific facts and do not show that a topic is unexplored in the wider literature. Human academic review is required.';

const withComposite = (g: any) => ({ ...g, id: String(g._id), composite: composite(g.scorecard?.dimensions || []) });

export const discover = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const project: any = await getOwnedProject(req.user!.id, projectId);
  const papers = await loadGapPapers(req.user!.id, projectId);
  const analyzed = papers.filter((p) => p.analysis);
  const user: any = await User.findById(req.user!.id).select('preferences').lean();
  const min = user?.preferences?.research?.minPapersForGaps ?? 3;
  if (analyzed.length < Math.max(2, min)) throw new AppError(422, `Analyze at least ${Math.max(2, min)} papers before discovering gaps. ${analyzed.length} analyzed so far.`);

  const drafts = discoverGaps(papers);
  const verified = await ResearchGap.find({ ownerId: req.user!.id, projectId, classification: 'researcherVerified' }).select('signature').lean();
  const keep = new Set(verified.map((v: any) => v.signature));
  const old = await ResearchGap.find({ ownerId: req.user!.id, projectId, classification: 'potential' }).select('_id').lean();
  const oldIds = old.map((o: any) => o._id);
  await ResearchQuestion.deleteMany({ ownerId: req.user!.id, projectId, relatedGapId: { $in: oldIds }, status: 'proposed' });
  await ResearchGap.deleteMany({ _id: { $in: oldIds } });

  const docs = drafts.filter((d) => !keep.has(d.signature)).map((d) => {
    const { matcher, ...rest } = d;
    return { ...rest, ownerId: req.user!.id, projectId, domain: project.domain, scorecard: { dimensions: scoreDimensions(d, analyzed) }, origin: 'engine', isDemo: false };
  });
  const created = docs.length ? await ResearchGap.insertMany(docs) : [];
  if (created.length) await notify(req.user!.id, 'gapIdentified', `${created.length} potential research gaps identified for ${project.title.slice(0, 60)}`, '/app/gaps');
  res.status(201).json({ created: created.length, analyzedPapers: analyzed.length, caveat: CAVEAT });
});

export const list = asyncHandler(async (req, res) => {
  const p = q(req);
  const filter: any = { ownerId: req.user!.id };
  if (p.projectId) filter.projectId = p.projectId;
  if (p.category) filter.category = p.category;
  if (p.label) filter['evidenceStrength.label'] = p.label;
  if (p.classification) filter.classification = p.classification;
  if (p.q) filter.$or = [{ title: new RegExp(escapeRegex(p.q), 'i') }, { description: new RegExp(escapeRegex(p.q), 'i') }];
  const page = pageParams(p.page, p.limit);
  const [items, total] = await Promise.all([
    ResearchGap.find(filter).select('-supportingEvidence -reasoning').sort({ 'evidenceStrength.supportCount': -1, createdAt: -1 }).skip(page.skip).limit(page.limit).lean(),
    ResearchGap.countDocuments(filter),
  ]);
  res.json({ gaps: items.map(withComposite), pagination: pageMeta(total, page), dimensions: SCORE_DIMENSIONS, formula: SCORECARD_FORMULA, caveat: CAVEAT });
});

export const get = asyncHandler(async (req, res) => {
  const gap: any = await ResearchGap.findOne({ _id: req.params.id, ownerId: req.user!.id }).lean();
  if (!gap) throw new AppError(404, 'Gap not found');
  const papers = await Paper.find({ _id: { $in: gap.supportingPaperIds }, ownerId: req.user!.id }).select('title authors publicationYear venue DOI source isDemo').lean();
  res.json({ gap: withComposite(gap), supportingPapers: papers.map((p: any) => ({ ...p, id: String(p._id) })), formula: SCORECARD_FORMULA, caveat: CAVEAT });
});

export const patch = asyncHandler(async (req, res) => {
  const gap = await ResearchGap.findOneAndUpdate({ _id: req.params.id, ownerId: req.user!.id }, { $set: req.body }, { new: true });
  if (!gap) throw new AppError(404, 'Gap not found');
  res.json({ gap: withComposite(gap.toObject()) });
});
