import { BookOpen, FolderKanban, LayoutDashboard, Library, Search } from 'lucide-react';
const links = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Projects', icon: FolderKanban }, { name: 'Discover papers', icon: Search }, { name: 'Paper library', icon: Library }, { name: 'Literature review', icon: BookOpen }];
export default function Sidebar({ active, onNavigate }: { active: string; onNavigate(page: string): void }) {
  return <aside className="sidebar"><a className="brand" href="/"><span className="brand-mark"><span/><span/><span/><span/></span><span>research<span className="brand-accent">lens</span></span></a><nav aria-label="Main navigation">{links.map(({ name, icon: Icon })=><button key={name} className={`nav-item ${active === name ? 'active' : ''}`} type="button" onClick={()=>onNavigate(name)}><Icon size={17}/>{name}</button>)}</nav></aside>;
}
