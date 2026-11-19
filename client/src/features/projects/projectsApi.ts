import { apiRequest } from '../../services/api';
import type { Project } from '../../types';

export const projectsApi = {
  list: (token: string) => apiRequest<{ items: Project[] }>('/projects', {}, token),
  get: (token: string, id: string) => apiRequest<Project>(`/projects/${encodeURIComponent(id)}`, {}, token),
  create: (token: string, project: Pick<Project, 'title'> & Partial<Project>) => apiRequest<Project>('/projects', { method: 'POST', body: JSON.stringify(project) }, token),
  remove: (token: string, id: string) => apiRequest<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
};
