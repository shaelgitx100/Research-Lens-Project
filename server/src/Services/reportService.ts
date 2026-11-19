import { Paper, Project, Report } from '../model/index.js';

export async function generateProjectReport(ownerId: string, projectId: string) {
  const project = await Project.findOne({ _id: projectId, ownerId });
  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 });
  const papers = await Paper.find({ ownerId, projectId }).sort({ publicationYear: -1 }).lean();
  const references = papers.map((paper) => `${paper.authors?.join(', ') || 'Unknown author'} (${paper.publicationYear || 'n.d.'}). ${paper.title}. ${paper.venue || ''} ${paper.doi || paper.publicationUrl || ''}`.trim());
  return Report.create({ projectId, ownerId, title: `Literature report: ${project.title}`,
    reportContent: `Research topic: ${project.topic || project.title}\n\nObjectives: ${project.objectives || 'Not specified.'}\n\nLiterature overview: ${papers.length} saved publications. Review and analysis required.`, references });
}
