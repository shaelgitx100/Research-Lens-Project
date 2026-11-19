import { ResearchGap } from '../Models/ResearchGap.js';
import { Project } from '../model/index.js';
import { AppError } from '../Utils/AppError.js';

export function listResearchGaps(ownerId: string, workspaceId: string, projectId?: string) {
  return ResearchGap.find({ ownerId, workspaceId, ...(projectId ? { projectId } : {}) }).sort({ createdAt: -1 }).lean();
}

export async function createResearchGap(ownerId: string, workspaceId: string, input: { title: string; description: string; category?: string; strength?: string; projectId?: string }) {
  if (input.projectId && !await Project.exists({ _id: input.projectId, ownerId, workspaceId })) {
    throw new AppError(404, 'Project not found.');
  }
  return ResearchGap.create({ ...input, ownerId, workspaceId });
}
