import type { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

export default function AppLayout({ title, active = 'Overview', onNavigate, onSearch, children }: { title: string; active?: string; onNavigate(page: string): void; onSearch?: () => void; children: ReactNode }) {
  return <div className="app-shell"><Sidebar active={active} onNavigate={onNavigate}/><main className="main-content"><Header title={title} onSearch={onSearch}/>{children}<Footer/></main></div>;
}
