import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { SearchDialog } from '../components/SearchDialog';
import { Topbar } from '../components/Topbar';
import { Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { ProjectProvider } from '../hooks/useProject';

export function AppLayout() {
  const { user, loading } = useAuth();
  const [nav, setNav] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  useEffect(() => { setNav(false); }, [loc.pathname]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  if (loading) return <div className="p-10"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <ProjectProvider>
      <Sidebar open={nav} onClose={() => setNav(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setNav(true)} onSearch={() => setSearch(true)} />
        <main className="mx-auto max-w-7xl p-4 md:p-6"><Outlet /></main>
      </div>
      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </ProjectProvider>
  );
}
