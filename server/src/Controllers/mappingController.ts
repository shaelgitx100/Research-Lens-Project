import { KnowledgeEdge } from '../Models/KnowledgeEdge';
import { KnowledgeNode } from '../Models/KnowledgeNode';
import { getOwnedProject } from '../Services/projectData';
import { rebuildGraph } from '../Services/graphService';
import { asyncHandler } from '../Utils/asyncHandler';
import { AppError } from '../Utils/AppError';

export const getGraph = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await getOwnedProject(req.user!.id, projectId);
  const [nodes, edges] = await Promise.all([KnowledgeNode.find({ projectId, ownerId: req.user!.id }).lean(), KnowledgeEdge.find({ projectId, ownerId: req.user!.id }).lean()]);
  res.json({
    nodes: nodes.map((n: any) => ({ id: String(n._id), label: n.label, type: n.type, description: n.description, relatedEntityId: n.relatedEntityId ? String(n.relatedEntityId) : null, isManual: n.isManual })),
    edges: edges.map((e: any) => ({ id: String(e._id), source: String(e.sourceNodeId), target: String(e.targetNodeId), relationshipType: e.relationshipType, description: e.description, evidencePaperIds: (e.evidencePaperIds || []).map(String), isManual: e.isManual })),
    note: 'Relationships come from stored paper metadata, analyzed text and research gaps, or were added manually. Nothing is drawn for decoration.',
  });
});

export const build = asyncHandler(async (req, res) => {
  const counts = await rebuildGraph(req.user!.id, req.body.projectId);
  res.status(201).json(counts);
});

export const addNode = asyncHandler(async (req, res) => {
  const { projectId, label, type, description } = req.body;
  await getOwnedProject(req.user!.id, projectId);
  const key = `manual:${type}:${label.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  const node = await KnowledgeNode.findOneAndUpdate({ projectId, key }, { $setOnInsert: { ownerId: req.user!.id, label, type, description: description || '', isManual: true } }, { upsert: true, new: true });
  res.status(201).json({ node });
});

export const addEdge = asyncHandler(async (req, res) => {
  const b = req.body;
  await getOwnedProject(req.user!.id, b.projectId);
  const n = await KnowledgeNode.countDocuments({ _id: { $in: [b.sourceNodeId, b.targetNodeId] }, projectId: b.projectId, ownerId: req.user!.id });
  if (n !== 2 && b.sourceNodeId !== b.targetNodeId) throw new AppError(400, 'Both nodes must belong to this project');
  const edge = await KnowledgeEdge.create({ ...b, ownerId: req.user!.id, isManual: true });
  res.status(201).json({ edge });
});

export const removeEdge = asyncHandler(async (req, res) => {
  const r = await KnowledgeEdge.deleteOne({ _id: req.params.id, ownerId: req.user!.id, isManual: true });
  if (!r.deletedCount) throw new AppError(404, 'Manual relationship not found');
  res.json({ ok: true });
});
