import { generateFeatureResult } from './featureGeneration.service.js';
export const generatePaperSummary = (context: string) => generateFeatureResult('paper-summary', context);
