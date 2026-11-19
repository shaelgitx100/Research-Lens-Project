import { apiRequest } from '../../services/api';

export interface Citation { _id: string; paperId: string; style: 'APA' | 'MLA' | 'Chicago'; formattedText: string }
export const citationApi = {
  list: (token: string) => apiRequest<{ items: Citation[] }>('/citations', {}, token),
  create: (token: string, paperId: string, style: Citation['style'] = 'APA') => apiRequest<Citation>('/citations', { method: 'POST', body: JSON.stringify({ paperId, style }) }, token),
};
