import { Types } from 'mongoose';
import { ResearchProject } from '../Models/ResearchProject';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { GapPaper } from '../discovery/types';
import { AppError } from '../Utils/AppError';

export async function getOwnedProject(ownerId: string, projectId: string) {
  const project = await ResearchProject.findOne({ _id: projectId, ownerId }).lean();
  if (!project) throw new AppError(404, 'Project not found');
  return project;
}

export async function loadGapPapers(ownerId: string, projectId: string): Promise<GapPaper[]> {
  const [papers, analyses] = await Promise.all([
    Paper.find({ ownerId, projectId }).select('title publicationYear keywords').lean(),
    PaperAnalysis.find({ ownerId, projectId, analysisStatus: 'completed' }).lean(),
  ]);
  const byPaper = new Map(analyses.map((a: any) => [String(a.paperId), a]));
  return papers.map((p: any) => {
    const a: any = byPaper.get(String(p._id));
    return {
      id: String(p._id), title: p.title, year: p.publicationYear, keywords: p.keywords || [],
      analysis: a ? { methodology: a.methodology, datasets: a.datasets, findings: a.findings, limitations: a.limitations, futureWork: a.futureWork } : undefined,
    };
  });
}

export const oid = (id: string) => new Types.ObjectId(id);

export async function projectStats(ownerId: string) {
  const [papers, analyses] = await Promise.all([
    Paper.aggregate([{ $match: { ownerId: oid(ownerId) } }, { $group: { _id: '$projectId', n: { $sum: 1 } } }]),
    PaperAnalysis.aggregate([{ $match: { ownerId: oid(ownerId), analysisStatus: 'completed' } }, { $group: { _id: '$projectId', n: { $sum: 1 } } }]),
  ]);
  const p = new Map(papers.map((x: any) => [String(x._id), x.n as number]));
  const a = new Map(analyses.map((x: any) => [String(x._id), x.n as number]));
  return (projectId: string) => {
    const total = p.get(projectId) || 0;
    const analyzed = a.get(projectId) || 0;
    return { papers: total, analyzed, progress: total ? Math.round((analyzed / total) * 100) : 0 };
  };
}
