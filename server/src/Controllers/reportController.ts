import { Report } from '../model/index.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import { generateProjectReport } from '../Services/reportService.js';

export const list = asyncHandler(async (req, res) => res.json({ items: await Report.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean() }));
export const generate = asyncHandler(async (req, res) => res.status(201).json(await generateProjectReport(req.userId!, String(req.body.projectId || ''))));
export const get = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, ownerId: req.userId });
  return report ? res.json(report) : res.status(404).json({ error: 'Report not found.' });
});
