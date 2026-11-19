import { AiFeatureResult, Analysis, Paper, Project, Question, Report, Workspace } from '../model/index.js';
import ResearchGap from '../Models/ResearchGap.js';
import Citation from '../Models/Citation.js';
import { isValidObjectId } from 'mongoose';
import { AppError } from '../Utils/AppError.js';
import type { NextFunction, Request, Response } from 'express';
import type {} from '../Types/express.js';

const initializedOwners = new Set<string>();

export async function ensurePersonalWorkspace(ownerId: string) {
  const workspace = await Workspace.findOneAndUpdate(
    { ownerId, isDefault: true },
    { $setOnInsert: { name: 'Personal Workspace', nameKey: 'personal workspace', ownerId, isDefault: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  if (!initializedOwners.has(ownerId)) {
    const workspaceId = workspace._id;
    await Promise.all([
      Project.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      Paper.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      Analysis.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      AiFeatureResult.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      Question.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      Report.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      ResearchGap.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
      Citation.updateMany({ ownerId, workspaceId: { $exists: false } }, { $set: { workspaceId } }),
    ]);
    initializedOwners.add(ownerId);
  }
  return workspace;
}

export async function resolveWorkspace(ownerId: string, requestedId?: string) {
  const personal = await ensurePersonalWorkspace(ownerId);
  if (!requestedId) return personal;
  if (!isValidObjectId(requestedId)) throw new AppError(404, 'Workspace not found.');
  const workspace = await Workspace.findOne({ _id: requestedId, ownerId }).exec();
  if (!workspace) throw new AppError(404, 'Workspace not found.');
  return workspace;
}

export function attachWorkspace(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(new AppError(401, 'Authentication required.'));
  const requestedId = req.headers['x-workspace-id'];
  void resolveWorkspace(req.userId, typeof requestedId === 'string' ? requestedId : undefined)
    .then((workspace) => {
      req.workspaceId = String(workspace._id);
      next();
    })
    .catch(next);
}

export async function createWorkspace(ownerId: string, name: string) {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  const nameKey = normalizedName.toLocaleLowerCase();
  const existing = await Workspace.exists({ ownerId, nameKey });
  if (existing) throw new AppError(409, 'A workspace with this name already exists.');
  return Workspace.create({ name: normalizedName, nameKey, ownerId, isDefault: false });
}

export async function renameWorkspace(ownerId: string, workspaceId: string, name: string) {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  const nameKey = normalizedName.toLocaleLowerCase();
  const existing = await Workspace.exists({ ownerId, nameKey, _id: { $ne: workspaceId } });
  if (existing) throw new AppError(409, 'A workspace with this name already exists.');
  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, ownerId },
    { $set: { name: normalizedName, nameKey } },
    { new: true, runValidators: true },
  ).exec();
  if (!workspace) throw new AppError(404, 'Workspace not found.');
  return workspace;
}
