import { apiRequest } from '../../services/api';

export interface PaperAnalysis { _id: string; paperId: string; researchObjective?: string; methodology?: string; datasets?: string; findings?: string; limitations?: string; futureWork?: string; confidence?: string }
export const analysisApi = {
  list: (token: string, paperId: string) => apiRequest<{ items: PaperAnalysis[] }>(`/papers/${encodeURIComponent(paperId)}/analysis`, {}, token),
  analyze: (token: string, paperId: string) => apiRequest<{ analysis: PaperAnalysis }>(`/ai/papers/${encodeURIComponent(paperId)}/analyze`, { method: 'POST', body: '{}' }, token),
};
