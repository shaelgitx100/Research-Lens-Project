import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /><circle cx="11" cy="11" r="2" fill="rgb(var(--amber))" stroke="none" /></svg>
      <span className="font-serif text-xl">ResearchLens</span>
    </Link>
  );
}

export function PublicLayout() {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) => `text-sm ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Public navigation">
            <NavLink to="/about" className={link}>About</NavLink><NavLink to="/features" className={link}>Features</NavLink><NavLink to="/how-it-works" className={link}>How it works</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {user ? <Link to="/app" className="btnPrimary">Open workspace</Link> : (<><Link to="/login" className="btnGhost">Sign in</Link><Link to="/register" className="btnPrimary">Start Discovering</Link></>)}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="mt-24 border-t border-line py-10 text-center text-sm text-muted">
        <div className="font-serif text-ink">ResearchLens</div>
        <p className="mt-1">See the research. Find the gap. Create the future.</p>
        <p className="mx-auto mt-3 max-w-xl px-4 text-xs">Generated research gaps and questions are proposals that require human academic review. They are not established scientific facts.</p>
      </footer>
    </div>
  );
}
