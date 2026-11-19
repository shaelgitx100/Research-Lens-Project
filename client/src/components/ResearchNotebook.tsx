import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bold, Check, Clock3, Download, FileText, Heading2, Italic, List, Printer, Quote, Sparkles } from 'lucide-react';
import type { LiteratureSynthesisHandoff, SynthesisAnalysis } from './literatureSynthesisTypes';

type NotebookSection = { id: string; title: string; content: string };
type Notebook = {
  sections: NotebookSection[];
  citationStyle: 'APA' | 'MLA' | 'Chicago';
  version: number;
  updatedAt?: string;
};
type NotebookPaper = {
  _id?: string;
  projectId?: string;
  title: string;
  authors?: string[];
  publicationYear?: number;
  venue?: string;
  doi?: string;
  publicationUrl?: string;
  abstract?: string;
  extractedText?: string;
};
type Props = {
  project: { _id: string; title: string; topic?: string; description?: string };
  papers: NotebookPaper[];
  headers: Record<string, string>;
  onDiscover: () => void;
  synthesisHandoff?: LiteratureSynthesisHandoff | null;
  onSynthesisHandoffConsumed?: () => void;
};
type ApiFailure = Error & { status?: number; payload?: any };

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
  if (!text.trim()) throw new Error('The server returned an empty notebook response.');
  return payload as T;
}

function surname(author?: string) {
  if (!author?.trim()) return 'Author unavailable';
  const value = author.trim();
  if (value.includes(',')) return value.split(',')[0].trim();
  return value.split(/\s+/).filter(Boolean).at(-1) || value;
}

function inTextCitation(paper: NotebookPaper, style: Notebook['citationStyle']) {
  const author = surname(paper.authors?.[0]);
  const year = paper.publicationYear || 'n.d.';
  if (style === 'MLA') return `(${author})`;
  if (style === 'Chicago') return `(${author} ${year})`;
  return `(${author}, ${year})`;
}

function bibliographyEntry(paper: NotebookPaper, style: Notebook['citationStyle']) {
  const authors = paper.authors?.length ? paper.authors.join(', ') : 'Author unavailable';
  const year = paper.publicationYear || 'n.d.';
  const venue = paper.venue ? ` ${paper.venue}.` : '';
  const identifier = paper.doi ? ` https://doi.org/${paper.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : paper.publicationUrl ? ` ${paper.publicationUrl}` : '';
  if (style === 'MLA') return `${authors}. "${paper.title}."${venue} ${paper.publicationYear || 'n.d.'}.${identifier}`.trim();
  if (style === 'Chicago') return `${authors}. "${paper.title}."${venue} ${year}.${identifier}`.trim();
  return `${authors} (${year}). ${paper.title}.${venue}${identifier}`.trim();
}

function safeSourceUrl(paper: NotebookPaper) {
  const value = paper.publicationUrl || (paper.doi ? `https://doi.org/${paper.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export default function ResearchNotebook({ project, papers, headers, onDiscover, synthesisHandoff, onSynthesisHandoffConsumed }: Props) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [activeSectionId, setActiveSectionId] = useState('title-abstract');
  const [status, setStatus] = useState<'loading' | 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [aiDraft, setAiDraft] = useState<{ text: string; evidence: { claim: string; quote: string; sourceLocation: string }[]; limitations: string[] } | null>(null);
  const [aiError, setAiError] = useState('');
  const [handoffNotice, setHandoffNotice] = useState('');
  const [pendingHandoff, setPendingHandoff] = useState<LiteratureSynthesisHandoff | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const processedHandoffRef = useRef('');
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const authorization = headers.Authorization;
  const workspaceId = headers['X-Workspace-Id'];
  const requestHeaders = useMemo(() => ({
    Authorization: authorization,
    ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
  }), [authorization, workspaceId]);
  const projectId = project._id;
  const sourcePapers = papers.filter((paper) => String(paper.projectId) === projectId);
  const usableSources = sourcePapers.filter((paper) => (paper.extractedText || paper.abstract || '').trim().length >= 80);
  const activeSection = notebook?.sections.find((section) => section.id === activeSectionId) || notebook?.sections[0];
  const totalWords = notebook?.sections.reduce((total, section) => total + wordCount(section.content), 0) || 0;

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    setNotebook(null);
    setAiDraft(null);
    setActiveSectionId('title-abstract');
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/notebook`, { headers: requestHeaders })
      .then(readResponse<Notebook>)
      .then((data) => {
        if (!active) return;
        setNotebook(data);
        setActiveSectionId(data.sections[0]?.id || 'title-abstract');
        setStatus('saved');
      })
      .catch((cause: Error) => {
        if (!active) return;
        setError(cause.message || 'Could not load this research notebook.');
        setStatus('error');
      });
    return () => { active = false; };
  }, [projectId, requestHeaders, loadAttempt]);

  useEffect(() => {
    if (!notebook || status === 'loading' || status === 'conflict' || revisionRef.current <= savedRevisionRef.current) return;
    if (saveInFlightRef.current) return;
    const snapshot = notebook;
    const revision = revisionRef.current;
    const timer = window.setTimeout(async () => {
      saveInFlightRef.current = true;
      let saveSucceeded = false;
      setStatus('saving');
      setError('');
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/notebook`, {
          method: 'PUT',
          headers: { ...requestHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: snapshot.version, citationStyle: snapshot.citationStyle, sections: snapshot.sections }),
        });
        const saved = await readResponse<Notebook>(response);
        saveSucceeded = true;
        savedRevisionRef.current = revision;
        setNotebook((current) => current ? { ...current, version: saved.version, updatedAt: saved.updatedAt } : current);
        setStatus(revisionRef.current === revision ? 'saved' : 'unsaved');
      } catch (cause) {
        const failure = cause as ApiFailure;
        setError(failure.message || 'Could not save your notebook.');
        setStatus(failure.status === 409 ? 'conflict' : 'error');
      } finally {
        saveInFlightRef.current = false;
        if (saveSucceeded && revisionRef.current > savedRevisionRef.current) setRetry((value) => value + 1);
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [notebook, projectId, requestHeaders, retry, status]);

  const updateNotebook = (update: (current: Notebook) => Notebook) => {
    if (status === 'conflict') return;
    revisionRef.current += 1;
    setStatus('unsaved');
    setNotebook((current) => current ? update(current) : current);
  };
  useEffect(() => {
    if (!notebook || !synthesisHandoff || synthesisHandoff.projectId !== projectId
      || processedHandoffRef.current === synthesisHandoff.id) return;
    if (status === 'conflict') {
      processedHandoffRef.current = synthesisHandoff.id;
      setHandoffNotice('Resolve the notebook version conflict before transferring literature synthesis. Your synthesis remains saved in Literature Review.');
      onSynthesisHandoffConsumed?.();
      return;
    }
    processedHandoffRef.current = synthesisHandoff.id;
    setPendingHandoff(synthesisHandoff);
  }, [notebook, synthesisHandoff, projectId, onSynthesisHandoffConsumed, status]);

  const transferSynthesis = () => {
    if (!notebook || !pendingHandoff) return;
    if (status === 'conflict') {
      setHandoffNotice('Resolve the notebook version conflict before transferring literature synthesis. Your synthesis remains saved in Literature Review.');
      setPendingHandoff(null);
      onSynthesisHandoffConsumed?.();
      return;
    }
    const sourceById = new Map(pendingHandoff.sources.map((source) => [source.id, source]));
    const citationFor = (paperId: string, title: string) => {
      const source = sourceById.get(paperId);
      if (!source) return title;
      const notebookPaper: NotebookPaper = {
        title: source.title,
        authors: source.authors,
        publicationYear: source.year,
      };
      return `${source.title} ${inTextCitation(notebookPaper, notebook.citationStyle)}`;
    };
    const formatAnalysis = (analysis: SynthesisAnalysis) => [
      `### ${analysis.title}`,
      `AI-generated interpretation (researcher-approved; verify before publication): ${analysis.summary}`,
      ...analysis.sections.map((section) => `${section.heading}\n${section.content}`),
      ...(analysis.evidence.length ? [
        'Source evidence (quoted passages preserved):',
        ...analysis.evidence.map((item) => {
          const sourceDocument = sourceById.get(item.paperId)?.sourceDocument || 'Saved source text';
          return `> “${item.quote}”\n> — ${citationFor(item.paperId, item.paperTitle)}; source document: ${sourceDocument}; ${item.sourceLocation || 'Not explicitly stated in the source'}`;
        }),
      ] : []),
      ...(analysis.limitations.length ? [`AI analysis limitations: ${analysis.limitations.join(' ')}`] : []),
    ].join('\n\n');

    const themesText = pendingHandoff.themes.map((theme) => {
      const sources = theme.paperIds.map((id) => sourceById.get(id)).filter(Boolean);
      return [
        `### ${theme.title}`,
        theme.description || 'Theme description not provided.',
        ...(sources.length ? [`Supporting publications: ${sources.map((source) => citationFor(source!.id, source!.title)).join('; ')}`] : []),
      ].join('\n');
    }).join('\n\n');
    const analyses = pendingHandoff.analyses;
    const thematic = analyses.filter((item) => ['thematic-synthesis', 'research-trends'].includes(item.kind));
    const methods = analyses.filter((item) => item.kind === 'methodology-patterns');
    const discussion = analyses.filter((item) => ['findings-comparison', 'contradictions'].includes(item.kind));
    const limitations = analyses.filter((item) => item.kind === 'limitations');
    const gaps = analyses.filter((item) => item.kind === 'research-gaps');
    const additions: Record<string, string> = {
      background: [themesText, ...thematic.map(formatAnalysis)].filter(Boolean).join('\n\n'),
      methodology: methods.map(formatAnalysis).join('\n\n'),
      discussion: [
        ...discussion.map(formatAnalysis),
        pendingHandoff.notes.trim() ? `### Researcher notes\n${pendingHandoff.notes.trim()}` : '',
      ].filter(Boolean).join('\n\n'),
      limitations: limitations.map(formatAnalysis).join('\n\n'),
      'problem-statement': gaps.map(formatAnalysis).join('\n\n'),
    };
    const nextSections = notebook.sections.map((section) => {
      const addition = additions[section.id];
      return addition ? { ...section, content: [section.content.trim(), addition].filter(Boolean).join('\n\n') } : section;
    });
    const tooLarge = nextSections.find((section) => section.content.length > 50000);
    if (tooLarge) {
      setHandoffNotice(`The transfer would exceed the 50,000-character limit for “${tooLarge.title}”. The synthesis remains saved in Literature Review; shorten that notebook section and try again.`);
      setPendingHandoff(null);
      onSynthesisHandoffConsumed?.();
      return;
    }
    updateNotebook((current) => ({ ...current, sections: nextSections }));
    setActiveSectionId('background');
    setHandoffNotice('Literature synthesis appended to the Academic Editor. Existing notebook content was preserved.');
    setPendingHandoff(null);
    onSynthesisHandoffConsumed?.();
  };
  const cancelSynthesisTransfer = () => {
    setPendingHandoff(null);
    onSynthesisHandoffConsumed?.();
  };
  const updateSection = (sectionId: string, content: string) => {
    updateNotebook((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? { ...section, content } : section),
    }));
    setAiDraft(null);
  };
  const currentContent = activeSection?.content || '';
  const insertAtCursor = (value: string) => {
    if (!activeSection || activeSection.id === 'references' || status === 'conflict') return;
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? currentContent.length;
    const end = editor?.selectionEnd ?? start;
    const next = currentContent.slice(0, start) + value + currentContent.slice(end);
    updateSection(activeSection.id, next);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      const position = start + value.length;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(position, position);
    });
  };
  const wrapSelection = (before: string, after = before) => {
    if (status === 'conflict') return;
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? currentContent.length;
    const end = editor?.selectionEnd ?? start;
    const selected = currentContent.slice(start, end) || 'text';
    const wrapped = `${before}${selected}${after}`;
    const next = currentContent.slice(0, start) + wrapped + currentContent.slice(end);
    if (activeSection) updateSection(activeSection.id, next);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const addCitation = (paper: NotebookPaper) => {
    if (!activeSection || activeSection.id === 'references' || status === 'conflict') return;
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? currentContent.length;
    const end = editor?.selectionEnd ?? start;
    const prefix = start > 0 && !/\s$/.test(currentContent.slice(0, start)) ? ' ' : '';
    const citation = `${prefix}${inTextCitation(paper, notebook?.citationStyle || 'APA')} `;
    insertAtCursor(citation);
  };
  const changeCitationStyle = (citationStyle: Notebook['citationStyle']) => {
    updateNotebook((current) => ({ ...current, citationStyle }));
  };
  const requestAiDraft = async () => {
    if (!activeSection || !usableSources.length) return;
    setGenerating(true);
    setAiError('');
    setAiDraft(null);
    const feature = activeSection.id === 'methodology' ? 'methodology' : activeSection.id === 'background' ? 'literature-review' : 'research-proposal';
    try {
      const response = await fetch(`/api/ai/features/${feature}`, {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          question: `Draft only the "${activeSection.title}" section for the research paper "${project.title}". Use only the supplied project publications as evidence. Do not invent findings, facts, citations, or references. Cite only supplied sources by their supplied author and year; mark missing information as not reported. Clearly label proposed work as a proposal.`,
        }),
      });
      const payload = await readResponse<any>(response);
      const result = payload.result?.result;
      if (!result) throw new Error('The writing service returned no draft.');
      const text = [result.summary, ...(result.sections || []).map((section: any) => `${section.heading}\n${section.content}`)]
        .filter(Boolean).join('\n\n');
      setAiDraft({ text, evidence: result.evidence || [], limitations: result.limitations || [] });
    } catch (cause: any) {
      setAiError(cause.message || 'Could not draft this section.');
    } finally {
      setGenerating(false);
    }
  };
  const insertAiDraft = () => {
    if (!aiDraft || !activeSection || activeSection.id === 'references') return;
    const separator = currentContent.trim() ? '\n\n' : '';
    updateSection(activeSection.id, `${currentContent}${separator}${aiDraft.text}`);
    setAiDraft(null);
  };
  const reloadLatest = () => {
    if (status === 'conflict') setConfirmReload(true);
  };
  const loadLatest = async () => {
    setConfirmReload(false);
    setStatus('loading');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/notebook`, { headers: requestHeaders });
      const data = await readResponse<Notebook>(response);
      setNotebook(data);
      setActiveSectionId(data.sections[0]?.id || 'title-abstract');
      revisionRef.current = 0;
      savedRevisionRef.current = 0;
      setError('');
      setStatus('saved');
    } catch (cause: any) {
      setError(cause.message || 'Could not reload the latest notebook.');
      setStatus('error');
    }
  };
  const exportMarkdown = () => {
    if (!notebook) return;
    const content = [
      `# ${project.title}`,
      project.topic ? `\n${project.topic}` : '',
      ...notebook.sections.filter((section) => section.id !== 'references')
        .map((section) => `\n## ${section.title}\n\n${section.content || '_Not drafted yet._'}`),
      '\n## References',
      ...(sourcePapers.length ? sourcePapers.map((paper) => `\n- ${bibliographyEntry(paper, notebook.citationStyle)}`) : ['\n_No project sources saved._']),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'research-paper'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const statusLabel = status === 'loading' ? 'Loading notebook' : status === 'saving' ? 'Saving changes' : status === 'unsaved' ? 'Unsaved changes' : status === 'error' ? 'Save needs attention' : status === 'conflict' ? 'Version conflict' : 'All changes saved';

  if (status === 'loading' && !notebook) return <div className="notebook-loading" role="status"><span className="loader-spinner"/> Opening your project notebook…</div>;
  if (!notebook) return <section className="panel notebook-load-error"><h2>Notebook unavailable</h2><p>{error}</p><button className="button secondary" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</button></section>;

  return <section className="research-notebook-page" aria-label={`${project.title} research notebook`}>
    <div className="notebook-topbar">
      <div className="notebook-document-label"><span className="notebook-document-icon"><FileText size={17}/></span><div><strong>Research paper notebook</strong><small>{project.title}</small></div></div>
      <div className="notebook-topbar-actions">
        <span className={`notebook-save-state ${status}`} role="status">{status === 'saved' ? <Check size={14}/> : status === 'saving' || status === 'unsaved' ? <Clock3 size={14}/> : <span className="notebook-status-dot"/>}{statusLabel}</span>
        <button type="button" className="button secondary notebook-tool-button" onClick={exportMarkdown}><Download size={15}/> Export .md</button>
        <button type="button" className="button secondary notebook-tool-button" onClick={() => window.print()}><Printer size={15}/> Print / PDF</button>
      </div>
    </div>
    {error && <div className={`notebook-notice ${status === 'conflict' ? 'warning' : 'error'}`} role="alert"><span>{error}</span>{status === 'conflict' ? <button className="button secondary" onClick={() => void reloadLatest()}>Reload latest</button> : status === 'error' && <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>Retry save</button>}</div>}
    {handoffNotice && <div className="notebook-notice" role="status">{handoffNotice}</div>}
    {pendingHandoff && <div className="notebook-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelSynthesisTransfer(); }}>
      <div className="notebook-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="notebook-transfer-title" aria-describedby="notebook-transfer-description">
        <h2 id="notebook-transfer-title">Continue in Academic Editor?</h2>
        <p id="notebook-transfer-description">Append {pendingHandoff.themes.length} research theme(s), {pendingHandoff.analyses.length} approved analysis/analyses, source evidence, and researcher notes to this notebook? Existing text will be preserved.</p>
        <div><button type="button" className="button secondary" onClick={cancelSynthesisTransfer}>Cancel</button><button type="button" className="button primary" disabled={status === 'conflict'} onClick={transferSynthesis}>Append synthesis</button></div>
      </div>
    </div>}
    {confirmReload && <div className="notebook-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmReload(false); }}>
      <div className="notebook-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="notebook-reload-title" aria-describedby="notebook-reload-description">
        <h2 id="notebook-reload-title">Reload the latest notebook?</h2>
        <p id="notebook-reload-description">Your local unsaved edits will be discarded and replaced with the latest saved version.</p>
        <div><button type="button" className="button secondary" onClick={() => setConfirmReload(false)}>Cancel</button><button type="button" className="button primary" onClick={() => void loadLatest()}>Reload notebook</button></div>
      </div>
    </div>}
    <div className="notebook-layout">
      <nav className="notebook-outline" aria-label="Paper sections">
        <div className="notebook-panel-heading"><span>MANUSCRIPT</span><strong>Paper outline</strong></div>
        <div className="notebook-outline-items">{notebook.sections.map((section, index) => <button key={section.id} type="button" className={`notebook-outline-item ${section.id === activeSection?.id ? 'active' : ''}`} aria-current={section.id === activeSection?.id ? 'page' : undefined} onClick={() => { setActiveSectionId(section.id); setAiDraft(null); }}><span className="notebook-outline-number">{String(index + 1).padStart(2, '0')}</span><span>{section.title}</span></button>)}</div>
        <div className="notebook-outline-footer"><BookOpen size={15}/><span>Evidence-led writing<br/><small>Sources stay tied to this project</small></span></div>
      </nav>
      <div className="notebook-paper-column">
        <div className="notebook-page-meta"><span>WHITE PAPER · WORKING DRAFT</span><span>{totalWords.toLocaleString()} words</span></div>
        <article className="notebook-paper">
          <div className="notebook-paper-brand"><span>RESEARCHLENS</span><span>PROJECT NOTEBOOK</span></div>
          <h1>{project.title}</h1>
          {project.topic && <p className="notebook-paper-topic">{project.topic}</p>}
          <div className="notebook-paper-rule"/>
          <header className="notebook-section-heading"><div><span>SECTION {String(notebook.sections.findIndex((section) => section.id === activeSection?.id) + 1).padStart(2, '0')} / {String(notebook.sections.length).padStart(2, '0')}</span><h2>{activeSection?.title}</h2></div><label className="notebook-citation-style">Citation style<select aria-label="Citation style" value={notebook.citationStyle} disabled={status === 'conflict'} onChange={(event) => changeCitationStyle(event.target.value as Notebook['citationStyle'])}><option>APA</option><option>MLA</option><option>Chicago</option></select></label></header>
          {activeSection?.id === 'references' ? <div className="notebook-bibliography" aria-label="Project bibliography">{sourcePapers.length ? sourcePapers.map((paper, index) => <div className="notebook-reference" key={paper._id || `${paper.title}-${index}`}><span className="notebook-reference-number">[{index + 1}]</span><p>{bibliographyEntry(paper, notebook.citationStyle)}</p>{safeSourceUrl(paper) && <a href={safeSourceUrl(paper)} target="_blank" rel="noreferrer">Open source</a>}</div>) : <div className="notebook-empty-references"><BookOpen size={20}/><p>No sources are linked to this project yet.</p><button type="button" className="button secondary" onClick={onDiscover}>Find and add literature</button></div>}</div> : <>
            <div className="notebook-editor-toolbar" role="toolbar" aria-label="Markdown formatting">
              <button type="button" aria-label="Bold selected text" title="Bold" disabled={status === 'conflict'} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('**')}><Bold size={15}/></button>
              <button type="button" aria-label="Italicize selected text" title="Italic" disabled={status === 'conflict'} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('*')}><Italic size={15}/></button>
              <button type="button" aria-label="Add a heading" title="Heading" disabled={status === 'conflict'} onMouseDown={(event) => event.preventDefault()} onClick={() => insertAtCursor('\n## ')}><Heading2 size={16}/></button>
              <button type="button" aria-label="Add a list item" title="List item" disabled={status === 'conflict'} onMouseDown={(event) => event.preventDefault()} onClick={() => insertAtCursor('\n- ')}><List size={16}/></button>
              <span className="notebook-toolbar-divider"/>
              <button type="button" className="notebook-ai-button" onClick={() => void requestAiDraft()} disabled={generating || usableSources.length === 0 || status === 'conflict'} title={usableSources.length ? 'Draft a source-grounded section for review' : 'Add source text to this project to enable AI drafting'}><Sparkles size={14}/>{generating ? 'Drafting…' : 'Draft with AI'}</button>
            </div>
            <label className="notebook-editor-label" htmlFor="notebook-section-editor">{activeSection?.title} draft</label>
            <textarea id="notebook-section-editor" ref={editorRef} className="notebook-editor" value={currentContent} onChange={(event) => activeSection && updateSection(activeSection.id, event.target.value)} placeholder={`Begin drafting ${activeSection?.title.toLowerCase()}…\n\nBuild claims from your saved sources and mark any remaining questions.`} readOnly={status === 'conflict'} spellCheck/>
            <div className="notebook-editor-footer"><span>{wordCount(currentContent).toLocaleString()} words in this section</span><span>Autosaves as you write</span></div>
            {aiError && <div className="notebook-ai-error" role="alert">{aiError}</div>}
            {aiDraft && <div className="notebook-ai-preview"><div className="notebook-ai-preview-heading"><div><Sparkles size={15}/><strong>AI draft · review before adding</strong></div><button type="button" className="notebook-dismiss" aria-label="Dismiss AI draft" onClick={() => setAiDraft(null)}>×</button></div><p className="notebook-ai-provenance">Generated using {usableSources.length} project publication{usableSources.length === 1 ? '' : 's'} with source text. Verify every claim before publication.</p><pre>{aiDraft.text}</pre>{aiDraft.evidence.length > 0 && <div className="notebook-ai-evidence"><strong>Source evidence supplied</strong>{aiDraft.evidence.map((item, index) => <blockquote key={`${item.sourceLocation}-${index}`}><q>{item.quote}</q><small>{item.claim} · {item.sourceLocation}</small></blockquote>)}</div>}{aiDraft.limitations.length > 0 && <p className="notebook-ai-limitations"><strong>Limitations:</strong> {aiDraft.limitations.join(' ')}</p>}<button type="button" className="button primary" onClick={insertAiDraft}>Add draft to section</button></div>}
          </>}
        </article>
        <div className="notebook-paper-caption"><span>{project.description || 'A structured space for developing a research paper from your project evidence.'}</span><span>{notebook.updatedAt ? `Last saved ${new Date(notebook.updatedAt).toLocaleString()}` : 'New notebook'}</span></div>
      </div>
      <aside className="notebook-sources" aria-label="Project sources and writing tools">
        <div className="notebook-panel-heading"><span>VERIFIED PROJECT MATERIAL</span><strong>Sources &amp; citations</strong></div>
        <div className="notebook-source-summary"><span>{sourcePapers.length}</span><div><strong>Project papers</strong><small>{usableSources.length} with abstract or extracted text</small></div></div>
        {sourcePapers.length ? <div className="notebook-source-list">{sourcePapers.map((paper, index) => <article className="notebook-source-card" key={paper._id || `${paper.title}-${index}`}><div className="notebook-source-card-title"><span>{String(index + 1).padStart(2, '0')}</span><strong>{paper.title}</strong></div><p>{paper.authors?.join(', ') || 'Authors unavailable'} · {paper.publicationYear || 'Year unavailable'}</p><div className="notebook-source-card-actions"><button type="button" className="button secondary" disabled={!activeSection || activeSection.id === 'references' || status === 'conflict'} onClick={() => addCitation(paper)}><Quote size={13}/> Insert citation</button>{safeSourceUrl(paper) && <a href={safeSourceUrl(paper)} target="_blank" rel="noreferrer">Source</a>}</div></article>)}</div> : <div className="notebook-sources-empty"><p>Link papers to this project to build a traceable bibliography and enable evidence-led AI drafting.</p><button type="button" className="button secondary" onClick={onDiscover}>Discover literature</button></div>}
        <div className="notebook-pro-tools"><div className="notebook-panel-heading"><span>PRO TOOLS</span><strong>Writing tools</strong></div><div className="notebook-tool-stat"><span>Document length</span><strong>{totalWords.toLocaleString()} words</strong></div><div className="notebook-tool-stat"><span>Citation format</span><strong>{notebook.citationStyle}</strong></div><button type="button" className="notebook-tool-link" onClick={exportMarkdown}><Download size={14}/> Export manuscript</button><button type="button" className="notebook-tool-link" onClick={() => window.print()}><Printer size={14}/> Print-ready view</button></div>
      </aside>
    </div>
    <article className="notebook-print-document">
      <h1>{project.title}</h1>
      {project.topic && <p>{project.topic}</p>}
      {notebook.sections.filter((section) => section.id !== 'references').map((section) => <section key={section.id}><h2>{section.title}</h2><p>{section.content || 'Not drafted yet.'}</p></section>)}
      <section><h2>References</h2>{sourcePapers.length ? sourcePapers.map((paper, index) => <p className="notebook-print-reference" key={paper._id || `${paper.title}-${index}`}>{bibliographyEntry(paper, notebook.citationStyle)}</p>) : <p>No project sources saved.</p>}</section>
    </article>
  </section>;
}
