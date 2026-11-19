import { Paper } from '../model/index.js';

export function listPapers(ownerId: string, page = 1, limit = 20) {
  const safePage = Math.max(1, Math.floor(page)); const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return Paper.find({ ownerId }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean();
}

export function createPaper(ownerId: string, input: Record<string, unknown>) {
  return Paper.create({ ...input, ownerId });
}

export function getPaper(ownerId: string, id: string) {
  return Paper.findOne({ _id: id, ownerId });
}
