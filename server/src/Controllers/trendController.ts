import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { getOwnedProject } from '../Services/projectData';
import { computeTrends } from '../Services/trendService';
import { asyncHandler } from '../Utils/asyncHandler';

export const trends = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await getOwnedProject(req.user!.id, projectId);
  const [papers, analyses] = await Promise.all([
    Paper.find({ ownerId: req.user!.id, projectId }).select('publicationYear keywords domain venue').lean(),
    PaperAnalysis.find({ ownerId: req.user!.id, projectId, analysisStatus: 'completed' }).select('paperId methodology').lean(),
  ]);
  const mm = new Map(analyses.map((a: any) => [String(a.paperId), a.methodology.map((e: any) => e.text).join(' ')]));
  res.json(computeTrends(papers.map((p: any) => ({ id: String(p._id), year: p.publicationYear, keywords: p.keywords || [], domain: p.domain, venue: p.venue, methodology: mm.get(String(p._id)) }))));
});
