import { generateQuestions, QUESTION_DISCLAIMER } from '../discovery/questionGenerator';
import { q } from '../Middleware/validate';
import { ResearchGap } from '../Models/ResearchGap';
import { ResearchQuestion } from '../Models/ResearchQuestion';
import { getOwnedProject, loadGapPapers } from '../Services/projectData';
import { asyncHandler } from '../Utils/asyncHandler';
import { AppError } from '../Utils/AppError';
import { pageMeta, pageParams } from '../Utils/pagination';

export const generate = asyncHandler(async (req, res) => {
  const { projectId, gapIds } = req.body;
  const project: any = await getOwnedProject(req.user!.id, projectId);
  const filter: any = { ownerId: req.user!.id, projectId };
  if (gapIds?.length) filter._id = { $in: gapIds };
  const gaps: any[] = await ResearchGap.find(filter).sort({ 'evidenceStrength.supportCount': -1 }).limit(12).lean();
  if (!gaps.length) throw new AppError(422, 'Discover research gaps first. Questions are generated from evidence supported gaps.');
  const papers = await loadGapPapers(req.user!.id, projectId);
  const existing = new Set((await ResearchQuestion.find({ ownerId: req.user!.id, projectId }).select('question').lean()).map((x: any) => x.question));
  const docs: any[] = [];
  for (const g of gaps) {
    for (const d of generateQuestions({ ...g, supportingPaperIds: g.supportingPaperIds.map(String) }, project.topic, papers)) {
      if (existing.has(d.question)) continue;
      docs.push({ ...d, ownerId: req.user!.id, projectId, relatedGapId: g._id, origin: 'generated', status: 'proposed', isDemo: !!g.isDemo });
    }
  }
  const created = docs.length ? await ResearchQuestion.insertMany(docs) : [];
  res.status(201).json({ created: created.length, disclaimer: QUESTION_DISCLAIMER });
});

export const list = asyncHandler(async (req, res) => {
  const p = q(req);
  const filter: any = { ownerId: req.user!.id };
  if (p.projectId) filter.projectId = p.projectId;
  if (p.status) filter.status = p.status;
  if (p.gapId) filter.relatedGapId = p.gapId;
  const page = pageParams(p.page, p.limit, 100, 30);
  const [items, total] = await Promise.all([ResearchQuestion.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), ResearchQuestion.countDocuments(filter)]);
  const gapIds = items.map((i: any) => i.relatedGapId).filter(Boolean);
  const gaps = await ResearchGap.find({ _id: { $in: gapIds }, ownerId: req.user!.id }).select('title category').lean();
  const gm = new Map(gaps.map((g: any) => [String(g._id), g]));
  res.json({
    questions: items.map((i: any) => ({ ...i, id: String(i._id), gap: i.relatedGapId ? gm.get(String(i.relatedGapId)) || null : null })),
    pagination: pageMeta(total, page), disclaimer: QUESTION_DISCLAIMER,
  });
});

export const create = asyncHandler(async (req, res) => {
  await getOwnedProject(req.user!.id, req.body.projectId);
  const doc = await ResearchQuestion.create({ ...req.body, ownerId: req.user!.id, origin: 'user', status: 'saved' });
  res.status(201).json({ question: doc });
});

export const patch = asyncHandler(async (req, res) => {
  const doc = await ResearchQuestion.findOneAndUpdate({ _id: req.params.id, ownerId: req.user!.id }, { $set: req.body }, { new: true });
  if (!doc) throw new AppError(404, 'Question not found');
  res.json({ question: doc });
});

export const remove = asyncHandler(async (req, res) => {
  const r = await ResearchQuestion.deleteOne({ _id: req.params.id, ownerId: req.user!.id });
  if (!r.deletedCount) throw new AppError(404, 'Question not found');
  res.json({ ok: true });
});

export const exportQuestions = asyncHandler(async (req, res) => {
  const p = q(req);
  const filter: any = { ownerId: req.user!.id, status: { $ne: 'archived' } };
  if (p.projectId) filter.projectId = p.projectId;
  if (p.status) filter.status = p.status;
  const items: any[] = await ResearchQuestion.find(filter).sort({ createdAt: 1 }).lean();
  const md = [
    '# Research questions', '', `> ${QUESTION_DISCLAIMER}`, '',
    ...items.flatMap((i, n) => [
      `## ${n + 1}. ${i.question}`, '', `Status: ${i.status}. Feasibility: ${i.feasibility?.level}.`, '',
      `Motivation: ${i.motivation}`, '', `Proposed methodology: ${i.proposedMethodology}`, '', `Required dataset: ${i.requiredDataset}`, '',
      `Evaluation metrics: ${(i.evaluationMetrics || []).join(', ')}`, '', `Expected contribution: ${i.expectedContribution}`, '',
      ...(i.notes ? [`Notes: ${i.notes}`, ''] : []),
    ]),
  ].join('\n');
  res.type('text/markdown').set('Content-Disposition', 'attachment; filename="researchQuestions.md"').send(md);
});
