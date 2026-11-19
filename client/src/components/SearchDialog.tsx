import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { api, qs } from '../services/api';
import { Pagination, Modal, Spinner, Badge } from './ui';
import { Pagination as P } from '../types';

interface Result { type: string; id: string; title: string; subtitle: string; link: string }
const TYPES = ['papers', 'authors', 'keywords', 'methodologies', 'gaps', 'questions', 'projects'];

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ year: '', venue: '', paperType: '', status: '', types: '' });
  const dq = useDebounce(text.trim(), 350);
  useEffect(() => { setPage(1); }, [dq, filters]);
  const { data, loading, error } = useAsync(() => api.get<{ results: Result[]; pagination: P }>(`/search${qs({ q: dq, page, limit: 10, year: filters.year, venue: filters.venue, paperType: filters.paperType, status: filters.status, types: filters.types })}`), [dq, page, filters], open && dq.length >= 2);
  return (
    <Modal open={open} onClose={onClose} title="Search ResearchLens" wide>
      <input autoFocus className="input" placeholder="Search papers, authors, keywords, methods, gaps, questions, projects" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search query" />
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <input className="input" placeholder="Year" inputMode="numeric" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label="Publication year" />
        <input className="input" placeholder="Venue" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })} aria-label="Venue" />
        <select className="input" value={filters.paperType} onChange={(e) => setFilters({ ...filters, paperType: e.target.value })} aria-label="Paper type"><option value="">Any type</option>{['journal', 'conference', 'preprint', 'book', 'other'].map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Analysis status"><option value="">Any status</option><option value="analyzed">Analyzed</option><option value="unanalyzed">Not analyzed</option></select>
        <select className="input" value={filters.types} onChange={(e) => setFilters({ ...filters, types: e.target.value })} aria-label="Result type"><option value="">All results</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <div className="mt-4 min-h-[8rem]">
        {dq.length < 2 ? <p className="text-sm text-muted">Type at least two characters.</p> : loading ? <Spinner label="Searching" /> : error ? <p className="text-sm text-bad">{error}</p> : data && data.results.length === 0 ? <p className="text-sm text-muted">No results.</p> : (
          <ul className="divide-y divide-line">
            {data?.results.map((r) => (
              <li key={`${r.type}${r.id}`}><button className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-raised/60" onClick={() => { nav(r.link); onClose(); }}>
                <Badge>{r.type}</Badge><span className="min-w-0"><span className="block truncate text-sm">{r.title}</span><span className="block truncate text-xs text-muted">{r.subtitle}</span></span>
              </button></li>
            ))}
          </ul>
        )}
      </div>
      {data && <Pagination page={data.pagination.page} pages={data.pagination.pages} onPage={setPage} />}
    </Modal>
  );
}
