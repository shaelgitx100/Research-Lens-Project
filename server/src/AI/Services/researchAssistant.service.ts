import { generateFeatureResult } from './featureGeneration.service.js';
export const answerResearchQuestion = (context: string) => generateFeatureResult('research-assistant', context);
