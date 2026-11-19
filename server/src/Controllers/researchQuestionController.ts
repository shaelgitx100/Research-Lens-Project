import { Question } from '../model/index.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import { z } from 'zod';

const questionSchema = z.object({ question: z.string().trim().min(5).max(2000), motivation: z.string().max(5000).optional(), relatedGapId: z.string().optional(), proposedMethodology: z.string().max(5000).optional() });
export const list = asyncHandler(async (req, res) => res.json({ items: await Question.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean() }));
export const create = asyncHandler(async (req, res) => res.status(201).json(await Question.create({ ...questionSchema.parse(req.body), ownerId: req.userId, status: 'Proposed' })));
