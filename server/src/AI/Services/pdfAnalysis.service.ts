import { generateFeatureResult } from './featureGeneration.service.js';
export const analyzePdfText = (context: string) => generateFeatureResult('pdf-analysis', context);
