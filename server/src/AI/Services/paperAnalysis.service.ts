import { Analysis, Paper } from '../../model/index.js';
import { AppError } from '../../Utils/AppError.js';
import { runPaperAnalysis } from './aiOrchestrator.service.js';

export async function analyzeSavedPaper(paperId: string, ownerId: string, workspaceId: string) {
  const paper = await Paper.findOne({ _id: paperId, ownerId, workspaceId })
    .select('title authors abstract publicationYear venue extractedText fileName publicationUrl')
    .lean().exec() as any;
  if (!paper) throw new AppError(404, 'Paper not found.');

  const sourceText = (paper.extractedText || paper.abstract || '').trim().slice(0, 80_000);
  if (sourceText.length < 80) {
    throw new AppError(422, 'This paper needs an abstract or extracted text of at least 80 characters before analysis.');
  }

  const { analysis, model } = await runPaperAnalysis({
    title: paper.title,
    authors: paper.authors || [],
    abstract: paper.abstract,
    publicationYear: paper.publicationYear,
    venue: paper.venue,
    sourceText,
  });

  const savedAnalysis = await Analysis.create({
    paperId: paper._id,
    workspaceId,
    ownerId,
    researchObjective: analysis.objective,
    methodology: analysis.methodology,
    datasets: analysis.datasets,
    findings: analysis.findings,
    limitations: analysis.limitations,
    futureWork: analysis.futureWork,
    contributions: analysis.contributions,
    sourceReferences: [paper.fileName || paper.publicationUrl || paper.title],
    analysisStatus: 'Gemini-assisted; researcher review required',
    confidence: analysis.overallConfidence,
    deepAnalysis: analysis,
    aiProvider: 'Google Gemini',
    aiModel: model,
  });

  return savedAnalysis;
}
