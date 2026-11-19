import { apiRequest } from '../../services/api';
import type { ResearchGap } from '../../components/research/ResearchGapCard';

export const researchGapApi = {
  list: (token: string, projectId?: string) => apiRequest<{ items: ResearchGap[] }>(`/research-gaps${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, {}, token),
  create: (token: string, gap: Pick<ResearchGap, 'title' | 'description'> & Partial<ResearchGap>) => apiRequest<ResearchGap>('/research-gaps', { method: 'POST', body: JSON.stringify(gap) }, token),
};
