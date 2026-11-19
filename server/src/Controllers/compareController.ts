import { comparePapers } from '../Services/compareService';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { asyncHandler } from '../Utils/asyncHandler';
import { AppError } from '../Utils/AppError';

export const compare = asyncHandler(async (req, res) => {
  const ids: string[] = req.body.paperIds;
  const [papers, analyses]: any[] = await Promise.all([
    Paper.find({ _id: { $in: ids }, ownerId: req.user!.id }).select('title publicationYear keywords').lean(),
    PaperAnalysis.find({ paperId: { $in: ids }, ownerId: req.user!.id, analysisStatus: 'completed' }).lean(),
  ]);
  if (papers.length !== ids.length) throw new AppError(404, 'One or more papers were not found');
  const am = new Map(analyses.map((a: any) => [String(a.paperId), a]));
  const ordered = ids.map((id) => papers.find((p: any) => String(p._id) === id)!);
  res.json(comparePapers(ordered.map((p: any) => ({
    id: String(p._id), title: p.title, year: p.publicationYear, keywords: p.keywords || [],
    analysis: am.get(String(p._id)) as any,
  }))));
});
