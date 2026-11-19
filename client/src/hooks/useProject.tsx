import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Project } from '../types';
import { useAuth } from './useAuth';

interface PCtx { projects: Project[]; current: Project | null; currentId: string; setCurrentId: (id: string) => void; refresh: () => Promise<void>; loading: boolean }
const Ctx = createContext<PCtx>(null as unknown as PCtx);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setId] = useState(localStorage.getItem('rlProject') || '');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const r = await api.get<{ projects: Project[] }>('/projects');
    setProjects(r.projects);
    setId((cur) => (r.projects.some((p) => p.id === cur) ? cur : r.projects[0]?.id || ''));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh().catch(() => setLoading(false)); }, [refresh]);
  const setCurrentId = (id: string) => { setId(id); localStorage.setItem('rlProject', id); };
  const current = projects.find((p) => p.id === currentId) || null;
  return <Ctx.Provider value={{ projects, current, currentId: current?.id || '', setCurrentId, refresh, loading }}>{children}</Ctx.Provider>;
}
export const useProject = () => useContext(Ctx);
