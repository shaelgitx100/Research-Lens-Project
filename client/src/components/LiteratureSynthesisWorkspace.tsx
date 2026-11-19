import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUp, BookOpen, Check, ChevronRight,
  CircleHelp, FileSearch, FileText, FlaskConical, Layers3, LoaderCircle, LockKeyhole,
  Merge, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search,
  Sparkles, Trash2, X,
} from 'lucide-react';
import type { LiteratureSynthesisHandoff, SynthesisAnalysis, SynthesisEvidence, SynthesisTheme } from './literatureSynthesisTypes';
import '../styles/literature-synthesis.css';
import { verifyLiteratureEvidence } from '../utils/literatureSynthesisEvidence';

type SourcePaper = {
  _id?: string;
  projectId?: string;
  title: string;
  authors?: string[];
  publicationYear?: number;
  venue?: string;
  doi?: string;
  source?: string;
  externalId?: string;
  identifiers?: { openAlexId?: string; semanticScholarId?: string; arxivId?: string; pmid?: string };
  metadataStatus?: string;
  metadataProvider?: string;
  abstract?: string;
  publicationUrl?: string;
  fileName?: string;
  extractedText?: string;
  keywords?: string[];
};

type ReviewDocument = {
  _id?: string;
  title: string;
  sections: { id: string; title: string; content: unknown }[];
  selectedPaperIds: string[];
  notes: string;
  themes: SynthesisTheme[];
  analyses: SynthesisAnalysis[];
  revision: number;
  updatedAt?: string;
};

type Props = {
  project?: { _id: string; title: string; topic?: string };
  papers: SourcePaper[];
  headers: Record<string, string>;
  onDiscover: () => void;
  onCreateProject: () => void;
  onOpenPaper: (paper: SourcePaper) => void;
  onContinueInAcademicEditor: (handoff: LiteratureSynthesisHandoff) => void;
};

type ApiFailure = Error & { status?: number; payload?: any };
type Action = {
  id: string;
  label: string;
  feature: string;
  Icon: typeof Sparkles;
  instruction: string;
};
type ThemeDialogState = { mode: 'create' | 'rename'; themeId?: string; value: string };
type ConfirmDialogState = { title: string; message: string; confirmLabel: string; onConfirm: () => void };

const actions: Action[] = [
  { id: 'thematic-synthesis', label: 'Generate thematic synthesis', feature: 'literature-review', Icon: Layers3, instruction: 'Synthesize shared themes, research objectives, and common contributions across the selected publications.' },
  { id: 'findings-comparison', label: 'Compare findings', feature: 'literature-comparison', Icon: ArrowRight, instruction: 'Compare author-reported findings across the selected publications, noting agreements and differences.' },
  { id: 'methodology-patterns', label: 'Compare methodologies', feature: 'methodology', Icon: FlaskConical, instruction: 'Identify and compare methods explicitly described by the authors. Mark unavailable details as not explicitly stated in the source.' },
  { id: 'contradictions', label: 'Detect contradictory findings', feature: 'literature-comparison', Icon: CircleHelp, instruction: 'Find findings that appear to conflict across the selected publications. Distinguish direct contradictions from differences in scope or method.' },
  { id: 'limitations', label: 'Analyze limitations', feature: 'literature-comparison', Icon: FileSearch, instruction: 'Summarize author-reported limitations only. Do not infer a limitation where the authors do not state one.' },
  { id: 'research-gaps', label: 'Suggest research gaps', feature: 'research-gap', Icon: Sparkles, instruction: 'Identify potential research gaps supported by the selected literature. Clearly label interpretations and ground them in source evidence.' },
  { id: 'research-trends', label: 'Analyze research trends', feature: 'literature-review', Icon: ArrowDown, instruction: 'Describe recurring topics and patterns in the selected publications, without claiming a trend beyond the supplied sources.' },
];

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`) as ApiFailure;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (!text.trim()) throw new Error('The server returned an empty literature review response.');
  return payload as T;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function paperAuthorYear(paper: SourcePaper) {
  const author = paper.authors?.[0]?.split(',')[0]?.trim() || 'Author unavailable';
  return `${author} · ${paper.publicationYear || 'Year unavailable'}`;
}

export default function LiteratureSynthesisWorkspace({
  project,
  papers,
  headers,
  onDiscover,
  onCreateProject,
  onOpenPaper,
  onContinueInAcademicEditor,
}: Props) {
  const [document, setDocument] = useState<ReviewDocument | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'>('loading');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'selected' | 'pdf' | 'metadata'>('all');
  const [activeThemeId, setActiveThemeId] = useState('');
  const [themeDialog, setThemeDialog] = useState<ThemeDialogState | null>(null);
  const [themeDialogError, setThemeDialogError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [candidate, setCandidate] = useState<{ analysis: SynthesisAnalysis; unmatched: { claim: string; quote: string; sourceLocation: string }[] } | null>(null);
  const [generating, setGenerating] = useState('');
  const [aiError, setAiError] = useState('');
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.matchMedia('(max-width: 980px)').matches);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.matchMedia('(max-width: 980px)').matches);
  const [mergeTarget, setMergeTarget] = useState('');
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const authorization = headers.Authorization;
  const workspaceId = headers['X-Workspace-Id'];
  const requestHeaders = useMemo(() => ({
    Authorization: authorization,
    ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
  }), [authorization, workspaceId]);
  const projectId = project?._id || '';
  const projectPapers = useMemo(
    () => papers.filter((paper) => String(paper.projectId) === projectId && Boolean(paper._id)),
    [papers, projectId],
  );
  const activeTheme = document?.themes.find((theme) => theme.id === activeThemeId) || document?.themes[0];
  const selectedIds = document?.selectedPaperIds || [];
  const activeThemePapers = useMemo(() => {
    if (!activeTheme) return [];
    const ids = new Set(activeTheme.paperIds.filter((id) => selectedIds.includes(id)));
    return projectPapers.filter((paper) => paper._id && ids.has(String(paper._id)));
  }, [activeTheme, projectPapers, selectedIds]);
  const filteredPapers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return projectPapers.filter((paper) => {
      const id = String(paper._id);
      if (sourceFilter === 'selected' && !selectedIds.includes(id)) return false;
      if (sourceFilter === 'pdf' && !paper.fileName) return false;
      if (sourceFilter === 'metadata' && !paper.metadataStatus) return false;
      return !normalizedQuery || [
        paper.title, ...(paper.authors || []), paper.doi, paper.venue,
        paper.identifiers?.openAlexId, paper.identifiers?.semanticScholarId,
        paper.identifiers?.arxivId, paper.identifiers?.pmid,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [projectPapers, query, selectedIds, sourceFilter]);
  const analysesForTheme = useMemo(
    () => (document?.analyses || []).filter((analysis) => analysis.themeId === activeTheme?.id),
    [activeTheme, document?.analyses],
  );
  const linkedPaperIds = useMemo(
    () => new Set((document?.analyses || []).flatMap((analysis) => analysis.sourcePaperIds)),
    [document?.analyses],
  );

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setDocument(null);
    setLoadError('');
    setSaveError('');
    setSaveState('loading');
    setCandidate(null);
    setActiveThemeId('');
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/literature-review`, { headers: requestHeaders })
      .then(readResponse<ReviewDocument>)
      .then((data) => {
        if (!active) return;
        const normalized = {
          ...data,
          selectedPaperIds: (data.selectedPaperIds || []).map(String),
          themes: data.themes || [],
          analyses: (data.analyses || []).map((analysis: any) => ({
            ...analysis,
            sourcePaperIds: (analysis.sourcePaperIds || []).map(String),
            evidence: (analysis.evidence || []).map((item: any) => ({ ...item, paperId: String(item.paperId), authors: item.authors || [] })),
          })),
          notes: data.notes || '',
        };
        setDocument(normalized);
        setActiveThemeId(normalized.themes[0]?.id || '');
        setSaveState('saved');
      })
      .catch((cause: Error) => {
        if (!active) return;
        setLoadError(cause.message || 'Could not load this literature review.');
        setSaveState('error');
      });
    return () => { active = false; };
  }, [projectId, requestHeaders, loadAttempt]);

  useEffect(() => {
    if (!document || !projectId || saveState === 'loading' || saveState === 'conflict' || saveState === 'error'
      || revisionRef.current <= savedRevisionRef.current || saveInFlightRef.current) return;
    const snapshot = document;
    const localRevision = revisionRef.current;
    const timer = window.setTimeout(async () => {
      saveInFlightRef.current = true;
      setSaveState('saving');
      setSaveError('');
      let succeeded = false;
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature-review`, {
          method: 'PUT',
          headers: { ...requestHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revision: snapshot.revision,
            title: snapshot.title,
            sections: snapshot.sections,
            selectedPaperIds: snapshot.selectedPaperIds,
            notes: snapshot.notes,
            themes: snapshot.themes,
            analyses: snapshot.analyses,
          }),
        });
        const saved = await readResponse<ReviewDocument>(response);
        succeeded = true;
        savedRevisionRef.current = localRevision;
        setDocument((current) => current ? { ...current, revision: saved.revision, updatedAt: saved.updatedAt } : current);
        setSaveState(revisionRef.current === localRevision ? 'saved' : 'unsaved');
      } catch (cause) {
        const failure = cause as ApiFailure;
        setSaveError(failure.message || 'Could not save this literature review.');
        setSaveState(failure.status === 409 ? 'conflict' : 'error');
      } finally {
        saveInFlightRef.current = false;
        if (succeeded && revisionRef.current > savedRevisionRef.current) setRetry((value) => value + 1);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [document, projectId, requestHeaders, retry, saveState]);

  const updateDocument = (update: (current: ReviewDocument) => ReviewDocument) => {
    if (saveState === 'conflict') return;
    revisionRef.current += 1;
    setSaveState('unsaved');
    setDocument((current) => current ? update(current) : current);
  };

  const loadLatest = async () => {
    setSaveState('loading');
    setSaveError('');
    try {
      const data = await readResponse<ReviewDocument>(await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/literature-review`,
        { headers: requestHeaders },
      ));
      const normalized = {
        ...data,
        selectedPaperIds: (data.selectedPaperIds || []).map(String),
        themes: data.themes || [],
        analyses: (data.analyses || []).map((analysis: any) => ({
          ...analysis,
          sourcePaperIds: (analysis.sourcePaperIds || []).map(String),
          evidence: (analysis.evidence || []).map((item: any) => ({ ...item, paperId: String(item.paperId), authors: item.authors || [] })),
        })),
        notes: data.notes || '',
      };
      setDocument(normalized);
      setActiveThemeId(normalized.themes[0]?.id || '');
      revisionRef.current = 0;
      savedRevisionRef.current = 0;
      setSaveState('saved');
    } catch (cause: any) {
      setSaveError(cause.message || 'Could not reload the latest review.');
      setSaveState('error');
    }
  };
  const reloadLatest = () => {
    if (saveState !== 'conflict') return;
    setConfirmDialog({
      title: 'Reload the latest review?',
      message: 'Your unsaved local changes will be discarded and replaced with the latest saved version.',
      confirmLabel: 'Reload review',
      onConfirm: () => { void loadLatest(); },
    });
  };

  const addTheme = () => {
    if ((document?.themes.length || 0) >= 40) {
      setAiError('This review has reached its 40-theme limit. Remove a theme before adding another.');
      return;
    }
    setAiError('');
    setThemeDialogError('');
    setThemeDialog({ mode: 'create', value: '' });
  };

  const renameTheme = (theme: SynthesisTheme) => {
    setThemeDialogError('');
    setThemeDialog({ mode: 'rename', themeId: theme.id, value: theme.title });
  };

  const saveThemeName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = themeDialog?.value.trim();
    if (!themeDialog || !title) {
      setThemeDialogError('Enter a name for this research theme.');
      return;
    }
    if (themeDialog.mode === 'create') {
      if ((document?.themes.length || 0) >= 40) {
        setThemeDialog(null);
        setAiError('This review has reached its 40-theme limit. Remove a theme before adding another.');
        return;
      }
      const theme: SynthesisTheme = { id: createId(), title, description: '', paperIds: [] };
      updateDocument((current) => ({ ...current, themes: [...current.themes, theme] }));
      setActiveThemeId(theme.id);
    } else {
      updateDocument((current) => ({
        ...current,
        themes: current.themes.map((theme) => theme.id === themeDialog.themeId ? { ...theme, title } : theme),
      }));
    }
    setThemeDialog(null);
    setThemeDialogError('');
  };

  const removeTheme = (theme: SynthesisTheme) => {
    setConfirmDialog({
      title: 'Remove this theme?',
      message: `“${theme.title}” will be removed. Its approved analyses and evidence will be preserved without a theme.`,
      confirmLabel: 'Remove theme',
      onConfirm: () => {
        updateDocument((current) => ({
          ...current,
          themes: current.themes.filter((item) => item.id !== theme.id),
          analyses: current.analyses.map((analysis) => analysis.themeId === theme.id ? { ...analysis, themeId: null } : analysis),
        }));
        setActiveThemeId(document?.themes.find((item) => item.id !== theme.id)?.id || '');
      },
    });
  };

  const moveTheme = (themeIndex: number, direction: -1 | 1) => {
    updateDocument((current) => {
      const target = themeIndex + direction;
      if (target < 0 || target >= current.themes.length) return current;
      const themes = [...current.themes];
      [themes[themeIndex], themes[target]] = [themes[target], themes[themeIndex]];
      return { ...current, themes };
    });
  };

  const mergeTheme = () => {
    if (!document || !activeTheme || !mergeTarget) return;
    const target = document.themes.find((theme) => theme.id === mergeTarget);
    if (!target || target.id === activeTheme.id) return;
    updateDocument((current) => ({
      ...current,
      themes: current.themes
        .filter((theme) => theme.id !== activeTheme.id)
        .map((theme) => theme.id === target.id
          ? { ...theme, paperIds: [...new Set([...theme.paperIds, ...activeTheme.paperIds])] }
          : theme),
      analyses: current.analyses.map((analysis) => analysis.themeId === activeTheme.id
        ? { ...analysis, themeId: target.id }
        : analysis),
    }));
    setActiveThemeId(target.id);
    setMergeTarget('');
  };

  const toggleSource = (paperId: string) => {
    if (!document) return;
    if (selectedIds.includes(paperId) && linkedPaperIds.has(paperId)) return;
    updateDocument((current) => {
      const selected = current.selectedPaperIds.includes(paperId);
      return {
        ...current,
        selectedPaperIds: selected
          ? current.selectedPaperIds.filter((id) => id !== paperId)
          : [...current.selectedPaperIds, paperId].slice(0, 100),
        themes: current.themes.map((theme) => ({
          ...theme,
          paperIds: selected ? theme.paperIds.filter((id) => id !== paperId) : theme.paperIds,
        })),
      };
    });
  };

  const toggleThemeSource = (paperId: string) => {
    if (!document || !activeTheme || !selectedIds.includes(paperId)) return;
    updateDocument((current) => ({
      ...current,
      themes: current.themes.map((theme) => theme.id !== activeTheme.id ? theme : {
        ...theme,
        paperIds: theme.paperIds.includes(paperId)
          ? theme.paperIds.filter((id) => id !== paperId)
          : [...theme.paperIds, paperId],
      }),
    }));
  };

  const generateAnalysis = async (action: Action) => {
    if (!project || !activeTheme || generating) return;
    if ((document?.analyses.length || 0) >= 30) {
      setAiError('This review has reached its 30-analysis limit. Remove an approved analysis before generating another.');
      return;
    }
    const sourceIds = activeTheme.paperIds.filter((id) => selectedIds.includes(id));
    const sourcePapers = projectPapers.filter((paper) => paper._id && sourceIds.includes(String(paper._id)));
    if (sourcePapers.length < 2) {
      setAiError('Add at least two selected publications with source text or abstracts to this theme before analysis.');
      return;
    }
    const usable = sourcePapers.filter((paper) => (paper.extractedText || paper.abstract || '').trim().length >= 80);
    if (usable.length < 2) {
      setAiError('At least two theme sources need an abstract or extracted text of 80 characters or more.');
      return;
    }
    setGenerating(action.id);
    setAiError('');
    setCandidate(null);
    try {
      const response = await fetch(`/api/ai/features/${action.feature}`, {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          paperIds: usable.slice(0, 20).map((paper) => paper._id),
          saveResult: false,
          question: `${action.instruction}\n\nResearch theme: ${activeTheme.title}. Theme description: ${activeTheme.description || 'Not provided by the researcher.'}\n\nAcademic integrity: use only the supplied publications. Never invent publications, authors, citations, page numbers, findings, or evidence quotations. Distinguish author-stated information from your interpretations. For unavailable information, state exactly: "Not explicitly stated in the source." Provide exact short evidence quotations and identify the source paper. Do not present an unsupported claim as a source finding.`,
        }),
      });
      const payload = await readResponse<any>(response);
      const result = payload.result?.result;
      if (!result) throw new Error('The research assistant returned no analysis.');
      const matched = verifyLiteratureEvidence(result.evidence || [], usable);
      const analysis: SynthesisAnalysis = {
        id: createId(),
        kind: action.id,
        feature: action.feature,
        themeId: activeTheme.id,
        title: result.title,
        summary: result.summary,
        sections: result.sections || [],
        recommendations: result.recommendations || [],
        evidence: matched.evidence,
        limitations: result.limitations || [],
        confidence: result.confidence || 'low',
        sourcePaperIds: usable.slice(0, 20).map((paper) => String(paper._id)),
        createdAt: new Date().toISOString(),
      };
      setCandidate({ analysis, unmatched: matched.unmatched });
      if (matched.unmatched.length) {
        setAiError('Some generated evidence could not be matched to the saved source text. Review it, but it cannot be saved as a verified conclusion.');
      }
    } catch (cause: any) {
      setAiError(cause.message || 'Could not analyze the selected publications.');
    } finally {
      setGenerating('');
    }
  };

  const approveCandidate = () => {
    if (!candidate || !document || !activeTheme || !candidate.analysis.evidence.length || candidate.unmatched.length) return;
    updateDocument((current) => ({ ...current, analyses: [candidate.analysis, ...current.analyses] }));
    setCandidate(null);
    setAiError('');
  };

  const deleteAnalysis = (analysis: SynthesisAnalysis) => {
    setConfirmDialog({
      title: 'Remove this approved analysis?',
      message: `“${analysis.title}” and its saved evidence will be removed from this review.`,
      confirmLabel: 'Remove analysis',
      onConfirm: () => updateDocument((current) => ({
        ...current,
        analyses: current.analyses.filter((item) => item.id !== analysis.id),
      })),
    });
  };

  const continueInEditor = () => {
    if (!document || !project) return;
    const referencedIds = new Set([
      ...document.selectedPaperIds,
      ...document.analyses.flatMap((analysis) => analysis.sourcePaperIds),
    ]);
    onContinueInAcademicEditor({
      id: createId(),
      projectId,
      projectTitle: project.title,
      themes: document.themes,
      analyses: document.analyses,
      notes: document.notes,
      sources: projectPapers.filter((paper) => paper._id && referencedIds.has(String(paper._id))).map((paper) => ({
        id: String(paper._id),
        title: paper.title,
        authors: paper.authors || [],
        year: paper.publicationYear,
        doi: paper.doi,
        publicationUrl: paper.publicationUrl,
        sourceDocument: paper.fileName,
      })),
    });
  };

  if (!project) return (
    <section className="ls-empty panel">
      <div className="ls-empty-icon"><BookOpen size={22}/></div>
      <h2>Select a research project to begin</h2>
      <p>Literature synthesis is saved with its project, sources, themes, and evidence.</p>
      <button className="button primary" onClick={onCreateProject}><Plus size={16}/> Create project</button>
    </section>
  );

  if (!document && saveState === 'loading') return <div className="ls-loading" role="status"><LoaderCircle className="ls-spin" size={18}/> Loading your project synthesis…</div>;
  if (!document) return (
    <section className="panel ls-empty">
      <h2>Literature synthesis unavailable</h2>
      <p role="alert">{loadError || 'Could not open this project review.'}</p>
      <button className="button secondary" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</button>
    </section>
  );

  const saveLabel = saveState === 'loading' ? 'Loading' : saveState === 'saving' ? 'Saving' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'conflict' ? 'Version conflict' : saveState === 'error' ? 'Save needs attention' : 'All changes saved';
  const activeThemeIndex = document.themes.findIndex((theme) => theme.id === activeTheme?.id);

  return (
    <section className={`literature-synthesis ${leftCollapsed ? 'ls-left-collapsed' : ''} ${rightCollapsed ? 'ls-right-collapsed' : ''}`} aria-label={`${project.title} literature synthesis workspace`}>
      {!leftCollapsed && <aside className="ls-panel ls-source-panel" aria-label="Research library sources">
        <div className="ls-panel-head">
          <div><span className="ls-kicker">PROJECT LIBRARY</span><h2>Sources <span>{projectPapers.length}</span></h2></div>
          <button type="button" className="ls-icon-button ls-collapse-button" aria-label="Collapse source library" onClick={() => setLeftCollapsed(true)}><PanelLeftClose size={16}/></button>
        </div>
        <label className="ls-search"><Search size={15}/><input aria-label="Search publications" placeholder="Search title, author, DOI…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <label className="ls-filter-label" htmlFor="ls-source-filter">Filter publications</label>
        <select id="ls-source-filter" className="ls-filter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}>
          <option value="all">All project sources</option><option value="selected">Selected for review</option><option value="pdf">PDF available</option><option value="metadata">Metadata status available</option>
        </select>
        <div className="ls-source-meta"><span>{selectedIds.length} selected for review</span><button type="button" onClick={onDiscover}>Find literature <ArrowRight size={12}/></button></div>
        {!projectPapers.length ? <div className="ls-source-empty"><FileSearch size={20}/><p>No saved publications are linked to this project.</p><button className="button secondary" onClick={onDiscover}>Discover and add papers</button></div> : (
          <div className="ls-source-list">
            {document.themes.map((theme) => {
              const themeIds = new Set(theme.paperIds);
              const groupPapers = filteredPapers.filter((paper) => themeIds.has(String(paper._id)));
              if (!groupPapers.length) return null;
              return <div className="ls-source-group" key={theme.id}><div className="ls-source-group-title">{theme.title}</div>{groupPapers.map((paper) => renderSource(paper, document, activeTheme, linkedPaperIds, saveState === 'conflict', toggleSource, toggleThemeSource, onOpenPaper))}</div>;
            })}
            {(() => {
              const assigned = new Set(document.themes.flatMap((theme) => theme.paperIds));
              const remaining = filteredPapers.filter((paper) => !assigned.has(String(paper._id)));
              return remaining.length ? <div className="ls-source-group"><div className="ls-source-group-title">Unassigned sources</div>{remaining.map((paper) => renderSource(paper, document, activeTheme, linkedPaperIds, saveState === 'conflict', toggleSource, toggleThemeSource, onOpenPaper))}</div> : null;
            })()}
            {!filteredPapers.length && <div className="ls-source-empty"><p>No publications match this search or filter.</p><button className="ls-text-button" onClick={() => { setQuery(''); setSourceFilter('all'); }}>Clear filters</button></div>}
          </div>
        )}
        <div className="ls-source-foot"><span>Removing a source here only removes it from this review. The library record remains intact.</span></div>
      </aside>}

      <main className="ls-center-panel">
        <div className="ls-workspace-toolbar">
          <div className="ls-panel-toggles">
            {leftCollapsed && <button className="ls-icon-button" aria-label="Open source library" onClick={() => setLeftCollapsed(false)}><PanelLeftOpen size={17}/></button>}
            {rightCollapsed && <button className="ls-icon-button" aria-label="Open research assistant" onClick={() => setRightCollapsed(false)}><PanelRightOpen size={17}/></button>}
            <div className={`ls-save-state ${saveState}`} role="status"><i/>{saveLabel}</div>
          </div>
          <div className="ls-toolbar-actions">
            <button type="button" className="ls-button secondary" onClick={continueInEditor} disabled={saveState !== 'saved'} title={saveState === 'saved' ? 'Transfer this saved synthesis to the Academic Editor' : 'Wait for the literature review to finish saving'}><FileText size={15}/> Continue in Academic Editor</button>
            <button type="button" className="ls-icon-button ls-collapse-button" aria-label="Collapse research assistant" onClick={() => setRightCollapsed(true)}><PanelRightClose size={16}/></button>
          </div>
        </div>
        {saveError &&         <div className={`ls-alert ${saveState === 'conflict' ? 'warning' : 'error'}`} role="alert"><span>{saveError}</span>{saveState === 'conflict' ? <button className="ls-button secondary" onClick={() => void reloadLatest()}>Reload latest</button> : <button className="ls-button secondary" onClick={() => { setSaveState('unsaved'); setRetry((value) => value + 1); }}>Retry save</button>}</div>}
        <div className="ls-center-content">
          <header className="ls-review-heading">
            <div><span className="ls-kicker">EVIDENCE-BASED LITERATURE SYNTHESIS</span><h1>{project.title}</h1><p>Organize themes and compare source-grounded findings before taking them to your Academic Editor.</p></div>
            <div className="ls-review-stats"><span><strong>{selectedIds.length}</strong> sources</span><span><strong>{document.themes.length}</strong> themes</span><span><strong>{document.analyses.length}</strong> approved analyses</span></div>
          </header>
          <div className="ls-theme-toolbar">
            <div className="ls-theme-tabs" role="tablist" aria-label="Research themes">
              {document.themes.map((theme) => <button key={theme.id} type="button" role="tab" aria-selected={theme.id === activeTheme?.id} className={theme.id === activeTheme?.id ? 'active' : ''} onClick={() => { setActiveThemeId(theme.id); setCandidate(null); setAiError(''); }}><span className="ls-theme-dot"/>{theme.title}</button>)}
            </div>
            <button type="button" className="ls-button secondary" onClick={addTheme} disabled={saveState === 'conflict'}><Plus size={14}/> New theme</button>
          </div>
          {!activeTheme ? <div className="ls-center-empty"><div className="ls-empty-icon"><Layers3 size={22}/></div><h2>Start by creating a research theme</h2><p>Group project publications around a question or recurring topic. Themes and source assignments are saved automatically.</p><button className="ls-button primary" onClick={addTheme}><Plus size={15}/> Create a theme</button></div> : <>
            <div className="ls-theme-heading">
              <div className="ls-theme-title-row"><span className="ls-theme-index">{String(activeThemeIndex + 1).padStart(2, '0')}</span><h2>{activeTheme.title}</h2><button className="ls-icon-button" type="button" aria-label="Rename theme" title="Rename theme" disabled={saveState === 'conflict'} onClick={() => renameTheme(activeTheme)}><FileText size={14}/></button>
                <button className="ls-icon-button" type="button" aria-label="Move theme up" disabled={activeThemeIndex <= 0 || saveState === 'conflict'} onClick={() => moveTheme(activeThemeIndex, -1)}><ArrowUp size={14}/></button><button className="ls-icon-button" type="button" aria-label="Move theme down" disabled={activeThemeIndex >= document.themes.length - 1 || saveState === 'conflict'} onClick={() => moveTheme(activeThemeIndex, 1)}><ArrowDown size={14}/></button>
                <button className="ls-icon-button danger" type="button" aria-label="Remove theme" disabled={saveState === 'conflict'} onClick={() => removeTheme(activeTheme)}><Trash2 size={14}/></button>
              </div>
              <textarea aria-label="Theme description" className="ls-theme-description" placeholder="Describe the question or idea that defines this theme…" value={activeTheme.description} readOnly={saveState === 'conflict'} onChange={(event) => updateDocument((current) => ({ ...current, themes: current.themes.map((theme) => theme.id === activeTheme.id ? { ...theme, description: event.target.value.slice(0, 2000) } : theme) }))}/>
              <div className="ls-theme-controls">
                <span><BookOpen size={14}/>{activeThemePapers.length} supporting publication{activeThemePapers.length === 1 ? '' : 's'}</span>
                {document.themes.length > 1 && <div className="ls-merge-control"><select aria-label="Merge theme into" disabled={saveState === 'conflict'} value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)}><option value="">Merge into…</option>{document.themes.filter((theme) => theme.id !== activeTheme.id).map((theme) => <option value={theme.id} key={theme.id}>{theme.title}</option>)}</select><button className="ls-text-button" disabled={!mergeTarget || saveState === 'conflict'} onClick={mergeTheme}><Merge size={13}/> Merge</button></div>}
              </div>
            </div>
            {activeThemePapers.length < 2 && <div className="ls-inline-hint"><FileSearch size={15}/><span>Add at least two selected publications to this theme from the source library to enable cross-paper analysis.</span></div>}
            {analysesForTheme.length ? <div className="ls-approved-analyses"><div className="ls-section-heading"><div><span className="ls-kicker">RESEARCHER-APPROVED</span><h3>Evidence and analysis</h3></div><span>{analysesForTheme.length} saved</span></div>{analysesForTheme.map((analysis) => <AnalysisCard key={analysis.id} analysis={analysis} disabled={saveState === 'conflict'} onDelete={() => deleteAnalysis(analysis)}/>)}</div> : <div className="ls-theme-empty"><span className="ls-empty-icon"><Sparkles size={18}/></span><div><h3>No approved analysis yet</h3><p>Run a research assistant action. You can inspect its evidence before deciding whether to save it to this theme.</p></div></div>}
            <div className="ls-notes"><label htmlFor="ls-research-notes"><strong>Researcher notes</strong><span>Private to this project · autosaved</span></label><textarea id="ls-research-notes" value={document.notes} maxLength={30000} readOnly={saveState === 'conflict'} onChange={(event) => updateDocument((current) => ({ ...current, notes: event.target.value }))} placeholder="Record your own observations, questions, or cautions about this literature…"/></div>
          </>}
          {document.analyses.some((analysis) => !document.themes.some((theme) => theme.id === analysis.themeId)) && <div className="ls-approved-analyses"><div className="ls-section-heading"><div><span className="ls-kicker">PRESERVED WITHOUT A THEME</span><h3>Unassigned approved analyses</h3></div></div>{document.analyses.filter((analysis) => !document.themes.some((theme) => theme.id === analysis.themeId)).map((analysis) => <AnalysisCard key={analysis.id} analysis={analysis} disabled={saveState === 'conflict'} onDelete={() => deleteAnalysis(analysis)}/>)}</div>}
        </div>
      </main>

      {!rightCollapsed && <aside className="ls-panel ls-assistant-panel" aria-label="AI research assistant and evidence inspector">
        <div className="ls-panel-head"><div><span className="ls-kicker">GEMINI · SOURCE-GROUNDED</span><h2>Research assistant</h2></div><button type="button" className="ls-icon-button ls-collapse-button" aria-label="Collapse research assistant" onClick={() => setRightCollapsed(true)}><PanelRightClose size={16}/></button></div>
        <div className="ls-assistant-intro"><Sparkles size={16}/><p>Analysis is a proposal until you verify its evidence and choose <strong>Save conclusion</strong>.</p></div>
        <div className="ls-assistant-actions">{actions.map((action) => {
          const Icon = action.Icon;
          const disabled = !activeTheme || activeThemePapers.length < 2 || Boolean(generating) || saveState === 'conflict';
          return <button type="button" className="ls-action-button" key={action.id} disabled={disabled} onClick={() => void generateAnalysis(action)}><span className="ls-action-icon">{generating === action.id ? <LoaderCircle className="ls-spin" size={16}/> : <Icon size={16}/>}</span><span>{generating === action.id ? 'Analyzing sources…' : action.label}</span><ChevronRight size={14}/></button>;
        })}</div>
        {aiError && <div className="ls-ai-error" role="alert">{aiError}</div>}
        {candidate && <div className="ls-candidate" aria-live="polite">
          <div className="ls-candidate-head"><div><span className="ls-kicker">UNSAVED AI SUGGESTION</span><h3>{candidate.analysis.title}</h3></div><button className="ls-icon-button" aria-label="Reject suggestion" onClick={() => { setCandidate(null); setAiError(''); }}><X size={15}/></button></div>
          <span className="ls-interpretation-label">AI-generated interpretation · confidence {candidate.analysis.confidence}</span>
          <p className="ls-candidate-summary">{candidate.analysis.summary}</p>
          {candidate.analysis.sections.map((section, index) => <div className="ls-candidate-section" key={`${section.heading}-${index}`}><strong>{section.heading}</strong><p>{section.content}</p></div>)}
          <div className="ls-candidate-evidence"><strong>Supporting source evidence</strong>{candidate.analysis.evidence.map((item, index) => <EvidenceBlock evidence={item} key={`${item.paperId}-${index}`}/>)}
            {candidate.unmatched.map((item, index) => <blockquote className="ls-evidence unverified" key={`unmatched-${index}`}><span>Could not verify in saved source text</span><q>{item.quote}</q><small>{item.claim} · {item.sourceLocation || 'Not explicitly stated in the source'}</small></blockquote>)}
            {!candidate.analysis.evidence.length && <p>No exact supporting passage could be verified. This suggestion cannot be saved as a supported conclusion.</p>}
          </div>
          {!!candidate.analysis.limitations.length && <p className="ls-candidate-limits"><strong>Analysis limitations: </strong>{candidate.analysis.limitations.join(' ')}</p>}
          <div className="ls-candidate-actions"><button className="ls-button primary" disabled={!candidate.analysis.evidence.length || !!candidate.unmatched.length || saveState === 'conflict'} onClick={approveCandidate}><Check size={14}/> Save conclusion</button><button className="ls-button secondary" disabled={Boolean(generating)} onClick={() => { const action = actions.find((item) => item.id === candidate.analysis.kind); if (action) void generateAnalysis(action); }}><Sparkles size={13}/> Regenerate</button><button className="ls-button secondary" onClick={() => { setCandidate(null); setAiError(''); }}>Reject</button></div>
          <small className="ls-candidate-foot">Nothing is added to your review until you save this conclusion. Source quotations are kept linked to their publication.</small>
        </div>}
        {!candidate && !aiError && !activeTheme && <div className="ls-assistant-empty"><Sparkles size={20}/><p>Create a theme to start evidence-grounded analysis.</p></div>}
        {!candidate && !aiError && activeTheme && activeThemePapers.length < 2 && <div className="ls-assistant-empty"><BookOpen size={20}/><p>Select and assign at least two publications with source text to this theme.</p></div>}
        {document.analyses.length > 0 && <div className="ls-provenance-note"><LockKeyhole size={13}/><span>Approved conclusions stay with their source references. Missing page or section details are shown as unavailable.</span></div>}
      </aside>}
      {themeDialog && <div className="ls-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setThemeDialog(null); }}>
        <form className="ls-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-theme-dialog-title" onSubmit={saveThemeName} onKeyDown={(event) => { if (event.key === 'Escape') setThemeDialog(null); }}>
          <div className="ls-dialog-heading"><div><span className="ls-kicker">RESEARCH ORGANIZATION</span><h2 id="ls-theme-dialog-title">{themeDialog.mode === 'create' ? 'Create a research theme' : 'Rename research theme'}</h2></div><button type="button" className="ls-icon-button" aria-label="Close dialog" onClick={() => setThemeDialog(null)}><X size={16}/></button></div>
          <label className="ls-dialog-label" htmlFor="ls-theme-name">Theme name</label>
          <input id="ls-theme-name" autoFocus maxLength={120} value={themeDialog.value} onChange={(event) => { setThemeDialog({ ...themeDialog, value: event.target.value }); setThemeDialogError(''); }} placeholder="e.g. Evaluation methods" aria-describedby={themeDialogError ? 'ls-theme-dialog-error' : undefined}/>
          {themeDialogError && <p className="ls-dialog-error" id="ls-theme-dialog-error" role="alert">{themeDialogError}</p>}
          <div className="ls-dialog-actions"><button type="button" className="ls-button secondary" onClick={() => setThemeDialog(null)}>Cancel</button><button type="submit" className="ls-button primary">{themeDialog.mode === 'create' ? 'Create theme' : 'Save name'}</button></div>
        </form>
      </div>}
      {confirmDialog && <div className="ls-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDialog(null); }}>
        <div className="ls-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ls-confirm-title" aria-describedby="ls-confirm-message">
          <div className="ls-dialog-heading"><div><span className="ls-kicker">CONFIRM ACTION</span><h2 id="ls-confirm-title">{confirmDialog.title}</h2></div><button type="button" className="ls-icon-button" aria-label="Close dialog" onClick={() => setConfirmDialog(null)}><X size={16}/></button></div>
          <p className="ls-dialog-message" id="ls-confirm-message">{confirmDialog.message}</p>
          <div className="ls-dialog-actions"><button type="button" className="ls-button secondary" onClick={() => setConfirmDialog(null)}>Cancel</button><button type="button" className="ls-button primary" onClick={() => { const confirm = confirmDialog.onConfirm; setConfirmDialog(null); confirm(); }}>{confirmDialog.confirmLabel}</button></div>
        </div>
      </div>}
      {!leftCollapsed || !rightCollapsed ? <button className="ls-mobile-backdrop" aria-label="Close open panel" onClick={() => { setLeftCollapsed(true); setRightCollapsed(true); }}/> : null}
    </section>
  );
}

function renderSource(
  paper: SourcePaper,
  document: ReviewDocument,
  activeTheme: SynthesisTheme | undefined,
  linkedPaperIds: Set<string>,
  savingConflict: boolean,
  toggleSource: (id: string) => void,
  toggleThemeSource: (id: string) => void,
  onOpenPaper: (paper: SourcePaper) => void,
) {
  const id = String(paper._id);
  const selected = document.selectedPaperIds.includes(id);
  const assigned = Boolean(activeTheme?.paperIds.includes(id));
  const locked = selected && linkedPaperIds.has(id);
  const providerIds = [
    paper.externalId && `${paper.source || 'Provider'} ${paper.externalId}`,
    paper.identifiers?.openAlexId && `OpenAlex ${paper.identifiers.openAlexId}`,
    paper.identifiers?.semanticScholarId && `Semantic Scholar ${paper.identifiers.semanticScholarId}`,
    paper.identifiers?.arxivId && `arXiv ${paper.identifiers.arxivId}`,
    paper.identifiers?.pmid && `PMID ${paper.identifiers.pmid}`,
  ].filter(Boolean) as string[];
  return <article className={`ls-source-card ${selected ? 'selected' : ''}`} key={id}>
    <div className="ls-source-card-top"><label className="ls-source-select" title={locked ? 'Used by an approved analysis; remove that analysis first to deselect this source.' : 'Include source in this literature review'}><input type="checkbox" checked={selected} disabled={locked || savingConflict} onChange={() => toggleSource(id)}/><span className="ls-checkbox"/><span className="ls-sr-only">Include {paper.title} in this review</span></label><button className="ls-source-title" onClick={() => onOpenPaper(paper)}>{paper.title}</button></div>
    <p className="ls-source-authors">{paperAuthorYear(paper)}</p>
    <div className="ls-source-pills">{paper.doi && <span>DOI</span>}{paper.fileName && <span>PDF</span>}{<span className={paper.metadataStatus ? `metadata-${paper.metadataStatus}` : 'muted'}>{paper.metadataStatus ? paper.metadataStatus.replaceAll('_', ' ') : 'Metadata not checked'}</span>}{!paper.fileName && <span className="muted">No PDF</span>}</div>
    <div className="ls-source-identifiers">{paper.doi ? <small>{paper.doi}</small> : <small>DOI not available</small>}{paper.metadataProvider && <small>{paper.metadataProvider}</small>}{providerIds.length > 0 && <small title={providerIds.join(' · ')}>{providerIds.length} provider ID{providerIds.length === 1 ? '' : 's'}</small>}</div>
    <div className="ls-source-card-foot"><span>{paper.extractedText ? 'Extracted text available' : paper.abstract ? 'Abstract available' : 'No source text'}</span>{selected && activeTheme && <button type="button" className={`ls-add-to-theme ${assigned ? 'assigned' : ''}`} aria-pressed={assigned} disabled={savingConflict} onClick={() => toggleThemeSource(id)} title={assigned ? 'Remove source from active theme' : 'Add source to active theme'}>{assigned ? <Check size={12}/> : <Plus size={12}/>} {assigned ? 'In theme' : 'Add to theme'}</button>}</div>
  </article>;
}

function EvidenceBlock({ evidence }: { evidence: SynthesisEvidence }) {
  const authors = evidence.authors.length ? evidence.authors.join(', ') : 'Authors not available';
  return <blockquote className="ls-evidence"><q>{evidence.quote}</q><small>{evidence.claim}</small><span><strong>{evidence.paperTitle}</strong><br/>{authors} · {evidence.year || 'Year unavailable'} · {evidence.doi || 'DOI unavailable'}<br/>{evidence.sourceDocument || 'Saved source text'} · {evidence.sourceLocation || 'Not explicitly stated in the source'}</span></blockquote>;
}

function AnalysisCard({ analysis, disabled, onDelete }: { analysis: SynthesisAnalysis; disabled?: boolean; onDelete: () => void }) {
  return <article className="ls-analysis-card">
    <div className="ls-analysis-heading"><div><span className="ls-interpretation-label">RESEARCHER-APPROVED · AI-GENERATED INTERPRETATION</span><h4>{analysis.title}</h4></div><button className="ls-icon-button danger" aria-label={`Remove ${analysis.title}`} disabled={disabled} onClick={onDelete}><Trash2 size={14}/></button></div>
    <p className="ls-analysis-summary">{analysis.summary}</p>
    {analysis.sections.map((section, index) => <div className="ls-analysis-section" key={`${section.heading}-${index}`}><strong>{section.heading}</strong><p>{section.content}</p></div>)}
    {analysis.evidence.length > 0 && <div className="ls-analysis-evidence"><strong>Source evidence · {analysis.evidence.length}</strong>{analysis.evidence.map((evidence, index) => <EvidenceBlock evidence={evidence} key={`${evidence.paperId}-${index}`}/>)}</div>}
    {analysis.recommendations.length > 0 && <div className="ls-recommendations"><strong>Potential directions · review before use</strong><ul>{analysis.recommendations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>}
    {analysis.limitations.length > 0 && <p className="ls-analysis-limits"><strong>AI analysis limitations: </strong>{analysis.limitations.join(' ')}</p>}
    <div className="ls-analysis-meta">Based on {analysis.sourcePaperIds.length} source{analysis.sourcePaperIds.length === 1 ? '' : 's'} · {new Date(analysis.createdAt).toLocaleString()}</div>
  </article>;
}
