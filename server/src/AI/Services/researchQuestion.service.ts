import { generateFeatureResult } from './featureGeneration.service.js';
export const generateResearchQuestions = (context: string) => generateFeatureResult('research-questions', context);
