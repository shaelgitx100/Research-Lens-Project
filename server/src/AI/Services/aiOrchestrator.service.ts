import type { PaperAnalysisInput } from '../Types/paper.types.js';
import { generatePaperAnalysis } from '../Clients/geminiClient.js';

export const runPaperAnalysis = (paper: PaperAnalysisInput) => generatePaperAnalysis(paper);
