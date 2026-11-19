import { randomUUID } from 'crypto';
import { LiteratureReview } from '../Models/LiteratureReview';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { getOwnedProject } from '../Services/projectData';
import { asyncHandler } from '../Utils/asyncHandler';
import { truncate } from '../Utils/text';

export const get = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await getOwnedProject(req.user!.id, projectId);
  const review = await LiteratureReview.findOneAndUpdate({ projectId, ownerId: req.user!.id }, { $setOnInsert: { themes: [] } }, { upsert: true, new: true }).lean();
  res.json({ review });
});

export const put = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await getOwnedProject(req.user!.id, projectId);
  const owned = new Set((await Paper.find({ ownerId: req.user!.id, projectId }).select('_id').lean()).map((p: any) => String(p._id)));
  const themes = req.body.themes.map((t: any) => ({ ...t, paperIds: t.paperIds.filter((id: string) => owned.has(id)) }));
  const review = await LiteratureReview.findOneAndUpdate({ projectId, ownerId: req.user!.id }, { $set: { themes } }, { upsert: true, new: true }).lean();
  res.json({ review });
});

/** Suggests themes by grouping papers on shared keywords. Suggestions are not saved until the user saves the review. */
export const suggest = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project: any = await getOwnedProject(req.user!.id, projectId);
  const [papers, analyses]: any[] = await Promise.all([Paper.find({ ownerId: req.user!.id, projectId }).select('title keywords').lean(), PaperAnalysis.find({ ownerId: req.user!.id, projectId }).select('paperId findings').lean()]);
  const fm = new Map<string, string | undefined>(analyses.map((a: any) => [String(a.paperId), a.findings?.[0]?.text as string | undefined]));
  const skip = new Set(project.keywords.map((k: string) => k.toLowerCase()));
  const groups = new Map<string, any[]>();
  for (const p of papers) for (const k of p.keywords || []) {
    const key = k.toLowerCase();
    if (skip.has(key)) continue;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  const used = new Set<string>();
  const themes: any[] = [];
  for (const [key, ps] of [...groups.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)) {
    const fresh = ps.filter((p) => !used.has(String(p._id)));
    if (fresh.length < 2) continue;
    fresh.forEach((p) => used.add(String(p._id)));
    themes.push({
      themeId: randomUUID(), title: key.replace(/\b\w/g, (c) => c.toUpperCase()), paperIds: fresh.map((p) => String(p._id)),
      summary: fresh.map((p) => (fm.get(String(p._id)) ? `${truncate(fm.get(String(p._id))!, 220)} (${truncate(p.title, 60)})` : '')).filter(Boolean).join('\n'),
      summaryOrigin: 'sourceDerived', notes: '',
    });
    if (themes.length >= 6) break;
  }
  const rest = papers.filter((p: any) => !used.has(String(p._id)));
  if (rest.length) themes.push({ themeId: randomUUID(), title: 'Unassigned papers', paperIds: rest.map((p: any) => String(p._id)), summary: '', summaryOrigin: 'userWritten', notes: '' });
  res.json({ themes, origin: 'aiSuggested', note: 'Theme grouping is an AI generated suggestion based on shared keywords. Summaries quote the first extracted finding of each paper.' });
});
