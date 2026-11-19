import { useEffect, useMemo, useState } from 'react';
import {
  Archive, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Clock3, Copy, Download,
  Eye, FileBarChart2, FileCode2, FileText, Filter, FlaskConical, Layers3, MoreHorizontal,
  Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { Paragraph as DocxParagraph, Table as DocxTable } from 'docx';
import { Markdown } from '../utils/markdown';
import './ReportsCenter.css';

type ReportType = 'project' | 'literature-review' | 'gap-assessment' | 'bibliometric' | 'methodology' | 'findings';
type ReportStatus = 'Draft' | 'Generating' | 'Completed' | 'Failed' | 'Archived';
type ReportDepth = 'executive' | 'standard' | 'comprehensive';
type ReportFormat = 'html' | 'pdf' | 'docx';
type ModuleKey = 'paper-summary' | 'methodology' | 'literature-review' | 'research-gap' | 'research-questions' | 'citation-analysis' | 'literature-comparison';

interface ReportSource {
  paperId?: string;
  title?: string;
  citation?: string;
  doi?: string;
  publicationUrl?: string;
  source?: string;
  externalId?: string;
  publicationYear?: number;
  evidenceType?: string;
  authors?: string[];
  venue?: string;
  identifiers?: Record<string, string>;
}

interface ReportProvenance {
  sourcePaperIds?: string[];
  papers?: ReportSource[];
  generation?: { provider?: string; model?: string; generatedAt?: string };
  storedGaps?: unknown[];
  storedQuestions?: unknown[];
  project?: { title?: string };
}

interface ResearchReport {
  _id: string;
  projectId?: string;
  title: string;
  type?: ReportType;
  status?: ReportStatus;
  reportContent?: string;
  references?: (string | ReportSource)[];
  sources?: ReportProvenance;
  sourcePaperIds?: string[];
  paperIds?: string[];
  modules?: ModuleKey[];
  depth?: ReportDepth;
  scope?: string;
  citationStyle?: string;
  language?: string;
  format?: ReportFormat;
  error?: string;
  failure?: { message?: string; failedAt?: string } | string;
  generatedAt?: string;
  generationStartedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: { revision?: number; savedAt?: string; title?: string }[];
  versions?: { savedAt?: string; title?: string; reportContent?: string }[];
  version?: number;
}

interface ResearchPaper {
  _id?: string;
  title: string;
  authors?: string[];
  publicationYear?: number;
  year?: number;
  venue?: string;
  doi?: string;
  publicationUrl?: string;
  source?: string;
  externalId?: string;
  citationCount?: number;
  referenceCount?: number;
  abstract?: string;
  projectId?: string;
}

interface Props {
  headers: Record<string, string>;
  projects: any[];
  papers: ResearchPaper[];
  gaps: any[];
  questions: any[];
  reports: ResearchReport[];
  onReportsChange: (reports: ResearchReport[]) => void;
  onNotify: (message: string) => void;
  onContinueInEditor: (project: any) => void;
}

const reportTypes: { id: ReportType; title: string; detail: string; icon: typeof FileText }[] = [
  { id: 'project', title: 'Research project report', detail: 'Consolidate project objectives, evidence, methods, and findings.', icon: FlaskConical },
  { id: 'literature-review', title: 'Literature review report', detail: 'Synthesize patterns across selected publications.', icon: BookOpen },
  { id: 'gap-assessment', title: 'Research gap assessment', detail: 'Assess candidate gaps against the saved evidence.', icon: TriangleAlert },
  { id: 'bibliometric', title: 'Bibliometric & citation analysis', detail: 'Summarize stored citation and publication metadata.', icon: FileBarChart2 },
  { id: 'methodology', title: 'Research methodology assessment', detail: 'Compare methods reported in analyzed publications.', icon: Layers3 },
  { id: 'findings', title: 'Research findings & analysis', detail: 'Bring source-derived findings and limitations together.', icon: ShieldCheck },
];

const reportModules: { id: ModuleKey; label: string; detail: string }[] = [
  { id: 'paper-summary', label: 'Stored paper analyses', detail: 'Findings, methods, and limitations saved for selected papers' },
  { id: 'methodology', label: 'Methodology analysis', detail: 'Methods and datasets reported in saved paper analyses' },
  { id: 'research-gap', label: 'Research-gap discoveries', detail: 'Saved gap assessments and their supporting publications' },
  { id: 'research-questions', label: 'Research questions', detail: 'Questions saved in this project' },
  { id: 'citation-analysis', label: 'Citation analysis', detail: 'Citation and reference metadata already stored in ResearchLens' },
  { id: 'literature-comparison', label: 'Literature comparisons', detail: 'Previously saved comparisons, when available' },
  { id: 'literature-review', label: 'Saved literature synthesis', detail: 'Existing synthesis results, if present for this project' },
];

const outlines: Record<ReportType, string[]> = {
  project: ['Cover', 'Executive Summary', 'Background', 'Objectives', 'Literature Overview', 'Methodology', 'Findings', 'Comparative Analysis', 'Limitations', 'Gaps', 'Conclusions', 'Recommendations', 'References', 'Appendix'],
  'literature-review': ['Review Scope', 'Literature Overview', 'Thematic Synthesis', 'Methodological Patterns', 'Comparative Analysis', 'Limitations', 'Research Gaps', 'Conclusions', 'References'],
  'gap-assessment': ['Assessment Scope', 'Stored Research Gaps', 'Evidence Coverage', 'Unanswered Questions', 'Evidence Limitations', 'Research Priorities', 'References'],
  bibliometric: ['Analysis Scope', 'Available Citation Metadata', 'Publication and Citation Patterns', 'Evidence Limitations', 'Conclusions', 'References', 'Appendix'],
  methodology: ['Project Context', 'Methods Reported in Selected Publications', 'Cross-Study Comparison', 'Methodological Limitations', 'Unreported Method Details', 'Recommendations', 'References'],
  findings: ['Findings Overview', 'Source-Reported Findings', 'Cross-Study Comparison', 'Interpretation', 'Evidence Gaps', 'Limitations', 'Conclusions', 'References'],
};

const stepNames = ['Report type', 'Project & sources', 'Analysis', 'Output', 'Review'];
const normalizeStatus = (status?: string): ReportStatus => {
  const known: ReportStatus[] = ['Draft', 'Generating', 'Completed', 'Failed', 'Archived'];
  return known.find((item) => item.toLowerCase() === status?.toLowerCase()) || 'Draft';
};
const generationIsStale = (report: ResearchReport) => {
  if (normalizeStatus(report.status) !== 'Generating') return false;
  if (!report.generationStartedAt) return true;
  const startedAt = new Date(report.generationStartedAt).getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt >= 10 * 60 * 1000;
};
const typeTitle = (type?: string) => reportTypes.find((item) => item.id === type)?.title || 'Research report';
const paperId = (paper: ResearchPaper) => String(paper._id || '');
const paperYear = (paper: ResearchPaper) => paper.publicationYear || paper.year;
const humanDate = (date?: string) => date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not available';
const storedSources = (report: ResearchReport): ReportSource[] => report.references?.length
  ? report.references.map((reference) => typeof reference === 'string' ? { citation: reference } : reference)
  : report.sources?.papers || [];

async function requestJson<T>(path: string, headers: Record<string, string>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = await response.text();
  let data: any;
  try { data = body ? JSON.parse(body) : undefined; } catch { throw new Error(`The server returned an invalid response (${response.status}).`); }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data as T;
}

async function loadReportLibrary(headers: Record<string, string>): Promise<ResearchReport[]> {
  const firstPage = await requestJson<{ items?: ResearchReport[]; total?: number }>('/reports?page=1&limit=100', headers);
  const items = [...(firstPage.items || [])];
  const pageCount = Math.ceil(Math.max(firstPage.total || 0, items.length) / 100);
  for (let firstPageNumber = 2; firstPageNumber <= pageCount; firstPageNumber += 5) {
    const pageNumbers = Array.from({ length: Math.min(5, pageCount - firstPageNumber + 1) }, (_, index) => firstPageNumber + index);
    const pages = await Promise.all(pageNumbers.map((pageNumber) =>
      requestJson<{ items?: ResearchReport[] }>(`/reports?page=${pageNumber}&limit=100`, headers),
    ));
    items.push(...pages.flatMap((page) => page.items || []));
  }
  return items;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}

function inlineHtml(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (/^\|.*\|$/.test(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) tableLines.push(lines[index++].trim());
      const rows = tableLines.filter((row) => !/^\|[\s:|-]+\|$/.test(row)).map((row) => row.slice(1, -1).split('|').map((cell) => cell.trim()));
      if (rows.length) {
        html.push(`<table><tbody>${rows.map((row, rowIndex) => `<tr>${row.map((cell) => rowIndex === 0 ? `<th>${inlineHtml(cell)}</th>` : `<td>${inlineHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      }
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 4) + 1;
      html.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(inlineHtml(lines[index++].replace(/^\s*>\s?/, '')));
      html.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(`<li>${inlineHtml(lines[index++].replace(/^\s*[-*]\s+/, ''))}</li>`);
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) items.push(`<li>${inlineHtml(lines[index++].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    html.push(`<p>${inlineHtml(line)}</p>`);
    index += 1;
  }
  return html.join('\n');
}

function exportHtml(report: ResearchReport, projectName: string) {
  const content = markdownToHtml(report.reportContent || 'This report has no generated content.');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(report.title)}</title><style>
    @page{size:A4;margin:22mm}*{box-sizing:border-box}body{max-width:820px;margin:48px auto;padding:0 28px;color:#182638;font:15px/1.75 Georgia,'Times New Roman',serif}
    header{margin-bottom:38px;padding-bottom:18px;border-bottom:1px solid #d5dee8}header p{margin:5px 0;color:#5d7186;font:12px/1.5 Arial,sans-serif}
    h1,h2,h3,h4{color:#102d4b;font-family:Arial,sans-serif;line-height:1.3}h2{margin-top:30px;padding-bottom:8px;border-bottom:1px solid #d5dee8;font-size:20px}h3{margin-top:22px;font-size:16px}
    p,li{orphans:3;widows:3}blockquote{margin:16px 0;padding:10px 16px;border-left:3px solid #2f86a8;background:#f1f7fa;color:#34546a}
    table{width:100%;margin:16px 0;border-collapse:collapse;font:12px/1.5 Arial,sans-serif}td,th{padding:9px;border:1px solid #d5dee8;text-align:left;vertical-align:top}th{background:#edf4f8;color:#183b59}
    a{color:#146b91}code{padding:2px 4px;background:#edf2f6;font-size:.9em}.sources{margin-top:36px;padding-top:16px;border-top:1px solid #d5dee8;font:12px/1.55 Arial,sans-serif}
    @media print{body{margin:0;padding:0}}
  </style></head><body><header><p>RESEARCHLENS · ${escapeHtml(typeTitle(report.type).toUpperCase())}</p><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(projectName)} · Generated ${escapeHtml(humanDate(report.generatedAt || report.createdAt))}</p><p>Citations and evidence are retained from saved ResearchLens sources.</p></header><main>${content}</main><footer class="sources"><strong>ResearchLens evidence record</strong><p>${storedSources(report).map((source) => escapeHtml(source.citation || source.title || 'Source metadata unavailable.')).join('<br>')}</p></footer></body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openPrintView(report: ResearchReport, projectName: string) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups to open the report print view.');
  const html = await exportHtml(report, projectName).text();
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.addEventListener('load', () => {
    popup.print();
  }, { once: true });
}

async function markdownParagraphs(markdown: string): Promise<(DocxParagraph | DocxTable)[]> {
  const { AlignmentType, BorderStyle, HeadingLevel, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  const paragraphs: (DocxParagraph | DocxTable)[] = [];
  const rows = markdown.split(/\r?\n/);
  const plain = (value: string) => value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  for (let index = 0; index < rows.length;) {
    const line = rows[index].trim();
    if (!line) { index += 1; continue; }
    if (/^\|.*\|$/.test(line)) {
      const tableLines: string[] = [];
      while (index < rows.length && /^\s*\|.*\|\s*$/.test(rows[index])) tableLines.push(rows[index++].trim());
      const tableRows = tableLines.filter((row) => !/^\|[\s:|-]+\|$/.test(row)).map((row, rowIndex) =>
        new TableRow({ children: row.slice(1, -1).split('|').map((cell) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: plain(cell.trim()), bold: rowIndex === 0, color: rowIndex === 0 ? '173A59' : '26384A' })] })],
          shading: rowIndex === 0 ? { fill: 'EAF2F7' } : undefined,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
        })) }),
      );
      if (tableRows.length) {
        paragraphs.push(new Paragraph({ children: [] }));
        paragraphs.push(new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'D5DEE8' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D5DEE8' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D5DEE8' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D5DEE8' },
          },
        }));
        paragraphs.push(new Paragraph({ children: [] }));
      }
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      paragraphs.push(new Paragraph({ text: plain(heading[2]), heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 } }));
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const bullet = /^\s*[-*]\s+/.test(line);
      paragraphs.push(new Paragraph({ text: plain(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')), bullet: bullet ? { level: 0 } : undefined, numbering: !bullet ? { reference: 'report-numbering', level: 0 } : undefined, spacing: { after: 70 } }));
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      paragraphs.push(new Paragraph({ text: plain(line.replace(/^>\s?/, '')), indent: { left: 360 }, border: { left: { color: '3184A5', style: BorderStyle.SINGLE, size: 12, space: 8 } }, spacing: { before: 100, after: 120 } }));
      index += 1;
      continue;
    }
    paragraphs.push(new Paragraph({ text: plain(line), spacing: { after: 90 }, alignment: AlignmentType.JUSTIFIED }));
    index += 1;
  }
  return paragraphs;
}

async function exportDocx(report: ResearchReport, projectName: string) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph } = await import('docx');
  const doc = new Document({
    title: report.title,
    creator: 'ResearchLens',
    description: 'Evidence-aware research report generated from saved ResearchLens sources.',
    numbering: { config: [{ reference: 'report-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 260 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: [
        new Paragraph({ text: 'RESEARCHLENS · RESEARCH REPORT', style: 'Subtitle', spacing: { after: 180 } }),
        new Paragraph({ text: report.title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }),
        new Paragraph({ text: `${projectName} · ${typeTitle(report.type)} · ${humanDate(report.generatedAt || report.createdAt)}`, spacing: { after: 300 } }),
        ...await markdownParagraphs(report.reportContent || 'This report has no generated content.'),
        new Paragraph({ text: 'Evidence sources', heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { before: 240, after: 100 } }),
        ...(storedSources(report).map((source) => new Paragraph({ text: source.citation || source.title || 'Source metadata unavailable.', bullet: { level: 0 }, spacing: { after: 80 } }))),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

export default function ReportsCenter({ headers, projects, papers, gaps, questions, reports, onReportsChange, onNotify, onContinueInEditor }: Props) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [page, setPage] = useState(1);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [reportType, setReportType] = useState<ReportType>('project');
  const [projectId, setProjectId] = useState('');
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [modules, setModules] = useState<ModuleKey[]>(['paper-summary', 'research-gap', 'research-questions', 'citation-analysis']);
  const [depth, setDepth] = useState<ReportDepth>('standard');
  const [scope, setScope] = useState('');
  const [citationStyle, setCitationStyle] = useState('APA');
  const [language, setLanguage] = useState('English');
  const [format, setFormat] = useState<ReportFormat>('html');
  const [reportTitle, setReportTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [renameId, setRenameId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [actionId, setActionId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [sourcePreviewExpanded, setSourcePreviewExpanded] = useState(false);
  const [analysisPreviewCount, setAnalysisPreviewCount] = useState(0);
  const [analysisPreviewError, setAnalysisPreviewError] = useState('');
  const [analysisPreviewLoading, setAnalysisPreviewLoading] = useState(false);
  const headerKey = JSON.stringify(headers);

  const selectedProject = projects.find((project) => String(project._id) === projectId);
  const draftTitle = (reportTitle.trim() || `${typeTitle(reportType)} — ${selectedProject?.title || 'Research project'}`).slice(0, 160);
  const projectPapers = papers.filter((paper) => String(paper.projectId || '') === projectId);
  const selectedPapers = projectPapers.filter((paper) => selectedPaperIds.includes(paperId(paper)));
  const projectGaps = gaps.filter((gap) => !gap.projectId || String(gap.projectId) === projectId);
  const projectQuestions = questions.filter((question) => !question.projectId || String(question.projectId) === projectId);
  const selectedReportProject = projects.find((project) => String(project._id) === String(selectedReport?.projectId || ''));
  const reportPaperIds = selectedReport?.sourcePaperIds || selectedReport?.paperIds || selectedReport?.sources?.sourcePaperIds || [];
  const reportSources = selectedReport?.sources?.papers || [];
  const availablePapers = useMemo(() => papers.filter((paper) => paper._id), [papers]);
  const sortedReports = useMemo(() => {
    const filtered = reports.filter((report) => {
      const matchesProject = projectFilter === 'all' || String(report.projectId || '') === projectFilter;
      const matchesStatus = statusFilter === 'all' || normalizeStatus(report.status) === statusFilter;
      const matchesType = typeFilter === 'all' || (report.type || 'project') === typeFilter;
      const matchesSearch = `${report.title} ${typeTitle(report.type)} ${projects.find((item) => String(item._id) === String(report.projectId))?.title || ''}`.toLowerCase().includes(search.trim().toLowerCase());
      return matchesProject && matchesStatus && matchesType && matchesSearch;
    });
    return filtered.sort((a, b) => sortOrder === 'title' ? a.title.localeCompare(b.title) :
      sortOrder === 'oldest' ? new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime() :
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }, [reports, projectFilter, statusFilter, typeFilter, search, sortOrder, projects]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(sortedReports.length / pageSize));
  const visibleReports = sortedReports.slice((page - 1) * pageSize, page * pageSize);
  const scopedReports = projectFilter === 'all' ? reports : reports.filter((report) => String(report.projectId || '') === projectFilter);
  const completedCount = scopedReports.filter((report) => normalizeStatus(report.status) === 'Completed').length;
  const inProgressCount = scopedReports.filter((report) => normalizeStatus(report.status) === 'Generating').length;
  const draftCount = scopedReports.filter((report) => normalizeStatus(report.status) === 'Draft').length;

  useEffect(() => { setPage(1); }, [projectFilter, statusFilter, typeFilter, search, sortOrder]);

  useEffect(() => {
    let active = true;
    setReportsLoaded(false);
    loadReportLibrary(headers)
      .then((items) => { if (active) onReportsChange(items); })
      .catch((cause: Error) => { if (active) setError(`Could not load reports: ${cause.message}`); })
      .finally(() => { if (active) setReportsLoaded(true); });
    return () => { active = false; };
  }, [headerKey]);

  useEffect(() => {
    if (!selectedReportId) { setSelectedReport(null); return; }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    requestJson<ResearchReport>(`/reports/${encodeURIComponent(selectedReportId)}`, headers)
      .then((report) => { if (active) setSelectedReport(report); })
      .catch((cause: Error) => { if (active) setDetailError(cause.message); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedReportId, headerKey]);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => setGenerationStep((current) => (current + 1) % 4), 2600);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    if (!showWizard || wizardStep !== 1 || !selectedPaperIds.length) {
      setAnalysisPreviewCount(0);
      setAnalysisPreviewError('');
      setAnalysisPreviewLoading(false);
      return;
    }
    let active = true;
    setAnalysisPreviewLoading(true);
    setAnalysisPreviewError('');
    Promise.all(selectedPaperIds.map((id) =>
      requestJson<{ items?: any[] }>(`/papers/${encodeURIComponent(id)}/analysis`, headers),
    )).then((results) => {
      if (active) setAnalysisPreviewCount(results.filter((result) => (result.items || []).length > 0).length);
    }).catch((cause: Error) => {
      if (active) setAnalysisPreviewError(`Stored analysis preview is unavailable: ${cause.message}`);
    }).finally(() => { if (active) setAnalysisPreviewLoading(false); });
    return () => { active = false; };
  }, [showWizard, wizardStep, selectedPaperIds.join('|'), headerKey]);

  const refreshReports = async () => {
    onReportsChange(await loadReportLibrary(headers));
  };

  const openWizard = () => {
    setWizardStep(0);
    setError('');
    setReportTitle('');
    const nextProjectId = projectFilter === 'all' ? String(projects[0]?._id || '') : projectFilter;
    setProjectId(nextProjectId);
    setSelectedPaperIds(papers.filter((paper) => String(paper.projectId || '') === nextProjectId).map(paperId).filter(Boolean));
    setShowWizard(true);
    setSourcePreviewExpanded(false);
  };

  const selectProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setSelectedPaperIds(papers.filter((paper) => String(paper.projectId || '') === nextProjectId).map(paperId).filter(Boolean));
    setError('');
  };

  const togglePaper = (id: string) => setSelectedPaperIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleModule = (id: ModuleKey) => setModules((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const updateReport = async (id: string, patch: Record<string, unknown>, success: string) => {
    setBusyAction(id);
    setError('');
    try {
      await requestJson(`/reports/${encodeURIComponent(id)}`, headers, { method: 'PATCH', body: JSON.stringify(patch) });
      await refreshReports();
      onNotify(success);
      if (selectedReportId === id) {
        const updated = await requestJson<ResearchReport>(`/reports/${encodeURIComponent(id)}`, headers);
        setSelectedReport(updated);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this report.');
    } finally { setBusyAction(''); setActionId(''); }
  };

  const generateExisting = async (report: ResearchReport) => {
    setBusyAction(report._id);
    setError('');
    try {
      const updated = await requestJson<ResearchReport>(`/reports/${encodeURIComponent(report._id)}/generate`, headers, { method: 'POST', body: JSON.stringify({}) });
      await refreshReports();
      setSelectedReport(updated);
      setSelectedReportId(report._id);
      onNotify('Report generated and saved.');
    } catch (cause) {
      await refreshReports().catch(() => undefined);
      const latest = await requestJson<ResearchReport>(`/reports/${encodeURIComponent(report._id)}`, headers).catch(() => null);
      if (latest) setSelectedReport(latest);
      setError(cause instanceof Error ? cause.message : 'Could not generate the report.');
    } finally { setBusyAction(''); }
  };

  const createAndGenerate = async () => {
    if (!projectId || selectedPaperIds.length === 0) { setError('Select a research project with at least one saved publication.'); return; }
    let createdId = '';
    setGenerating(true);
    setError('');
    try {
      const draft = await requestJson<ResearchReport>('/reports', headers, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title: draftTitle,
          type: reportType,
          paperIds: selectedPaperIds,
          modules,
          depth,
          scope: scope.trim() || undefined,
          citationStyle,
          language,
          format,
        }),
      });
      createdId = draft._id;
      await refreshReports();
      const completed = await requestJson<ResearchReport>(`/reports/${encodeURIComponent(draft._id)}/generate`, headers, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshReports();
      setSelectedReport(completed);
      setSelectedReportId(draft._id);
      setShowWizard(false);
      onNotify('Evidence-backed report generated.');
    } catch (cause) {
      await refreshReports().catch(() => undefined);
      const message = cause instanceof Error ? cause.message : 'Report generation failed. Your saved sources have not been changed.';
      if (createdId) {
        setShowWizard(false);
        setSelectedReport(null);
        setSelectedReportId(createdId);
        setError(message);
      } else {
        setError(message);
      }
    } finally { setGenerating(false); setGenerationStep(0); }
  };

  const duplicateReport = async (report: ResearchReport) => {
    setBusyAction(report._id);
    try {
      await requestJson(`/reports/${encodeURIComponent(report._id)}/duplicate`, headers, { method: 'POST', body: JSON.stringify({}) });
      await refreshReports();
      onNotify('Draft copy created.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not duplicate the report.'); }
    finally { setBusyAction(''); setActionId(''); }
  };

  const deleteReport = async () => {
    if (!deleteId) return;
    setBusyAction(deleteId);
    try {
      await requestJson(`/reports/${encodeURIComponent(deleteId)}`, headers, { method: 'DELETE' });
      onReportsChange(reports.filter((report) => report._id !== deleteId));
      if (selectedReportId === deleteId) { setSelectedReportId(''); setSelectedReport(null); }
      onNotify('Report deleted.');
      setDeleteId('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete the report.'); }
    finally { setBusyAction(''); }
  };

  const exportReport = async (report: ResearchReport, exportFormat: ReportFormat) => {
    const projectName = projects.find((project) => String(project._id) === String(report.projectId))?.title || 'Research project';
    setError('');
    try {
      if (exportFormat === 'html') {
        downloadBlob(exportHtml(report, projectName), `${report.title.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'research-report'}.html`);
      } else if (exportFormat === 'pdf') {
        await openPrintView(report, projectName);
      } else {
        const blob = await exportDocx(report, projectName);
        downloadBlob(blob, `${report.title.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'research-report'}.docx`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export this report.'); }
  };

  const saveRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    await updateReport(renameId, { title: renameValue.trim() }, 'Report renamed.');
    setRenameId('');
  };

  const reportPapers = availablePapers.filter((paper) => reportPaperIds.includes(paperId(paper)));
  const savedReferenceRows: ReportSource[] = (selectedReport?.references || []).map((reference: string | ReportSource) => typeof reference === 'string' ? ({ citation: reference }) : reference);
  const sourceRows: ReportSource[] = reportSources.length ? reportSources : savedReferenceRows.concat(reportPapers.map((paper) => ({
    paperId: paperId(paper),
    title: paper.title,
    citation: `${paper.authors?.join(', ') || 'Author metadata unavailable'} (${paperYear(paper) || 'Year not stored'}). ${paper.title}.${paper.venue ? ` ${paper.venue}.` : ''}`,
    doi: paper.doi,
    source: paper.source,
    externalId: paper.externalId,
    publicationYear: paperYear(paper),
  })));
  const sourceRef = (reference: string | ReportSource) => typeof reference === 'string' ? reference : reference.citation || reference.title || 'Reference metadata unavailable.';
  const generationSteps = ['Checking the saved project sources', 'Drafting evidence-linked report sections', 'Validating source references', 'Saving report and version details'];

  const renderReportCard = (report: ResearchReport) => {
    const project = projects.find((item) => String(item._id) === String(report.projectId));
    const status = normalizeStatus(report.status);
    const count = (report.sourcePaperIds || report.paperIds || report.sources?.sourcePaperIds || []).length || (report.references || []).length;
    return <article className="report-row" key={report._id}>
      <button className="report-row-main" onClick={() => { setSelectedReportId(report._id); setActionId(''); }} aria-label={`Open ${report.title}`}>
        <span className="report-row-icon"><FileText size={17}/></span>
        <span className="report-row-copy">
          <strong>{report.title}</strong>
          <span className="report-row-meta">{typeTitle(report.type)} <i/> {project?.title || 'Project unavailable'} <i/> {count} {count === 1 ? 'publication' : 'publications'}</span>
          <span className="report-row-meta">Created {humanDate(report.createdAt)} <i/> Updated {humanDate(report.updatedAt || report.generatedAt || report.createdAt)}</span>
        </span>
      </button>
      <span className={`report-status status-${status.toLowerCase()}`}><i/>{status}</span>
      <div className="report-row-actions">
        <button type="button" className="report-open-button" onClick={() => { setSelectedReportId(report._id); setActionId(''); }}><Eye size={14}/> Open</button>
        <div className="report-action-anchor">
          <button type="button" className="report-icon-button" aria-label={`${report.title} actions`} aria-expanded={actionId === report._id} onClick={() => setActionId((current) => current === report._id ? '' : report._id)}><MoreHorizontal size={17}/></button>
          {actionId === report._id && <div className="report-action-menu">
            <button type="button" onClick={() => { setRenameId(report._id); setRenameValue(report.title); setActionId(''); }}><Pencil size={14}/> Rename</button>
            <button type="button" disabled={busyAction === report._id} onClick={() => void duplicateReport(report)}><Copy size={14}/> Duplicate draft</button>
            {status !== 'Archived' && (status !== 'Generating' || generationIsStale(report)) && <button type="button" disabled={busyAction === report._id} onClick={() => void generateExisting(report)}><Sparkles size={14}/>{status === 'Generating' ? 'Recover generation' : 'Regenerate'}</button>}
            <button type="button" onClick={() => { setSelectedReportId(report._id); setActionId(''); }}><Download size={14}/> Export…</button>
            <button type="button" onClick={() => void updateReport(report._id, { status: status === 'Archived' ? 'Draft' : 'Archived' }, status === 'Archived' ? 'Report restored.' : 'Report archived.')}><Archive size={14}/>{status === 'Archived' ? 'Restore' : 'Archive'}</button>
            <button type="button" className="danger" onClick={() => { setDeleteId(report._id); setActionId(''); }}><Trash2 size={14}/> Delete</button>
          </div>}
        </div>
      </div>
    </article>;
  };

  if (selectedReportId) {
    const report = selectedReport || reports.find((item) => item._id === selectedReportId);
    const status = normalizeStatus(report?.status);
    const references = report?.references || [];
    return <section className="reports-center">
      <header className="report-detail-toolbar">
        <button type="button" className="report-back-button" onClick={() => { setSelectedReportId(''); setSelectedReport(null); setDetailError(''); }}><ArrowLeft size={15}/> All reports</button>
        <div className="report-detail-actions">
          {report && status !== 'Generating' && <button type="button" className="report-secondary-button" onClick={() => void exportReport(report, 'html')}><FileCode2 size={15}/> HTML</button>}
          {report && status !== 'Generating' && <button type="button" className="report-secondary-button" onClick={() => void exportReport(report, 'docx')}><FileText size={15}/> DOCX</button>}
          {report && status !== 'Generating' && <button type="button" className="report-primary-button" onClick={() => void exportReport(report, 'pdf')}><Download size={15}/> Print / Save PDF</button>}
          {report && selectedReportProject && <button type="button" className="report-secondary-button" onClick={() => onContinueInEditor(selectedReportProject)}><Pencil size={15}/> Continue in academic editor</button>}
        </div>
      </header>
      {detailError && <div className="report-alert" role="alert">{detailError}<button onClick={() => setSelectedReportId(selectedReportId)}>Retry</button></div>}
      {detailLoading && <div className="report-detail-skeleton"><span/><span/><span/><span/></div>}
      {report && !detailLoading && <div className="report-detail-layout">
        <article className="report-document">
          <div className="report-document-kicker">RESEARCHLENS · {typeTitle(report.type).toUpperCase()}</div>
          <div className="report-document-heading"><div><h1>{report.title}</h1><p>{selectedReportProject?.title || 'Project unavailable'} · Generated {humanDate(report.generatedAt || report.createdAt)}</p></div><span className={`report-status status-${status.toLowerCase()}`}><i/>{status}</span></div>
          {status === 'Generating' && <div className="report-generating-inline"><span className="report-spinner"/><span>{generationIsStale(report) ? 'This generation appears interrupted.' : 'Report generation is in progress. Reopen this report to check its status.'}</span>{generationIsStale(report) && <button type="button" className="report-secondary-button" onClick={() => void generateExisting(report)}>Recover generation</button>}</div>}
          {status === 'Failed' && <div className="report-alert" role="alert">{(typeof report.failure === 'string' ? report.failure : report.failure?.message) || report.error || 'Generation failed. Check the selected sources and try again.'}<button type="button" onClick={() => void generateExisting(report)}>Retry generation</button></div>}
          {report.reportContent ? <div className="report-content"><Markdown source={report.reportContent}/></div> : status !== 'Generating' && <div className="report-empty-content"><FileText size={24}/><h2>No report content yet</h2><p>Generate this report from the saved evidence to create its sections and references.</p>{status !== 'Archived' && <button type="button" className="report-primary-button" onClick={() => void generateExisting(report)}><Sparkles size={15}/> Generate report</button>}</div>}
          {references.length > 0 && <section className="report-reference-list"><h2>References</h2><ol>{references.map((reference, index) => <li key={`${index}-${typeof reference === 'string' ? reference : reference.paperId || reference.title || ''}`}>{sourceRef(reference)}</li>)}</ol></section>}
          <footer className="report-document-footer">Evidence links and references are limited to saved ResearchLens sources. Interpretations are AI-generated and should be reviewed by a researcher.</footer>
        </article>
        <aside className="report-evidence-sidebar">
          <div className="report-side-card"><span className="report-side-kicker">REPORT DETAILS</span><dl>
            <div><dt>Type</dt><dd>{typeTitle(report.type)}</dd></div>
            <div><dt>Project</dt><dd>{selectedReportProject?.title || 'Project unavailable'}</dd></div>
            <div><dt>Status</dt><dd><span className={`report-status status-${status.toLowerCase()}`}><i/>{status}</span></dd></div>
            <div><dt>Depth</dt><dd>{report.depth || 'Standard'}</dd></div>
            <div><dt>Citation style</dt><dd>{report.citationStyle || 'APA'}</dd></div>
            <div><dt>Output language</dt><dd>{report.language || 'English'}</dd></div>
            <div><dt>Created</dt><dd>{humanDate(report.createdAt)}</dd></div>
            <div><dt>Last updated</dt><dd>{humanDate(report.updatedAt || report.generatedAt)}</dd></div>
          </dl></div>
          <div className="report-side-card"><span className="report-side-kicker">SOURCE PUBLICATIONS · {reportPaperIds.length}</span>
            {sourceRows.length ? <ul className="report-source-list">{sourceRows.map((source, index) => <li key={`${index}-${source.paperId || source.title}`}><strong>{source.title || source.citation || 'Publication metadata unavailable'}</strong><span>{[source.publicationYear, source.source, source.externalId && `ID ${source.externalId}`, source.doi && `DOI ${source.doi}`].filter(Boolean).join(' · ') || 'Source metadata not stored'}</span></li>)}</ul> : <p className="report-muted">No publication references are attached to this report.</p>}
          </div>
          <div className="report-side-card"><span className="report-side-kicker">GENERATION HISTORY</span>{report.versions?.length ? <ul className="report-history-list">{report.versions.map((version, index) => <li key={`${index}-${version.savedAt || ''}`}><span>{version.title || `Version ${index + 1}`}</span><time>{humanDate(version.savedAt)}</time></li>)}</ul> : <p className="report-muted">{report.sources?.generation?.model ? `Generated with ${report.sources.generation.provider || 'AI'} · ${report.sources.generation.model}` : 'No previous versions have been saved.'}</p>}</div>
          <div className="report-integrity-note"><ShieldCheck size={16}/><p>ResearchLens preserves saved source identifiers and marks AI-generated interpretation for researcher review.</p></div>
        </aside>
      </div>}
      {error && <div className="report-alert" role="alert">{error}</div>}
    </section>;
  }

  return <section className="reports-center">
    <header className="reports-page-header">
      <div><div className="reports-kicker"><span/> RESEARCH INTELLIGENCE · REPORT CENTER</div><h1>Research Reports</h1><p>Transform your research evidence and insights into structured, professional reports.</p></div>
      <div className="reports-header-controls">
        <label className="report-project-picker"><span>RESEARCH PROJECT</span><select aria-label="Filter reports by research project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All projects</option>{projects.map((project) => <option key={project._id} value={String(project._id)}>{project.title}</option>)}</select><ChevronDown size={14}/></label>
        <button type="button" className="report-primary-button" onClick={openWizard}><Plus size={16}/> Create New Report</button>
      </div>
    </header>
    <div className="report-stat-grid" aria-label="Report statistics">
      {[['Total reports', scopedReports.length, 'Across this workspace', FileBarChart2], ['Completed reports', completedCount, 'Ready to review or export', Check], ['Reports in progress', inProgressCount, 'Generation underway', Clock3], ['Draft reports', draftCount, 'Ready for configuration', FileText]].map(([label, value, caption, Icon]: any) =>
        <article className="report-stat" key={label}><span className="report-stat-icon"><Icon size={16}/></span><strong>{value}</strong><span>{label}</span><small>{caption}</small></article>,
      )}
    </div>
    <section className="report-creation-banner">
      <div className="report-banner-mark"><Sparkles size={18}/></div>
      <div><span className="report-side-kicker">FROM RESEARCH TO EVIDENCE</span><h2>Bring your saved research together.</h2><p>Build structured reports from project publications, stored analyses, literature comparisons, citation data, and research-gap assessments. References are kept traceable to your saved sources.</p></div>
      <button type="button" className="report-primary-button" onClick={openWizard}>Configure a report <ArrowRight size={15}/></button>
    </section>
    <section className="report-library">
      <div className="report-library-heading"><div><div className="report-side-kicker">YOUR WORKSPACE</div><h2>Recent reports</h2><p>{sortedReports.length} {sortedReports.length === 1 ? 'report' : 'reports'} matching your view</p></div><span className="report-library-private"><ShieldCheck size={14}/> Private to this workspace</span></div>
      <div className="report-filters">
        <label className="report-search"><Search size={16}/><input aria-label="Search reports" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports or projects"/></label>
        <label className="report-filter-select"><Filter size={14}/><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{(['Draft', 'Generating', 'Completed', 'Failed', 'Archived'] as ReportStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="report-filter-select"><select aria-label="Filter by report type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All report types</option>{reportTypes.map((type) => <option key={type.id} value={type.id}>{type.title}</option>)}</select></label>
        <label className="report-filter-select"><select aria-label="Sort reports" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}><option value="newest">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
      </div>
      {error && <div className="report-alert" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
      {!reportsLoaded ? <div className="report-detail-skeleton" aria-label="Loading reports"><span/><span/><span/></div>
        : reports.length === 0 ? <div className="report-empty-state"><span><FileText size={20}/></span><h3>No reports yet</h3><p>Create a report from a project with saved publications to bring your research evidence together.</p><button type="button" className="report-secondary-button" onClick={openWizard} disabled={projects.length === 0}><Plus size={14}/> Create your first report</button></div>
        : visibleReports.length === 0 ? <div className="report-empty-state compact"><Search size={20}/><h3>No matching reports</h3><p>Change the project, status, or search filters to find another report.</p><button type="button" className="report-secondary-button" onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setProjectFilter('all'); }}>Clear filters</button></div>
          : <div className="report-list">{visibleReports.map(renderReportCard)}</div>}
      {pageCount > 1 && <div className="report-pagination"><span>Page {page} of {pageCount}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
    </section>

    {showWizard && <div className="report-wizard-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !generating) setShowWizard(false); }}>
      <section className="report-wizard" role="dialog" aria-modal="true" aria-labelledby="report-wizard-title">
        <header className="report-wizard-header"><div><div className="report-side-kicker">REPORT CONFIGURATION</div><h2 id="report-wizard-title">Create a research report</h2></div><button type="button" className="report-icon-button" aria-label="Close configuration" disabled={generating} onClick={() => setShowWizard(false)}><X size={18}/></button></header>
        <nav className="report-wizard-steps" aria-label="Report configuration steps">{stepNames.map((name, index) => <button type="button" key={name} className={index === wizardStep ? 'active' : index < wizardStep ? 'complete' : ''} disabled={generating || index > wizardStep} onClick={() => setWizardStep(index)}><span>{index < wizardStep ? <Check size={13}/> : index + 1}</span><small>{name}</small></button>)}</nav>
        {error && <div className="report-alert" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
        <div className="report-wizard-content">
          {wizardStep === 0 && <div className="report-type-grid">{reportTypes.map((type) => { const Icon = type.icon; return <button type="button" key={type.id} className={`report-type-option ${reportType === type.id ? 'selected' : ''}`} aria-pressed={reportType === type.id} onClick={() => setReportType(type.id)}><span><Icon size={17}/></span><strong>{type.title}</strong><small>{type.detail}</small></button>; })}</div>}
          {wizardStep === 1 && <div className="report-source-step">
            <label className="report-field">Research project<select value={projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project._id} value={String(project._id)}>{project.title}</option>)}</select></label>
            {!projects.length && <div className="report-warning"><TriangleAlert size={16}/><span>Create a research project before configuring its report.</span></div>}
            {!!selectedProject && <><div className="report-source-summary"><span><strong>{projectPapers.length}</strong> saved publications</span><span><strong>{selectedPapers.length}</strong> selected</span><button type="button" onClick={() => setSelectedPaperIds(selectedPaperIds.length === projectPapers.length ? [] : projectPapers.map(paperId).filter(Boolean))}>{selectedPaperIds.length === projectPapers.length ? 'Clear selection' : 'Select all project papers'}</button></div>
              {selectedPaperIds.length > 100 && <div className="report-warning"><TriangleAlert size={16}/><span>Select at most 100 publications per report.</span></div>}
              <div className="report-paper-select-list">{projectPapers.length ? projectPapers.map((paper) => <label className="report-paper-option" key={paperId(paper)}><input type="checkbox" checked={selectedPaperIds.includes(paperId(paper))} onChange={() => togglePaper(paperId(paper))}/><span><strong>{paper.title}</strong><small>{[paper.authors?.join(', '), paperYear(paper), paper.venue].filter(Boolean).join(' · ') || 'Publication metadata incomplete'}</small></span><span className={paper.doi || paper.publicationUrl ? 'metadata-ok' : 'metadata-warning'} title={paper.doi || paper.publicationUrl ? 'A persistent identifier or source URL is available' : 'No DOI or publication URL is stored'}>{paper.doi || paper.publicationUrl ? <Check size={14}/> : <TriangleAlert size={14}/>}</span></label>) : <div className="report-empty-inline"><BookOpen size={18}/><span>No publications are saved to this project yet. Add papers to the project before generating a report.</span></div>}</div>
              <button type="button" className="report-disclosure" aria-expanded={sourcePreviewExpanded} onClick={() => setSourcePreviewExpanded((current) => !current)}><span>Evidence preview & metadata checks</span><ChevronDown size={15}/></button>
              {sourcePreviewExpanded && <div className="report-source-preview">
                <p><Check size={14}/> {selectedPapers.length} saved publication(s) selected for this report.</p>
                <p><Sparkles size={14}/> {analysisPreviewLoading ? 'Checking stored paper analyses…' : `${analysisPreviewCount} selected publication(s) have stored analyses.`}</p>
                {analysisPreviewError && <p className="report-source-preview-error"><TriangleAlert size={14}/>{analysisPreviewError}</p>}
                <p><TriangleAlert size={14}/>{projectGaps.length} saved research-gap item(s) and {projectQuestions.length} saved question(s) are available in this workspace.</p>
                <p><Layers3 size={14}/>{selectedPapers.filter((paper) => paper.citationCount != null || paper.referenceCount != null).length} selected publication(s) include stored citation/reference counts.</p>
                <p><ShieldCheck size={14}/>Generated citations are restricted to selected saved publications; missing identifiers will be labeled rather than inferred.</p>
                <p><TriangleAlert size={14}/>{selectedPapers.filter((paper) => !paper.doi && !paper.externalId && !paper.publicationUrl).length} selected publication(s) have no stored DOI, provider ID, or source URL.</p>
              </div>}
            </>}
          </div>}
          {wizardStep === 2 && <div className="report-analysis-step">
            <label className="report-field">Report title<input value={reportTitle} maxLength={160} onChange={(event) => setReportTitle(event.target.value)} placeholder={`${typeTitle(reportType)} — ${selectedProject?.title || 'Research project'}`}/></label>
            <fieldset className="report-depth-group"><legend>Analysis depth</legend><div>{(['executive', 'standard', 'comprehensive'] as ReportDepth[]).map((value) => <label key={value} className={depth === value ? 'selected' : ''}><input type="radio" name="report-depth" checked={depth === value} onChange={() => setDepth(value)}/><span><strong>{value[0].toUpperCase()+value.slice(1)}</strong><small>{value === 'executive' ? 'Concise overview and key evidence' : value === 'standard' ? 'Balanced analysis with evidence notes' : 'Expanded sections and supporting detail'}</small></span></label>)}</div></fieldset>
            <fieldset className="report-module-group"><legend>Include saved analysis modules</legend>{reportModules.map((module) => <label key={module.id}><input type="checkbox" checked={modules.includes(module.id)} onChange={() => toggleModule(module.id)}/><span><strong>{module.label}</strong><small>{module.detail}</small></span></label>)}</fieldset>
            <label className="report-field">Research scope<textarea value={scope} maxLength={500} onChange={(event) => setScope(event.target.value)} placeholder="Optional scope, boundaries, or questions for the report. Leave blank to use the project description and objectives."/></label>
            <div className="report-inline-fields"><label className="report-field">Citation style<select value={citationStyle} onChange={(event) => setCitationStyle(event.target.value)}>{['APA', 'MLA', 'Chicago'].map((style) => <option key={style}>{style}</option>)}</select></label><label className="report-field">Output language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{['English', 'Bengali', 'Spanish', 'French', 'German'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          </div>}
          {wizardStep === 3 && <div className="report-output-step"><div><div className="report-side-kicker">DOCUMENT FORMAT</div><h3>Choose a research-ready output.</h3><p>HTML and DOCX exports preserve report structure and evidence references. PDF uses the browser print dialog so you can save the formatted report as a PDF.</p></div><div className="report-format-options">{([['html', FileCode2, 'HTML', 'Portable, styled report page'], ['docx', FileText, 'DOCX', 'Editable Word document'], ['pdf', Download, 'PDF', 'Print or save as PDF']] as [ReportFormat, typeof FileText, string, string][]).map(([id, Icon, title, detail]) => <button type="button" key={id} className={format === id ? 'selected' : ''} aria-pressed={format === id} onClick={() => setFormat(id)}><Icon size={18}/><strong>{title}</strong><small>{detail}</small></button>)}</div><div className="report-format-note"><ShieldCheck size={15}/><span>Exports are generated from saved report content. No placeholder document is downloaded.</span></div></div>}
          {wizardStep === 4 && <div className="report-review-step">
            <div className="report-review-summary"><span className="report-review-icon"><FileBarChart2 size={19}/></span><div><span className="report-side-kicker">READY TO GENERATE</span><h3>{draftTitle}</h3><p>{selectedProject?.title || 'No project selected'} · {selectedPapers.length} publications · {depth} depth · {citationStyle} · {language}</p></div></div>
            <div className="report-outline"><div><strong>Report outline</strong><small>{format.toUpperCase()} output · {modules.length} source modules selected</small></div><ol>{outlines[reportType].map((section) => <li key={section}>{section}</li>)}</ol></div>
            <div className="report-integrity-note"><ShieldCheck size={16}/><p>Only saved project data is provided to generation. Missing metadata will be identified, and AI interpretations will be distinguished from source-derived findings.</p></div>
            {generating && <div className="report-generation-progress" role="status"><span className="report-spinner"/><div><strong>{generationSteps[generationStep]}</strong><small>Sources and report configuration are being saved securely.</small></div><span className="report-progress-track"><i/></span></div>}
          </div>}
        </div>
        <footer className="report-wizard-footer"><span>STEP {wizardStep + 1} OF {stepNames.length}</span><div>{wizardStep > 0 && <button type="button" className="report-secondary-button" disabled={generating} onClick={() => setWizardStep((step) => step - 1)}><ArrowLeft size={14}/> Back</button>}{wizardStep < 4 ? <button type="button" className="report-primary-button" disabled={generating || (wizardStep === 0 && !reportType) || (wizardStep === 1 && (!projectId || !selectedPaperIds.length || selectedPaperIds.length > 100))} onClick={() => { setError(''); setWizardStep((step) => step + 1); }} >Continue <ArrowRight size={14}/></button> : <button type="button" className="report-primary-button" disabled={generating || !selectedPapers.length || selectedPapers.length > 100} onClick={() => void createAndGenerate()}>{generating ? 'Generating report…' : 'Generate report'} <Sparkles size={15}/></button>}</div></footer>
      </section>
    </div>}

    {renameId && <div className="report-confirm-backdrop"><section className="report-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-report-title"><div className="report-side-kicker">REPORT MANAGEMENT</div><h2 id="rename-report-title">Rename report</h2><label className="report-field">Report title<input autoFocus maxLength={300} value={renameValue} onChange={(event) => setRenameValue(event.target.value)}/></label><footer><button type="button" className="report-secondary-button" onClick={() => setRenameId('')}>Cancel</button><button type="button" className="report-primary-button" disabled={!renameValue.trim()} onClick={() => void saveRename()}>Save title</button></footer></section></div>}
    {deleteId && <div className="report-confirm-backdrop"><section className="report-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-report-title"><div className="report-side-kicker">PERMANENT ACTION</div><h2 id="delete-report-title">Delete this report?</h2><p>The saved report and its version history will be deleted. Your source publications and analyses will not be changed.</p><footer><button type="button" className="report-secondary-button" onClick={() => setDeleteId('')}>Keep report</button><button type="button" className="report-danger-button" disabled={busyAction === deleteId} onClick={() => void deleteReport()}><Trash2 size={14}/> Delete report</button></footer></section></div>}
  </section>;
}
