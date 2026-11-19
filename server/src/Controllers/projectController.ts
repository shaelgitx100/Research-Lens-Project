import { Project } from '../model/index.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import { projectSchema } from '../Validators/projectValidator.js';

export const listProjects = asyncHandler(async (req, res) => res.json({ items: await Project.find({ ownerId: req.userId }).sort({ updatedAt: -1 }).lean() }));
export const createProject = asyncHandler(async (req, res) => res.status(201).json(await Project.create({ ...projectSchema.parse(req.body), ownerId: req.userId })));
export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ownerId: req.userId });
  return project ? res.json(project) : res.status(404).json({ error: 'Project not found.' });
});
export const deleteProject = asyncHandler(async (req, res) => {
  const result = await Project.deleteOne({ _id: req.params.id, ownerId: req.userId });
  return result.deletedCount ? res.status(204).end() : res.status(404).json({ error: 'Project not found.' });
});
