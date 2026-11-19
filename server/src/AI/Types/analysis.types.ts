import { Type, type Schema } from '@google/genai';
import { z } from 'zod';

export const paperAnalysisSchema = z.object({
  summary: z.string().min(1).max(2000),
  researchArea: z.string().min(1).max(1000),
  objective: z.string().min(1).max(2000),
  methodology: z.string().min(1).max(3000),
  datasets: z.string().min(1).max(2000),
  findings: z.string().min(1).max(3000),
  limitations: z.string().min(1).max(2500),
  contributions: z.string().min(1).max(2500),
  futureWork: z.string().min(1).max(2000),
  candidateGaps: z.array(z.string().min(1).max(1000)).max(8),
  researchQuestions: z.array(z.string().min(1).max(500)).max(8),
  evidence: z.array(z.object({
    claim: z.string().min(1).max(500),
    quote: z.string().min(1).max(600),
    sourceLocation: z.string().min(1).max(120),
    confidence: z.enum(['low', 'medium', 'high']),
  })).max(12),
  overallConfidence: z.enum(['low', 'medium', 'high']),
  evidenceLimits: z.array(z.string().min(1).max(500)).max(8),
});

export type PaperAnalysisResult = z.infer<typeof paperAnalysisSchema>;

export const paperAnalysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    researchArea: { type: Type.STRING },
    objective: { type: Type.STRING },
    methodology: { type: Type.STRING },
    datasets: { type: Type.STRING },
    findings: { type: Type.STRING },
    limitations: { type: Type.STRING },
    contributions: { type: Type.STRING },
    futureWork: { type: Type.STRING },
    candidateGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    researchQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          quote: { type: Type.STRING },
          sourceLocation: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
        },
        required: ['claim', 'quote', 'sourceLocation', 'confidence'],
      },
    },
    overallConfidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    evidenceLimits: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'summary', 'researchArea', 'objective', 'methodology', 'datasets', 'findings',
    'limitations', 'contributions', 'futureWork', 'candidateGaps', 'researchQuestions',
    'evidence', 'overallConfidence', 'evidenceLimits',
  ],
};
