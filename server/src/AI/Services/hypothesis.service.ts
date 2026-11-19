import { generateFeatureResult } from './featureGeneration.service.js';
export const generateHypotheses = (context: string) => generateFeatureResult('hypothesis', context);
