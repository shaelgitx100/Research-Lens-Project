import { AiFeatureResult, Paper, Project } from '../../model/index.js';
import { AppError } from '../../Utils/AppError.js';
import type { AiFeatureName } from '../Types/feature.types.js';
import type { AiRequestContext } from '../Types/ai.types.js';
import { generatePaperSummary } from './paperSummary.service.js';
import { analyzeMethodology } from './methodology.service.js';
import { generateLiteratureReview } from './literatureReview.service.js';
import { generateResearchGaps } from './researchGap.service.js';
import { generateResearchQuestions } from './researchQuestion.service.js';
import { generateHypotheses } from './hypothesis.service.js';
import { generateResearchProposal } from './researchProposal.service.js';
import { analyzeCitations } from './citationAnalysis.service.js';
import { analyzePdfText } from './pdfAnalysis.service.js';
import { answerResearchQuestion } from './researchAssistant.service.js';
import { generateFeatureResult } from './featureGeneration.service.js';

const runners = {
  'paper-summary': generatePaperSummary,
  methodology: analyzeMethodology,
  'literature-review': generateLiteratureReview,
  'research-gap': generateResearchGaps,
  'research-questions': generateResearchQuestions,
  hypothesis: generateHypotheses,
  'research-proposal': generateResearchProposal,
  'citation-analysis': analyzeCitations,
  'pdf-analysis': analyzePdfText,
  'research-assistant': answerResearchQuestion,
  'literature-comparison': (context) => generateFeatureResult('literature-comparison', context),
} satisfies Record<AiFeatureName, (context: string) => Promise<{ result: unknown; model: string }>>;

export async function runAiFeature(
  feature: AiFeatureName,
  request: AiRequestContext,
  ownerId: string,
  workspaceId: string,
  options: { persistResult?: boolean } = {},
) {
  const pieces: string[] = [];
  let paperId: string | undefined;
  let projectId: string | undefined;
  const contextPaperIds = new Set<string>();

  if (request.paperId) {
    const paper = await Paper.findOne({ _id: request.paperId, ownerId, workspaceId })
    .select('title authors abstract publicationYear venue doi publicationUrl citationCount referenceCount referencedWorks extractedText fileName keywords')
      .lean().exec() as any;
    if (!paper) throw new AppError(404, 'Paper not found.');
    paperId = String(paper._id);
    contextPaperIds.add(paperId);
    pieces.push(`Paper metadata: ${JSON.stringify({ title: paper.title, authors: paper.authors, year: paper.publicationYear, venue: paper.venue, doi: paper.doi, url: paper.publicationUrl, citations: paper.citationCount, references: paper.referenceCount, referencedWorks: paper.referencedWorks, keywords: paper.keywords })}`);
    const text = String(paper.extractedText || paper.abstract || '').slice(0, 60000);
    if (text) pieces.push(`Paper source text:\n${text}`);
    if (feature === 'pdf-analysis' && !paper.extractedText) throw new AppError(422, 'PDF analysis requires a saved PDF with extracted text.');
    if (feature !== 'citation-analysis' && text.trim().length < 80) throw new AppError(422, 'This feature needs paper text or an abstract of at least 80 characters.');
  }

  if (request.projectId) {
    const project = await Project.findOne({ _id: request.projectId, ownerId, workspaceId }).lean().exec() as any;
    if (!project) throw new AppError(404, 'Project not found.');
    projectId = String(project._id);
    pieces.push(`Research project: ${JSON.stringify({ title: project.title, topic: project.topic, description: project.description, objectives: project.objectives, keywords: project.keywords, domain: project.domain })}`);
    const sourceFilter = request.paperIds?.length
      ? { _id: { $in: request.paperIds }, ownerId, workspaceId }
      : { projectId: project._id, ownerId, workspaceId };
    const foundPapers = await Paper.find(sourceFilter)
      .select('title authors abstract publicationYear venue doi publicationUrl citationCount referenceCount extractedText fileName keywords')
      .limit(20).lean().exec() as any[];
    if (request.paperIds?.length && foundPapers.length !== new Set(request.paperIds).size) {
      throw new AppError(404, 'One or more selected source papers are unavailable in this workspace.');
    }
    const papers = request.paperIds?.length
      ? request.paperIds.map((id) => foundPapers.find((paper) => String(paper._id) === id)).filter(Boolean)
      : foundPapers;
    for (const paper of papers) contextPaperIds.add(String(paper._id));
    if (papers.length) pieces.push(`Project literature (supplied papers only):\n${papers.map((p, i) => `Paper ${i + 1}: ${JSON.stringify({ title: p.title, authors: p.authors, year: p.publicationYear, venue: p.venue, doi: p.doi, citationCount: p.citationCount, referenceCount: p.referenceCount })}\n${String(p.extractedText || p.abstract || '').slice(0, 5000)}`).join('\n\n')}`);
  }

  if (request.paperIds?.length && !request.projectId) {
    const uniqueIds = [...new Set(request.paperIds)];
    const foundPapers = await Paper.find({ _id: { $in: uniqueIds }, ownerId, workspaceId })
      .select('title authors abstract publicationYear venue doi publicationUrl citationCount referenceCount extractedText fileName keywords')
      .limit(20).lean().exec() as any[];
    if (foundPapers.length !== uniqueIds.length) {
      throw new AppError(404, 'One or more selected source papers are unavailable in this workspace.');
    }
    const papers = uniqueIds.map((id) => foundPapers.find((paper) => String(paper._id) === id)).filter(Boolean);
    for (const paper of papers) contextPaperIds.add(String(paper._id));
    pieces.push(`Selected literature (supplied papers only):\n${papers.map((p, i) => `Paper ${i + 1}: ${JSON.stringify({ title: p.title, authors: p.authors, year: p.publicationYear, venue: p.venue, doi: p.doi })}\n${String(p.extractedText || p.abstract || '').slice(0, 5000)}`).join('\n\n')}`);
  }

  if (request.topic) pieces.push(`Topic: ${request.topic}`);
  if (request.question) pieces.push(`Research question or request: ${request.question}`);
  if (request.context) pieces.push(`Additional user context:\n${request.context}`);
  if (request.messages?.length) pieces.push(`Conversation:\n${request.messages.map((message) => `${message.role}: ${message.content}`).join('\n')}`);
  const context = pieces.join('\n\n').slice(0, 80000);
  if (context.trim().length < 20) throw new AppError(422, 'Provide enough paper, project, topic, or question context to run this feature.');

  const { result, model } = await runners[feature](context);
  if (options.persistResult === false) return { result, aiModel: model, persisted: false };
  const saved = await AiFeatureResult.create({
    feature, paperId, paperIds: contextPaperIds.size ? [...contextPaperIds] : undefined,
    projectId, workspaceId, ownerId, result, aiModel: model,
  });
  return saved;
}
