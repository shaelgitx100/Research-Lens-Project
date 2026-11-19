import { asyncHandler } from '../Utils/asyncHandler.js';
import { createResearchGap, listResearchGaps } from '../Services/researchGapService.js';

export const list = asyncHandler(async (req, res) => res.json({ items: await listResearchGaps(req.userId!, req.workspaceId!, typeof req.query.projectId === 'string' ? req.query.projectId : undefined) }));
export const create = asyncHandler(async (req, res) => res.status(201).json(await createResearchGap(req.userId!, req.workspaceId!, req.body)));
