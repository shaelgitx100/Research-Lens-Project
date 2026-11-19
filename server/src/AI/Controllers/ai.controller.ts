import { z } from 'zod';
import { asyncHandler } from '../../Utils/asyncHandler.js';
import { AppError } from '../../Utils/AppError.js';
import { analyzeSavedPaper } from '../Services/paperAnalysis.service.js';
import { aiFeatureNames } from '../Types/feature.types.js';
import { validateAiFeatureRequest } from '../Validators/ai.validator.js';
import { runAiFeature } from '../Services/aiFeatureOrchestrator.service.js';
import { AiFeatureResult } from '../../model/index.js';

const paperParamsSchema = z.object({
  paperId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.'),
});

export const runAiFeatureController = asyncHandler(async (req, res) => {
  const feature = req.params.feature;
  if (!aiFeatureNames.includes(feature as typeof aiFeatureNames[number])) {
    throw new AppError(404, 'Unknown AI feature.');
  }
  const parsed = validateAiFeatureRequest(req.body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid AI feature request.');
  if (!req.userId) throw new AppError(401, 'Authentication required.');
  const { saveResult, ...request } = parsed.data;
  const result = await runAiFeature(
    feature as typeof aiFeatureNames[number],
    request,
    req.userId,
    req.workspaceId!,
    { persistResult: saveResult !== false },
  );
  res.status(saveResult === false ? 200 : 201).json({ result });
});

export const listAiFeatureResultsController = asyncHandler(async (req, res) => {
  const feature = req.params.feature;
  if (!aiFeatureNames.includes(feature as typeof aiFeatureNames[number])) throw new AppError(404, 'Unknown AI feature.');
  if (!req.userId) throw new AppError(401, 'Authentication required.');
  const items = await AiFeatureResult.find({ feature, ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ items });
});

export const analyzePaperController = asyncHandler(async (req, res) => {
  const parsed = paperParamsSchema.safeParse(req.params);
  if (!parsed.success) throw new AppError(400, 'Invalid paper identifier.');
  if (!req.userId) throw new AppError(401, 'Authentication required.');

  const analysis = await analyzeSavedPaper(parsed.data.paperId, req.userId, req.workspaceId!);
  res.status(201).json({ analysis });
});
