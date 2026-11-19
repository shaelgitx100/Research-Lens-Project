import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { ResearchGap } from '../Models/ResearchGap';
import { ResearchProject } from '../Models/ResearchProject';
import { ResearchQuestion } from '../Models/ResearchQuestion';
import { KnowledgeNode } from '../Models/KnowledgeNode';
import { projectStats } from '../Services/projectData';
import { computeTrends } from '../Services/trendService';
import { asyncHandler } from '../Utils/asyncHandler';
import { composite } from '../discovery/scorecard';

export const dashboard = asyncHandler(async (req, res) => {
  const owner = req.user!.id;
  const [projects, papers, analyses, gaps, questionCount, topicCount, realPapers, stats]: any[] = await Promise.all([
    ResearchProject.find({ ownerId: owner }).sort({ createdAt: -1 }).lean(),
    Paper.find({ ownerId: owner }).select('title publicationYear keywords createdAt isDemo projectId').sort({ createdAt: -1 }).lean(),
    PaperAnalysis.find({ ownerId: owner, analysisStatus: 'completed' }).select('paperId limitations updatedAt').sort({ updatedAt: -1 }).lean(),
    ResearchGap.find({ ownerId: owner }).select('title category evidenceStrength scorecard createdAt isDemo projectId supportingEvidence').sort({ createdAt: -1 }).lean(),
    ResearchQuestion.countDocuments({ ownerId: owner }),
    KnowledgeNode.countDocuments({ ownerId: owner, type: 'topic' }),
    Paper.countDocuments({ ownerId: owner, isDemo: false }),
    projectStats(owner),
  ]);
  const titleOf = new Map(papers.map((p: any) => [String(p._id), p.title]));
  const trends = computeTrends(papers.map((p: any) => ({ id: String(p._id), year: p.publicationYear, keywords: p.keywords || [] })));
  const byCategory = new Map<string, number>();
  gaps.forEach((g: any) => byCategory.set(g.category, (byCategory.get(g.category) || 0) + 1));
  res.json({
    counts: {
      papers: papers.length, topics: topicCount, limitations: analyses.reduce((s: number, a: any) => s + (a.limitations?.length || 0), 0),
      gaps: gaps.length, questions: questionCount, activeProjects: projects.filter((p: any) => p.status !== 'completed').length,
    },
    realPapers,
    recentPapers: papers.slice(0, 6).map((p: any) => ({ id: String(p._id), title: p.title, year: p.publicationYear, isDemo: p.isDemo })),
    recentAnalyses: analyses.slice(0, 5).map((a: any) => ({ paperId: String(a.paperId), title: titleOf.get(String(a.paperId)), at: a.updatedAt })),
    recentProjects: projects.slice(0, 4).map((p: any) => ({ id: String(p._id), title: p.title, status: p.status, isDemo: p.isDemo, createdAt: p.createdAt })),
    gapOverview: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    topicDistribution: trends.keywords.slice(0, 8),
    progress: projects.map((p: any) => ({ id: String(p._id), title: p.title, status: p.status, isDemo: p.isDemo, ...stats(String(p._id)) })),
    emerging: trends.growth.filter((g) => g.direction === 'increasing').slice(0, 5),
    discoveries: gaps.slice(0, 5).map((g: any) => ({ id: String(g._id), title: g.title, label: g.evidenceStrength?.label, composite: composite(g.scorecard?.dimensions || []), excerpt: g.supportingEvidence?.[0]?.excerpt, isDemo: g.isDemo })),
  });
});
