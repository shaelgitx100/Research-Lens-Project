import { apiRequest } from '../../services/api';
import type { Paper } from '../../types';

export const papersApi = {
  list: (token: string, page = 1) => apiRequest<{ items: Paper[]; page: number }>(`/papers?page=${page}`, {}, token),
  get: (token: string, id: string) => apiRequest<Paper>(`/papers/${encodeURIComponent(id)}`, {}, token),
  create: (token: string, paper: Partial<Paper>) => apiRequest<Paper>('/papers/import', { method: 'POST', body: JSON.stringify(paper) }, token),
  uploadPdf: (token: string, file: File, title?: string) => {
    const form = new FormData(); form.append('file', file); if (title) form.append('title', title);
    return apiRequest<{ paper: Paper; pages: number }>('/papers/upload', { method: 'POST', body: form }, token);
  },
};
