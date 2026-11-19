import { apiRequest } from '../../services/api';

export interface ResearchReport { _id: string; projectId: string; title: string; reportContent: string; references: string[] }
export const thesisApi = {
  reports: (token: string) => apiRequest<{ items: ResearchReport[] }>('/reports', {}, token),
  report: (token: string, id: string) => apiRequest<ResearchReport>(`/reports/${encodeURIComponent(id)}`, {}, token),
  generateReport: (token: string, projectId: string) => apiRequest<ResearchReport>('/reports/generate', { method: 'POST', body: JSON.stringify({ projectId }) }, token),
};
