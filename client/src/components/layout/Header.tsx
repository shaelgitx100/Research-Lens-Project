import { Search, Bell } from 'lucide-react';
export default function Header({ title, onSearch }: { title: string; onSearch?: () => void }) {
  return <header className="app-header"><div><span className="section-kicker">RESEARCH WORKSPACE</span><h1>{title}</h1></div><div className="header-actions"><button className="icon-btn" type="button" aria-label="Search workspace" onClick={onSearch}><Search size={18}/></button><button className="icon-btn" type="button" aria-label="Notifications"><Bell size={18}/></button></div></header>;
}
