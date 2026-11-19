import { generateFeatureResult } from './featureGeneration.service.js';
export const analyzeCitations = (context: string) => generateFeatureResult('citation-analysis', context);
