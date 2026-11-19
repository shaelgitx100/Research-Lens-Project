import { Types } from 'mongoose';
import { buildGraph } from '../mapping/graphBuilder';
import { KnowledgeEdge } from '../Models/KnowledgeEdge';
import { KnowledgeNode } from '../Models/KnowledgeNode';
import { Paper } from '../Models/Paper';
import { PaperAnalysis } from '../Models/PaperAnalysis';
import { ResearchGap } from '../Models/ResearchGap';
import { getOwnedProject } from './projectData';

export async function rebuildGraph(ownerId: string, projectId: string) {
  const project: any = await getOwnedProject(ownerId, projectId);
  const [papers, analyses, gaps] = await Promise.all([
    Paper.find({ ownerId, projectId }).select('title authors keywords abstract').lean(),
    PaperAnalysis.find({ ownerId, projectId, analysisStatus: 'completed' }).lean(),
    ResearchGap.find({ ownerId, projectId }).select('title category description supportingPaperIds meta').lean(),
  ]);
  const am = new Map(analyses.map((a: any) => [String(a.paperId), a]));
  const graph = buildGraph(
    project,
    papers.map((p: any) => ({ id: String(p._id), title: p.title, authors: p.authors, keywords: p.keywords, abstract: p.abstract, analysis: am.get(String(p._id)) as any })),
    gaps.map((g: any) => ({ id: String(g._id), title: g.title, category: g.category, description: g.description, supportingPaperIds: g.supportingPaperIds.map(String), meta: g.meta }))
  );
  const existing: any[] = await KnowledgeNode.find({ projectId, ownerId }).lean();
  const newKeys = new Set(graph.nodes.map((n) => n.key));
  const removeIds = existing.filter((n) => !n.isManual && !newKeys.has(n.key)).map((n) => n._id);
  if (removeIds.length) {
    await KnowledgeNode.deleteMany({ _id: { $in: removeIds } });
    await KnowledgeEdge.deleteMany({ projectId, $or: [{ sourceNodeId: { $in: removeIds } }, { targetNodeId: { $in: removeIds } }] });
  }
  if (graph.nodes.length) {
    await KnowledgeNode.bulkWrite(graph.nodes.map((n) => ({
      updateOne: {
        filter: { projectId: new Types.ObjectId(projectId), key: n.key },
        update: { $set: { ownerId, label: n.label, type: n.type, description: n.description, relatedEntityId: n.relatedEntityId ? new Types.ObjectId(n.relatedEntityId) : undefined, isDemo: !!project.isDemo }, $setOnInsert: { isManual: false } },
        upsert: true,
      },
    })) as any);
  }
  const all: any[] = await KnowledgeNode.find({ projectId, ownerId }).select('key').lean();
  const idByKey = new Map(all.map((n) => [n.key, n._id]));
  await KnowledgeEdge.deleteMany({ projectId, ownerId, isManual: false });
  const edges = graph.edges.filter((e) => idByKey.has(e.sourceKey) && idByKey.has(e.targetKey)).map((e) => ({
    projectId, ownerId, sourceNodeId: idByKey.get(e.sourceKey), targetNodeId: idByKey.get(e.targetKey), relationshipType: e.relationshipType,
    evidencePaperIds: e.evidencePaperIds, description: e.description, isManual: false, isDemo: !!project.isDemo,
  }));
  if (edges.length) await KnowledgeEdge.insertMany(edges);
  return { nodes: graph.nodes.length, edges: edges.length };
}

