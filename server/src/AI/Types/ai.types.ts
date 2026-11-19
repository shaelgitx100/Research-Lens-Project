import type { AiFeatureName, AiFeatureResult } from './feature.types.js';
import type { AiFeatureRequestInput } from '../Validators/ai.validator.js';

export type AiRequestContext = AiFeatureRequestInput;

export interface AiFeatureExecutionResult {
  feature: AiFeatureName;
  result: AiFeatureResult;
  model: string;
}

export type AiFeatureGeneratedContent = Pick<AiFeatureExecutionResult, 'result' | 'model'>;

export interface AiSourceEvidence {
  claim: string;
  quote: string;
  sourceLocation: string;
}
