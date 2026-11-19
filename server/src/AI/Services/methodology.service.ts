import { generateFeatureResult } from './featureGeneration.service.js';
export const analyzeMethodology = (context: string) => generateFeatureResult('methodology', context);
