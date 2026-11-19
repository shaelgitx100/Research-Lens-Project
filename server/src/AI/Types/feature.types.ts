import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { AiFeatureRequestInput } from '../Validators/ai.validator.js';

export const aiFeatureNames = [
  'paper-summary', 'methodology', 'literature-review', 'research-gap',
  'research-questions', 'hypothesis', 'research-proposal', 'citation-analysis',
  'pdf-analysis', 'research-assistant', 'literature-comparison',
] as const;
export type AiFeatureName = typeof aiFeatureNames[number];

export const aiFeatureResultSchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(5000),
  sections: z.array(z.object({ heading: z.string().min(1).max(200), content: z.string().min(1).max(8000) })).max(16),
  recommendations: z.array(z.string().min(1).max(1000)).max(12),
  evidence: z.array(z.object({ claim: z.string().min(1).max(500), quote: z.string().min(1).max(600), sourceLocation: z.string().max(160) })).max(12),
  confidence: z.enum(['low', 'medium', 'high']),
  limitations: z.array(z.string().min(1).max(500)).max(10),
});
export type AiFeatureResult = z.infer<typeof aiFeatureResultSchema>;

export const aiFeatureResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING }, summary: { type: Type.STRING },
    sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { heading: { type: Type.STRING }, content: { type: Type.STRING } }, required: ['heading', 'content'] } },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { claim: { type: Type.STRING }, quote: { type: Type.STRING }, sourceLocation: { type: Type.STRING } }, required: ['claim', 'quote', 'sourceLocation'] } },
    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'summary', 'sections', 'recommendations', 'evidence', 'confidence', 'limitations'],
};

export { aiFeatureRequestSchema } from '../Validators/ai.validator.js';
export type AiFeatureRequest = AiFeatureRequestInput;
