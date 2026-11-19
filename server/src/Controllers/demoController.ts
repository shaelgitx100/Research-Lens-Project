import { asyncHandler } from '../Utils/asyncHandler';
import { loadDemo, removeAllForOwner } from '../Services/demoService';

export const load = asyncHandler(async (req, res) => res.status(201).json(await loadDemo(req.user!.id)));
export const remove = asyncHandler(async (req, res) => { await removeAllForOwner(req.user!.id, false); res.json({ ok: true }); });
