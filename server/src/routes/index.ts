import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { AiFeatureResult, Analysis, LiteratureReviewDocument, Paper, Project, Question, Report, ResearchNotebook, User, Workspace } from '../model/index.js';
import { ResearchGap } from '../Models/ResearchGap.js';
import { Citation } from '../Models/Citation.js';
import { isDatabaseConnected } from '../Config/db.js';
import citationRoutes from './citationRoutes.js';
import researchGapRoutes from './researchGapRoutes.js';
import { searchProvider, type Provider } from '../Integrations/providers.js';
import { getOpenAlexTrends } from '../Integrations/openAlex.js';
import { importBody, paperTrendsQuery, searchPapersQuery } from './schemas.js';
import { recommendSemanticScholar } from '../Integrations/semanticScholar.js';
import { extractPublicationIdentifiers, identifiersFromSource, normalizeDoi } from '../Integrations/publicationIdentifiers.js';
import { enqueuePaperEnrichment } from '../Services/paperEnrichmentService.js';
import { sendPasswordResetEmail } from '../Services/email.service.js';
import aiRoutes, { userAiLimit } from '../AI/Routes/ai.routes.js';
import { compareSavedPapers } from '../AI/Services/comparisonAnalysis.service.js';
import { createWorkspace, renameWorkspace, resolveWorkspace } from '../Services/workspaceService.js';
import { initialLiteratureReviewSections, isValidEditorDocument, sourceContainsEvidenceQuote } from '../Services/literatureReviewWorkspaceService.js';
import {
  formatReportReferences, generateStructuredReport, renderReportMarkdown, reportModules,
  isReportGenerationStale, validateGeneratedReport, type ReportType,
} from '../reports/reportGeneration.js';

type AuthRequest = Request & { userId?: string; workspaceId?: string };
type AsyncRoute = (req: AuthRequest, res: Response) => Promise<unknown>;
const router = Router();
const secret = () => process.env.JWT_SECRET;
const requireDatabase = (_req: Request, res: Response, next: NextFunction) =>
  isDatabaseConnected() ? next() : res.status(503).json({ error: 'MongoDB is not configured or unavailable.' });
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  let userId: string;
  try {
    const key = secret();
    if (!key || key.length < 32) throw new Error('JWT secret is not configured.');
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    userId = (jwt.verify(token || '', key) as { sub: string }).sub;
  } catch {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const requestedWorkspace = req.headers['x-workspace-id'];
  void resolveWorkspace(userId, typeof requestedWorkspace === 'string' ? requestedWorkspace : undefined)
    .then((workspace) => {
      (req as AuthRequest).userId = userId;
      (req as AuthRequest).workspaceId = String(workspace._id);
      next();
    })
    .catch(next);
};
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).userId;
    const user = userId ? await User.findById(userId).select('role').lean() : null;
    if ((user as any)?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    next();
  } catch (error) { next(error); }
};
const wrap = (handler: AsyncRoute) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(handler(req as AuthRequest, res)).catch(next);
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(
    null, file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf'),
  ),
});
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

const credentials = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
});
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  institution: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(1000).optional(),
  preferences: z.object({
    theme: z.enum(['dark', 'light', 'forest', 'ocean']).optional(),
    notifications: z.record(z.string(), z.boolean()).optional(),
    research: z.object({ minPapersForGaps: z.number().int().min(2).max(20).optional(), citationStyle: z.enum(['APA', 'MLA', 'Chicago']).optional() }).optional(),
  }).optional(),
});
const passwordSchema = z.string().min(8).max(100);
const publicUser = (user: any) => ({
  id: String(user._id), name: user.name, email: user.email, role: user.role,
  institution: user.institution || '', bio: user.bio || '', preferences: user.preferences || { theme: 'dark', notifications: {} },
  hasAvatar: Boolean(user.avatar?.data),
});
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const webhook = process.env.PASSWORD_RESET_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      to, subject: 'Reset your ResearchLens password', text: `Reset your password: ${resetUrl}`, resetUrl,
    }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Password reset delivery failed (${response.status}).`);
    return;
  }
  await sendPasswordResetEmail(to, resetUrl);
}
const projectSchema = z.object({
  title: z.string().min(1).max(200), topic: z.string().max(300).optional(),
  description: z.string().max(5000).optional(), objectives: z.string().max(5000).optional(),
  keywords: z.array(z.string().max(100)).max(30).optional(), domain: z.string().max(150).optional(),
  status: z.string().max(50).optional(),
});
const projectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid project identifier.');
const reportCreateSchema = z.object({
  projectId: projectIdSchema,
  title: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['project', 'literature-review', 'gap-assessment', 'bibliometric', 'methodology', 'findings']),
  paperIds: z.array(projectIdSchema).max(100).optional(),
  modules: z.array(z.enum(reportModules)).max(reportModules.length).default([]),
  depth: z.enum(['executive', 'standard', 'comprehensive']).default('standard'),
  scope: z.string().trim().min(1).max(500).optional(),
  citationStyle: z.enum(['APA', 'MLA', 'Chicago']).default('APA'),
  language: z.string().trim().min(1).max(100).default('English'),
  format: z.enum(['html', 'pdf', 'docx']).default('html'),
}).strict().superRefine((value, context) => {
  if (value.paperIds && new Set(value.paperIds.map((id) => id.toLowerCase())).size !== value.paperIds.length) {
    context.addIssue({ code: 'custom', message: 'Select each publication only once.' });
  }
});
const reportPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  status: z.enum(['Draft', 'Archived']).optional(),
  reportContent: z.string().max(200_000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a title, status, or reportContent to update.');
const researchNotebookSchema = z.object({
  version: z.number().int().min(0),
  citationStyle: z.enum(['APA', 'MLA', 'Chicago']),
  sections: z.array(z.object({
    id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
    title: z.string().trim().min(1).max(120),
    content: z.string().max(50000),
  }).strict()).min(1).max(20),
}).strict().superRefine((notebook, context) => {
  if (new Set(notebook.sections.map((section) => section.id)).size !== notebook.sections.length) {
    context.addIssue({ code: 'custom', message: 'Notebook section identifiers must be unique.' });
  }
  if (notebook.sections.reduce((total, section) => total + section.content.length, 0) > 300000) {
    context.addIssue({ code: 'custom', message: 'The notebook is too large to save in one request.' });
  }
});
const literatureReviewPayloadSchema = z.object({
  revision: z.number().int().min(0),
  title: z.string().trim().min(1).max(160),
  sections: z.array(z.object({
    id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
    title: z.string().trim().min(1).max(120),
    content: z.unknown().refine(isValidEditorDocument, 'Invalid rich-text section content.'),
  }).strict()).min(1).max(30),
  selectedPaperIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.')).max(100),
  notes: z.string().max(30000),
  themes: z.array(z.object({
    id: z.string().min(1).max(60).regex(/^[a-zA-Z0-9-]+$/),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(2000),
    paperIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.')).max(100),
  }).strict()).max(40).optional(),
  analyses: z.array(z.object({
    id: z.string().min(1).max(60).regex(/^[a-zA-Z0-9-]+$/),
    kind: z.string().min(1).max(60),
    feature: z.enum(['paper-summary', 'methodology', 'literature-review', 'research-gap', 'research-questions', 'hypothesis', 'research-proposal', 'citation-analysis', 'pdf-analysis', 'research-assistant', 'literature-comparison']),
    themeId: z.string().max(60).nullable(),
    title: z.string().trim().min(1).max(300),
    summary: z.string().min(1).max(5000),
    sections: z.array(z.object({
      heading: z.string().min(1).max(200),
      content: z.string().min(1).max(8000),
    }).strict()).max(16),
    recommendations: z.array(z.string().min(1).max(1000)).max(12),
    evidence: z.array(z.object({
      claim: z.string().min(1).max(500),
      quote: z.string().min(1).max(600),
      sourceLocation: z.string().max(160),
      paperId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.'),
      paperTitle: z.string().min(1).max(500),
      authors: z.array(z.string()).max(100),
      year: z.number().int().min(1500).max(2100).optional(),
      doi: z.string().max(500).optional(),
      sourceDocument: z.string().max(2000).optional(),
    }).strict()).min(1).max(12),
    limitations: z.array(z.string().min(1).max(500)).max(10),
    confidence: z.enum(['low', 'medium', 'high']),
    sourcePaperIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.')).min(1).max(20),
    createdAt: z.string().datetime(),
  }).strict()).max(30).optional(),
}).strict().superRefine((document, context) => {
  if (new Set(document.sections.map((section) => section.id)).size !== document.sections.length) {
    context.addIssue({ code: 'custom', message: 'Section identifiers must be unique.' });
  }
  if (new Set(document.selectedPaperIds).size !== document.selectedPaperIds.length) {
    context.addIssue({ code: 'custom', message: 'Select each source only once.' });
  }
  const selectedIds = new Set(document.selectedPaperIds);
  for (const theme of document.themes || []) {
    if (new Set(theme.paperIds).size !== theme.paperIds.length || theme.paperIds.some((id) => !selectedIds.has(id))) {
      context.addIssue({ code: 'custom', message: 'Theme sources must be unique papers selected for this review.' });
    }
  }
  for (const analysis of document.analyses || []) {
    if (analysis.sourcePaperIds.some((id) => !selectedIds.has(id))
      || analysis.evidence.some((item) => !analysis.sourcePaperIds.includes(item.paperId))) {
      context.addIssue({ code: 'custom', message: 'Analysis evidence must refer to its selected source papers.' });
    }
  }
  if (JSON.stringify(document).length > 700000) {
    context.addIssue({ code: 'custom', message: 'The review document is too large to save.' });
  }
});
type LiteratureReviewAnalysisInput = NonNullable<z.infer<typeof literatureReviewPayloadSchema>['analyses']>[number];

function comparableLiteratureAnalysis(value: any) {
  return JSON.stringify({
    id: value.id,
    kind: value.kind,
    feature: value.feature,
    themeId: value.themeId ?? null,
    title: value.title,
    summary: value.summary,
    sections: value.sections || [],
    recommendations: value.recommendations || [],
    evidence: (value.evidence || []).map((item: any) => ({
      claim: item.claim,
      quote: item.quote,
      sourceLocation: item.sourceLocation || '',
      paperId: String(item.paperId),
      paperTitle: item.paperTitle,
      authors: item.authors || [],
      year: item.year ?? null,
      doi: item.doi ?? null,
      sourceDocument: item.sourceDocument ?? null,
    })),
    limitations: value.limitations || [],
    confidence: value.confidence,
    sourcePaperIds: (value.sourcePaperIds || []).map(String),
    createdAt: new Date(value.createdAt).toISOString(),
  });
}

async function validateLiteratureEvidence(
  analyses: LiteratureReviewAnalysisInput[] | undefined,
  existingAnalyses: any[],
  selectedPaperIds: string[],
  ownerId: string,
  workspaceId: string,
) {
  if (!analyses?.length) return undefined;
  const updated = analyses.filter((analysis) => {
    const previous = existingAnalyses.find((item) => item.id === analysis.id);
    return !previous || comparableLiteratureAnalysis(previous) !== comparableLiteratureAnalysis(analysis);
  });
  const evidence = updated.flatMap((analysis) => analysis.evidence);
  if (!evidence.length) return undefined;
  const paperIds = [...new Set(evidence.map((item) => item.paperId))];
  const sources = await Paper.find({
    _id: { $in: paperIds },
    ownerId,
    workspaceId,
  }).select('_id title authors publicationYear doi fileName abstract extractedText').lean<{
    _id: unknown; title: string; authors?: string[]; publicationYear?: number; doi?: string;
    fileName?: string; abstract?: string; extractedText?: string;
  }[]>();
  if (sources.length !== paperIds.length) return 'One or more evidence sources are unavailable in this workspace.';
  const sourcesById = new Map(sources.map((paper) => [String(paper._id), paper]));
  for (const item of evidence) {
    const paper = sourcesById.get(item.paperId);
    if (!paper || !selectedPaperIds.includes(item.paperId)
      || item.paperTitle !== paper.title
      || JSON.stringify(item.authors) !== JSON.stringify(paper.authors || [])
      || item.year !== (typeof paper.publicationYear === 'number' && paper.publicationYear >= 1500 && paper.publicationYear <= 2100 ? paper.publicationYear : undefined)
      || item.doi !== (paper.doi || undefined)
      || item.sourceDocument !== (paper.fileName || undefined)
      || item.sourceLocation !== 'Not explicitly stated in the source'
      || !sourceContainsEvidenceQuote(`${paper.extractedText || ''} ${paper.abstract || ''}`, item.quote)) {
      return 'Evidence must match the saved publication metadata and source text. Unsupported passages cannot be saved.';
    }
  }
  return undefined;
}

const literatureReviewVersionSchema = z.object({ revision: z.number().int().min(0) }).strict();
const literatureReviewRestoreSchema = z.object({ currentRevision: z.number().int().min(0) }).strict();
const defaultResearchNotebookSections = [
  { id: 'title-abstract', title: 'Title & abstract', content: '' },
  { id: 'executive-summary', title: 'Executive summary', content: '' },
  { id: 'introduction', title: 'Introduction', content: '' },
  { id: 'background', title: 'Background & literature', content: '' },
  { id: 'problem-statement', title: 'Problem statement', content: '' },
  { id: 'questions-objectives', title: 'Questions & objectives', content: '' },
  { id: 'methodology', title: 'Methodology', content: '' },
  { id: 'results-analysis', title: 'Results & analysis', content: '' },
  { id: 'discussion', title: 'Discussion', content: '' },
  { id: 'limitations', title: 'Limitations', content: '' },
  { id: 'conclusion', title: 'Conclusion', content: '' },
  { id: 'references', title: 'References', content: '' },
];
const workspaceSchema = z.object({ name: z.string().trim().min(2).max(60) }).strict();
const paperSchema = z.object({
  title: z.string().min(1).max(500), authors: z.array(z.string()).max(100).default([]),
  abstract: z.string().max(50000).optional(),
  publicationYear: z.number().int().min(1500).max(2100).optional().nullable(),
  venue: z.string().max(500).optional(), doi: z.string().max(500).optional(),
  source: z.string().max(100).optional(), externalId: z.string().max(500).optional(),
  keywords: z.array(z.string()).max(100).default([]), publicationUrl: z.string().max(1000).optional(),
  paperType: z.string().max(100).optional(), citationCount: z.number().int().min(0).nullable().optional(),
  referenceCount: z.number().int().min(0).nullable().optional(), referencedWorks: z.array(z.string().max(500)).max(1500).optional(),
  projectId: z.string().optional(),
});
const compareRequestSchema = z.object({
  paperIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid paper identifier.')).min(2).max(6),
}).strict().refine((value) => new Set(value.paperIds).size === value.paperIds.length, 'Select each publication only once.');
const displayProvider = (source?: string) => {
  const provider = source?.toLowerCase().replace(/[\s_-]/g, '');
  if (provider === 'openalex') return 'OpenAlex';
  if (provider === 'semanticscholar') return 'Semantic Scholar';
  if (provider === 'crossref') return 'Crossref';
  if (provider === 'arxiv') return 'arXiv';
  if (provider === 'pubmed') return 'PubMed';
  return undefined;
};
const metadataSeed = (source?: string, externalId?: string, doi?: string) => {
  const identifiers = identifiersFromSource(source, externalId);
  const trusted = Boolean(displayProvider(source) && (externalId || doi));
  return {
    ...(Object.keys(identifiers).length ? { identifiers } : {}),
    metadataStatus: trusted ? 'matched' : 'pending',
    ...(trusted ? { metadataVerificationMethod: 'source' } : {}),
    ...(trusted ? { metadataProvider: displayProvider(source) } : {}),
    metadataAttempts: 0,
  };
};
const doiQuery = (doi: string) => {
  const escaped = doi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^(?:doi:\\s*|https?://(?:dx\\.)?doi\\.org/)?${escaped}$`, 'i');
};

// Authentication
router.post('/auth/register', requireDatabase, wrap(async (req, res) => {
  const key = secret();
  if (!key || key.length < 32) return res.status(503).json({ error: 'Authentication is not configured.' });
  const data = credentials.extend({ name: z.string().min(1).max(100) }).parse(req.body);
  if (await User.exists({ email: data.email })) return res.status(409).json({ error: 'Account already exists.' });
  const user = await User.create({
    name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12),
    role: process.env.ADMIN_EMAIL?.toLowerCase() === data.email ? 'admin' : 'researcher',
  });
  return res.status(201).json({
    token: jwt.sign({ sub: String(user._id) }, key, { expiresIn: '8h' }),
    user: publicUser(user),
  });
}));
router.post('/auth/login', requireDatabase, wrap(async (req, res) => {
  const key = secret();
  if (!key || key.length < 32) return res.status(503).json({ error: 'Authentication is not configured.' });
  const data = credentials.parse(req.body);
  const user = await User.findOne({ email: data.email });
  if (!user || !await bcrypt.compare(data.password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (process.env.ADMIN_EMAIL?.toLowerCase() === user.email && (user as any).role !== 'admin') {
    (user as any).role = 'admin';
    await user.save();
  }
  return res.json({
    token: jwt.sign({ sub: String(user._id) }, key, { expiresIn: '8h' }),
    user: publicUser(user),
  });
}));
router.get('/auth/me', requireDatabase, authenticate, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  return user ? res.json({ user: publicUser(user) }) : res.status(404).json({ error: 'Account not found.' });
}));

router.put('/auth/profile', requireDatabase, authenticate, wrap(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { $set: profileSchema.parse(req.body) }, { new: true, runValidators: true });
  return user ? res.json({ user: publicUser(user) }) : res.status(404).json({ error: 'Account not found.' });
}));

router.post('/auth/avatar', requireDatabase, authenticate, avatarUpload.single('avatar'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a JPG, PNG, or WebP image up to 2 MB.' });
  const user = await User.findByIdAndUpdate(req.userId, { $set: { avatar: { data: req.file.buffer, contentType: req.file.mimetype, updatedAt: new Date() } } }, { new: true });
  return user ? res.json({ user: publicUser(user) }) : res.status(404).json({ error: 'Account not found.' });
}));

router.get('/auth/avatar', requireDatabase, authenticate, wrap(async (req, res) => {
  const user = await User.findById(req.userId).select('+avatar');
  if (!user?.avatar?.data) return res.status(404).end();
  res.setHeader('Content-Type', user.avatar.contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(user.avatar.data);
}));

router.post('/auth/forgot-password', requireDatabase, wrap(async (req, res) => {
  const email = z.string().email().max(254).transform((value) => value.toLowerCase()).parse(req.body.email);
  const user = await User.findOne({ email });
  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    user.resetTokenHash = tokenHash(rawToken);
    user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const base = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    try { await sendPasswordReset(email, `${base.replace(/\/$/, '')}/?resetToken=${rawToken}&resetEmail=${encodeURIComponent(email)}`); }
    catch (error) { user.resetTokenHash = undefined; user.resetTokenExpiresAt = undefined; await user.save(); throw error; }
  }
  return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
}));

router.post('/auth/reset-password', requireDatabase, wrap(async (req, res) => {
  const body = z.object({ email: z.string().email().max(254), token: z.string().length(64).regex(/^[a-f0-9]+$/), password: passwordSchema }).parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase(), resetTokenHash: tokenHash(body.token), resetTokenExpiresAt: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpiresAt');
  if (!user) return res.status(400).json({ error: 'The reset link is invalid or expired.' });
  user.passwordHash = await bcrypt.hash(body.password, 12);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  return res.json({ message: 'Password reset successfully. You can sign in now.' });
}));

// Administrator-only account overview. All authorization is enforced server-side.
router.get('/admin/users', requireDatabase, authenticate, requireAdmin, wrap(async (_req, res) => {
  const users = await User.find().select('name email role createdAt').sort({ createdAt: -1 }).lean();
  return res.json({ users });
}));

router.get('/admin/stats', requireDatabase, authenticate, requireAdmin, wrap(async (_req, res) => {
  const [users, projects, papers] = await Promise.all([User.countDocuments(), Project.countDocuments(), Paper.countDocuments()]);
  return res.json({ users, projects, papers });
}));

// Workspaces are private to the account owner. Teams and invitations are not enabled.
router.get('/workspaces', requireDatabase, authenticate, wrap(async (req, res) => {
  const items = await Workspace.find({ ownerId: req.userId }).sort({ isDefault: -1, createdAt: 1 }).lean();
  return res.json({ items, activeWorkspaceId: req.workspaceId });
}));
router.post('/workspaces', requireDatabase, authenticate, wrap(async (req, res) => {
  const parsed = workspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Enter a workspace name.' });
  return res.status(201).json(await createWorkspace(req.userId!, parsed.data.name));
}));
router.put('/workspaces/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const parsed = workspaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Enter a workspace name.' });
  return res.json(await renameWorkspace(req.userId!, req.params.id, parsed.data.name));
}));

// Projects
router.get('/projects', requireDatabase, authenticate, wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const items = await Project.find({ ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20);
  return res.json({ items, page });
}));
router.post('/projects', requireDatabase, authenticate, wrap(async (req, res) =>
  res.status(201).json(await Project.create({ ...projectSchema.parse(req.body), workspaceId: req.workspaceId, ownerId: req.userId }))));
router.get('/projects/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const item = await Project.findOne({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId });
  return item ? res.json(item) : res.status(404).json({ error: 'Project not found.' });
}));
router.get('/projects/:id/notebook', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const filter = { _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  if (!await Project.exists(filter)) return res.status(404).json({ error: 'Project not found.' });
  const notebook = await ResearchNotebook.findOneAndUpdate(
    { projectId, ownerId: req.userId, workspaceId: req.workspaceId },
    { $setOnInsert: { sections: defaultResearchNotebookSections, citationStyle: 'APA', version: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return res.json(notebook);
}));
router.get('/projects/:id/literature-review', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const filter = { _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  const project = await Project.findOne(filter).select('title').lean<{ title: string }>();
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const selectedPaperIds = await Paper.find({ projectId, ownerId: req.userId, workspaceId: req.workspaceId })
    .select('_id').limit(100).lean().then((items) => items.map((item) => item._id));
  const document = await LiteratureReviewDocument.findOneAndUpdate(
    { projectId, ownerId: req.userId, workspaceId: req.workspaceId },
    { $setOnInsert: {
      title: `Literature Review: ${project.title}`,
      sections: initialLiteratureReviewSections,
      selectedPaperIds,
      revision: 0,
      notes: '',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select('-history');
  return res.json(document);
}));
router.put('/projects/:id/literature-review', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const filter = { projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  if (!await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const parsed = literatureReviewPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid literature review.' });
  const { revision, ...changes } = parsed.data;
  const sourceCount = await Paper.countDocuments({ _id: { $in: changes.selectedPaperIds }, ownerId: req.userId, workspaceId: req.workspaceId });
  if (sourceCount !== changes.selectedPaperIds.length) return res.status(400).json({ error: 'One or more selected sources are unavailable in this workspace.' });
  const currentReview = await LiteratureReviewDocument.findOne(filter).select('revision analyses').lean();
  if (!currentReview) return res.status(409).json({ error: 'Open the literature review before saving.' });
  if (currentReview.revision !== revision) {
    const latest = await LiteratureReviewDocument.findOne(filter).select('-history').lean();
    return res.status(409).json({ error: 'This review changed in another session. Reload the latest version before continuing.', document: latest });
  }
  const evidenceError = await validateLiteratureEvidence(
    changes.analyses,
    currentReview.analyses || [],
    changes.selectedPaperIds,
    req.userId!,
    req.workspaceId!,
  );
  if (evidenceError) return res.status(400).json({ error: evidenceError });
  const document = await LiteratureReviewDocument.findOneAndUpdate(
    { ...filter, revision },
    { $set: changes, $inc: { revision: 1 } },
    { new: true, runValidators: true },
  ).select('-history');
  if (document) return res.json(document);
  const current = await LiteratureReviewDocument.findOne(filter).select('-history').lean();
  if (!current) return res.status(409).json({ error: 'Open the literature review before saving.' });
  return res.status(409).json({ error: 'This review changed in another session. Reload the latest version before continuing.', document: current });
}));
router.post('/projects/:id/literature-review/versions', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const filter = { projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  const parsed = literatureReviewPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid literature review.' });
  const { revision, ...changes } = parsed.data;
  const sourceCount = await Paper.countDocuments({ _id: { $in: changes.selectedPaperIds }, ownerId: req.userId, workspaceId: req.workspaceId });
  if (sourceCount !== changes.selectedPaperIds.length) return res.status(400).json({ error: 'One or more selected sources are unavailable in this workspace.' });
  const currentReview = await LiteratureReviewDocument.findOne(filter).select('revision analyses').lean();
  if (!currentReview) return res.status(409).json({ error: 'Open the literature review before saving a version.' });
  if (currentReview.revision !== revision) {
    const latest = await LiteratureReviewDocument.findOne(filter).select('-history').lean();
    return res.status(409).json({ error: 'This review changed in another session. Reload the latest version before saving a version.', document: latest });
  }
  const evidenceError = await validateLiteratureEvidence(
    changes.analyses,
    currentReview.analyses || [],
    changes.selectedPaperIds,
    req.userId!,
    req.workspaceId!,
  );
  if (evidenceError) return res.status(400).json({ error: evidenceError });
  const savedAt = new Date();
  const snapshot = {
    ...changes,
    themes: changes.themes || [],
    analyses: changes.analyses || [],
    revision: revision + 1,
    savedAt,
  };
  const document = await LiteratureReviewDocument.findOneAndUpdate(
    { ...filter, revision },
    {
      $set: changes,
      $inc: { revision: 1 },
      $push: { history: { $each: [snapshot], $slice: -20 } },
    },
    { new: true, runValidators: true },
  ).select('-history');
  if (document) return res.status(201).json({ document, version: { revision: revision + 1, title: changes.title, savedAt } });
  const current = await LiteratureReviewDocument.findOne(filter).select('-history').lean();
  if (!current) return res.status(409).json({ error: 'Open the literature review before saving a version.' });
  return res.status(409).json({ error: 'This review changed in another session. Reload the latest version before saving a version.', document: current });
}));
router.get('/projects/:id/literature-review/versions', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const document = await LiteratureReviewDocument.findOne({
    projectId, ownerId: req.userId, workspaceId: req.workspaceId,
  }).select('history').lean();
  return document ? res.json({
    items: [...document.history].sort((a, b) => b.revision - a.revision)
      .map(({ revision, title, savedAt }) => ({ revision, title, savedAt })),
  }) : res.status(404).json({ error: 'Literature review not found.' });
}));
router.post('/projects/:id/literature-review/versions/:revision/restore', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const targetRevision = z.coerce.number().int().min(0).parse(req.params.revision);
  const { currentRevision } = literatureReviewRestoreSchema.parse(req.body);
  const filter = { projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  const current = await LiteratureReviewDocument.findOne({ ...filter, revision: currentRevision });
  if (!current) {
    const latest = await LiteratureReviewDocument.findOne(filter).select('-history').lean();
    return latest
      ? res.status(409).json({ error: 'This review changed in another session. Reload before restoring.', document: latest })
      : res.status(404).json({ error: 'Literature review not found.' });
  }
  const snapshot = current.history.find((item) => item.revision === targetRevision);
  if (!snapshot) return res.status(404).json({ error: 'Saved review version not found.' });
  const savedAt = new Date();
  const previous = {
    revision: current.revision,
    title: current.title,
    sections: current.sections,
    selectedPaperIds: current.selectedPaperIds,
    notes: current.notes,
    themes: current.themes || [],
    analyses: current.analyses || [],
    savedAt,
  };
  const restored = await LiteratureReviewDocument.findOneAndUpdate(
    { ...filter, revision: currentRevision },
    {
      $set: {
        title: snapshot.title,
        sections: snapshot.sections,
        selectedPaperIds: snapshot.selectedPaperIds,
        notes: snapshot.notes,
        themes: snapshot.themes || [],
        analyses: snapshot.analyses || [],
      },
      $inc: { revision: 1 },
      $push: { history: { $each: [previous], $slice: -20 } },
    },
    { new: true, runValidators: true },
  ).select('-history');
  return restored ? res.json(restored) : res.status(409).json({ error: 'This review changed before the version could be restored.' });
}));
router.put('/projects/:id/notebook', requireDatabase, authenticate, wrap(async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.id);
  const filter = { projectId, ownerId: req.userId, workspaceId: req.workspaceId };
  if (!await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const parsed = researchNotebookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid notebook content.' });
  const { version, ...changes } = parsed.data;
  const notebook = await ResearchNotebook.findOneAndUpdate(
    { ...filter, version },
    { $set: changes, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (notebook) return res.json(notebook);
  const current = await ResearchNotebook.findOne(filter).lean();
  if (!current) return res.status(409).json({ error: 'Open the notebook before saving your changes.' });
  return res.status(409).json({ error: 'This notebook changed in another session. Reload the latest version before continuing.', notebook: current });
}));
router.put('/projects/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const item = await Project.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId, workspaceId: req.workspaceId }, projectSchema.partial().parse(req.body),
    { new: true, runValidators: true },
  );
  return item ? res.json(item) : res.status(404).json({ error: 'Project not found.' });
}));
router.delete('/projects/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const item = await Project.findOneAndDelete({ _id: req.params.id, ownerId: req.userId, workspaceId: req.workspaceId });
  if (!item) return res.status(404).json({ error: 'Project not found.' });
  await Promise.all([
    ResearchNotebook.deleteOne({ projectId: item._id, ownerId: req.userId, workspaceId: req.workspaceId }),
    LiteratureReviewDocument.deleteOne({ projectId: item._id, ownerId: req.userId, workspaceId: req.workspaceId }),
  ]);
  return res.json({ ok: true });
}));

// OpenAlex returns abstracts as an inverted index; rebuild the text by word position.
function abstractFromIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words[position] = word;
  return words.join(' ');
}

// Keep /search before /:id so it is handled as a fixed route.
router.get('/papers/search', wrap(async (req, res) => {
  const parsed = searchPapersQuery.parse(req.query);
  if (![parsed.q, parsed.title, parsed.keywords, parsed.author].some((v) => v?.trim())) return res.status(400).json({ error: 'Enter a topic, title, keywords or an author.' });
  const result = await searchProvider(parsed.provider as Provider, { ...parsed, q: [parsed.q, parsed.title].filter(Boolean).join(' '), openAccess: parsed.openAccess === 'true' });
  return res.json({ provider: parsed.provider, ...result });
}));
router.get('/papers/trends', wrap(async (req, res) => {
  const parsed = paperTrendsQuery.parse(req.query);
  return res.json(await getOpenAlexTrends(parsed.q, parsed.yearFrom, parsed.yearTo));
}));
router.get('/papers/recommendations', wrap(async (req, res) => {
  const paperId = z.string().min(1).max(300).parse(req.query.paperId);
  return res.json({ provider: 'semanticscholar', ...await recommendSemanticScholar(paperId) });
}));
router.post('/papers/import', requireDatabase, authenticate, wrap(async (req, res) => {
  const { projectId, papers } = importBody.parse(req.body);
  if (!await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) return res.status(404).json({ error: 'Project not found.' });
  let created = 0; let skipped = 0;
  for (const item of papers) {
    const match: Record<string, unknown> = { ownerId: req.userId, workspaceId: req.workspaceId, projectId };
    if (item.externalId) match.externalId = item.externalId;
    else if (item.DOI) match.doi = normalizeDoi(item.DOI);
    else match.title = item.title;
    const doi = normalizeDoi(item.DOI);
    const identityConditions: Record<string, unknown>[] = [];
    if (item.externalId) identityConditions.push({ externalId: item.externalId });
    if (doi) identityConditions.push({ doi: doiQuery(doi) });
    const duplicate = await Paper.exists(identityConditions.length
      ? { ownerId: req.userId, workspaceId: req.workspaceId, projectId, $or: identityConditions }
      : match);
    if (duplicate) { skipped += 1; continue; }
    const paper = await Paper.create({
      ...item, doi, ...metadataSeed(item.source, item.externalId, doi),
      isPreprint: item.paperType === 'preprint', projectId, workspaceId: req.workspaceId, ownerId: req.userId,
    });
    enqueuePaperEnrichment(String(req.userId), String(paper._id));
    created += 1;
  }
  return res.status(201).json({ created, skipped });
}));
router.post('/papers', requireDatabase, authenticate, wrap(async (req, res) => {
  const data = paperSchema.parse(req.body);
  if (data.projectId && !await Project.exists({ _id: data.projectId, ownerId: req.userId, workspaceId: req.workspaceId })) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const doi = normalizeDoi(data.doi);
  const identityConditions: Record<string, unknown>[] = [];
  if (data.externalId) identityConditions.push({ externalId: data.externalId });
  if (doi) identityConditions.push({ doi: doiQuery(doi) });
  const duplicateQuery: Record<string, unknown> = identityConditions.length
    ? { ownerId: req.userId, workspaceId: req.workspaceId, $or: identityConditions }
    : { ownerId: req.userId, workspaceId: req.workspaceId, title: data.title };
  const existing = await Paper.findOne(duplicateQuery);
  if (existing) return res.status(200).json({ paper: existing, alreadySaved: true });
  const paper = await Paper.create({ ...data, doi, ...metadataSeed(data.source, data.externalId, doi), workspaceId: req.workspaceId, ownerId: req.userId });
  enqueuePaperEnrichment(String(req.userId), String(paper._id));
  return res.status(201).json({ paper, alreadySaved: false });
}));
router.post('/papers/upload', requireDatabase, authenticate, pdfUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a PDF file.' });
  if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(415).json({ error: 'Only PDF files are supported.' });
  }
  let parser: PDFParse | undefined;
  try {
    const projectId = req.body.projectId ? z.string().min(1).parse(req.body.projectId) : undefined;
    if (projectId && !await Project.exists({ _id: projectId, ownerId: req.userId, workspaceId: req.workspaceId })) return res.status(404).json({ error: 'Project not found.' });
    parser = new PDFParse({ data: req.file.buffer });
    const parsed = await parser.getText();
    const pdfInfo = await parser.getInfo();
    const info = (pdfInfo as unknown as { info?: Record<string, unknown>; metadata?: unknown }).info || {};
    const metadataText = JSON.stringify({ info, metadata: (pdfInfo as unknown as { metadata?: unknown }).metadata });
    const extractedText = parsed.text.trim().slice(0, 500000);
    if (!extractedText) {
      return res.status(422).json({ error: 'No selectable text was found. Scanned PDFs need OCR before analysis.' });
    }
    const metadataTitle = typeof info.Title === 'string' ? info.Title.trim() : '';
    const title = (String(req.body.title || '').trim() || metadataTitle || req.file.originalname.replace(/\.pdf$/i, '')).slice(0, 500);
    const metadataAuthor = typeof info.Author === 'string' ? info.Author.trim() : '';
    const identifiers = extractPublicationIdentifiers([req.file.originalname, metadataText, extractedText].join('\n'));
    const paper = await Paper.create({
      title, authors: metadataAuthor ? metadataAuthor.split(/\s*;\s*/).filter(Boolean).slice(0, 100) : [],
      source: 'PDF upload', fileName: req.file.originalname,
      ...(Object.keys(identifiers).length ? { discoveredIdentifiers: identifiers } : {}),
      metadataStatus: 'pending', metadataAttempts: 0,
      extractedText, ...(projectId ? { projectId } : {}), workspaceId: req.workspaceId, ownerId: req.userId,
    });
    enqueuePaperEnrichment(String(req.userId), String(paper._id));
    return res.status(201).json({ paper, characters: extractedText.length, pages: parsed.total });
  } finally {
    if (parser) await parser.destroy();
  }
}));
router.get('/papers', requireDatabase, authenticate, wrap(async (req, res) =>
  res.json({ items: await Paper.find({ ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(100) })));
router.delete('/papers/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const paper = await Paper.findOneAndDelete({ _id: req.params.id, ownerId: req.userId, workspaceId: req.workspaceId });
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  await Promise.all([
    Analysis.deleteMany({ paperId: paper._id, ownerId: req.userId, workspaceId: req.workspaceId }),
    AiFeatureResult.deleteMany({ paperId: paper._id, ownerId: req.userId, workspaceId: req.workspaceId }),
    Question.updateMany({ ownerId: req.userId, workspaceId: req.workspaceId }, { $pull: { supportingPaperIds: String(paper._id) } }),
    LiteratureReviewDocument.updateMany(
      {
        ownerId: req.userId,
        workspaceId: req.workspaceId,
        $or: [{ selectedPaperIds: paper._id }, { 'history.selectedPaperIds': paper._id }],
      },
      {
        $pull: { selectedPaperIds: paper._id, 'history.$[].selectedPaperIds': paper._id },
        $inc: { revision: 1 },
      },
    ),
  ]);
  return res.json({ ok: true });
}));
router.get('/papers/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const paper = await Paper.findOne({ _id: req.params.id, ownerId: req.userId, workspaceId: req.workspaceId });
  return paper ? res.json(paper) : res.status(404).json({ error: 'Paper not found.' });
}));
router.get('/papers/:id/analysis', requireDatabase, authenticate, wrap(async (req, res) =>
  res.json({ items: await Analysis.find({ paperId: req.params.id, ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(20) })));
router.post('/compare', requireDatabase, authenticate, userAiLimit, wrap(async (req, res) => {
  const parsed = compareRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Select between two and six distinct publications.' });
  const result = await compareSavedPapers(parsed.data.paperIds, req.userId!, req.workspaceId!);
  return res.status(201).json(result);
}));

// Questions and reports
router.get('/questions', requireDatabase, authenticate, wrap(async (req, res) =>
  res.json({ items: await Question.find({ ownerId: req.userId, workspaceId: req.workspaceId }).limit(100) })));
router.post('/questions', requireDatabase, authenticate, wrap(async (req, res) => {
  const question = z.string().min(5).max(2000).parse(req.body.question);
  return res.status(201).json(await Question.create({ question, ownerId: req.userId, workspaceId: req.workspaceId, status: 'Proposed' }));
}));
router.get('/reports', requireDatabase, authenticate, wrap(async (req, res) => {
  const querySchema = z.object({
    projectId: projectIdSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const query = querySchema.parse(req.query);
  const filter: Record<string, unknown> = { ownerId: req.userId, workspaceId: req.workspaceId };
  if (query.projectId) filter.projectId = query.projectId;
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Report.countDocuments(filter),
  ]);
  return res.json({ items, total, page: query.page, limit: query.limit });
}));
router.post('/reports', requireDatabase, authenticate, wrap(async (req, res) => {
  const input = reportCreateSchema.parse(req.body);
  const project: any = await Project.findOne({
    _id: input.projectId, ownerId: req.userId, workspaceId: req.workspaceId,
  }).lean() as any;
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const paperFilter: Record<string, unknown> = {
    projectId: input.projectId, ownerId: req.userId, workspaceId: req.workspaceId,
  };
  if (input.paperIds) paperFilter._id = { $in: input.paperIds };
  const foundPapers: any[] = await Paper.find(paperFilter).limit(101).lean() as any;
  if (!foundPapers.length) return res.status(400).json({ error: 'Select at least one saved publication for this project.' });
  if (foundPapers.length > 100) return res.status(400).json({ error: 'A report can use at most 100 publications.' });
  if (input.paperIds && foundPapers.length !== input.paperIds.length) {
    return res.status(400).json({ error: 'One or more selected publications are unavailable in this project.' });
  }
  const paperIds = input.paperIds?.map((paperId) => paperId.toLowerCase())
    || foundPapers.map((paper) => String(paper._id));
  const report = await Report.create({
    projectId: String(project._id),
    title: input.title || `${input.type === 'project' ? 'Research report' : input.type.replaceAll('-', ' ')}: ${project.title}`,
    type: input.type, status: 'Draft', depth: input.depth, scope: input.scope || 'selected-papers',
    citationStyle: input.citationStyle, language: input.language, format: input.format,
    paperIds, modules: input.modules, reportContent: '', references: [], versions: [],
    workspaceId: req.workspaceId, ownerId: req.userId,
  });
  return res.status(201).json(report);
}));
router.post('/reports/:id/generate', requireDatabase, authenticate, wrap(async (req, res) => {
  const id = projectIdSchema.parse(req.params.id);
  const filter = { _id: id, ownerId: req.userId, workspaceId: req.workspaceId };
  const original = await Report.findOne(filter);
  if (!original) return res.status(404).json({ error: 'Report not found.' });
  if (original.status === 'Archived') return res.status(409).json({ error: 'Archived reports cannot be generated.' });
  if (!original.type || !original.projectId || !Array.isArray(original.paperIds) || !original.paperIds.length) {
    return res.status(400).json({ error: 'This legacy report has no saved draft configuration to generate.' });
  }
  if (original.status === 'Generating') {
    if (!isReportGenerationStale(original.generationStartedAt)) {
      return res.status(409).json({ error: 'This report is already generating.' });
    }
    const staleFailure = {
      code: 'GENERATION_STALE',
      message: 'The previous generation attempt stopped before finishing. Retry generation to continue.',
      retryable: true,
      failedAt: new Date(),
    };
    const staleFilter: Record<string, unknown> = { ...filter, status: 'Generating' };
    if (original.generationStartedAt) staleFilter.generationStartedAt = original.generationStartedAt;
    else staleFilter.$or = [{ generationStartedAt: { $exists: false } }, { generationStartedAt: null }];
    const recovered = await Report.findOneAndUpdate(
      staleFilter,
      { $set: { status: 'Failed', failure: staleFailure }, $unset: { generationRunId: 1 }, $currentDate: { updatedAt: true } },
      { new: true },
    );
    if (!recovered) return res.status(409).json({ error: 'The report generation state changed. Retry the request.' });
  }
  const generationStartedAt = new Date();
  const generationRunId = randomBytes(16).toString('hex');
  const lock = await Report.updateOne({ ...filter, status: { $ne: 'Generating' } }, {
    $set: { status: 'Generating', generationStartedAt, generationRunId },
    $unset: { failure: 1 },
    $currentDate: { updatedAt: true },
  });
  if (!lock.modifiedCount) {
    const current = await Report.findOne(filter).select('status');
    return current ? res.status(409).json({ error: 'This report is already generating.' }) : res.status(404).json({ error: 'Report not found.' });
  }

  let failureCode = 'SOURCE_LOAD_FAILED';
  let failureMessage = 'Saved report sources could not be loaded. Check project and publication availability, then retry.';
  try {
    const project: any = await Project.findOne({
      _id: original.projectId, ownerId: req.userId, workspaceId: req.workspaceId,
    }).lean() as any;
    if (!project) {
      failureCode = 'PROJECT_UNAVAILABLE';
      failureMessage = 'The saved project is no longer available. Restore it or create a new report.';
      throw new Error('project-unavailable');
    }
    const loadedPapers: any[] = await Paper.find({
      _id: { $in: original.paperIds }, projectId: original.projectId,
      ownerId: req.userId, workspaceId: req.workspaceId,
    }).lean() as any;
    const paperById = new Map<string, any>(loadedPapers.map((paper) => [String(paper._id).toLowerCase(), paper]));
    const papers: any[] = original.paperIds
      .map((paperId: string) => paperById.get(paperId.toLowerCase()))
      .filter((paper: any) => paper !== undefined);
    if (!papers.length || papers.length !== original.paperIds.length) {
      failureCode = 'PUBLICATIONS_UNAVAILABLE';
      failureMessage = 'One or more selected publications are no longer available in this project.';
      throw new Error('publications-unavailable');
    }
    const paperIds = papers.map((paper) => String(paper._id));
    const modules: string[] = original.modules || [];
    const includeAnalyses = modules.some((module) => ['paper-summary', 'methodology', 'literature-comparison'].includes(module));
    const includeGaps = modules.includes('research-gap');
    const includeQuestions = modules.includes('research-questions');
    const includeCitations = modules.includes('citation-analysis');
    const includeLiteratureReview = modules.includes('literature-review');
    const selectedIds = new Set(paperIds.map((paperId) => paperId.toLowerCase()));
    const requestedFeatureNames = [
      ...(modules.includes('literature-comparison') ? ['literature-comparison'] : []),
      ...(includeGaps ? ['research-gap'] : []),
      ...(includeQuestions ? ['research-questions'] : []),
    ];
    const [analyses, aiFeatureResults, savedGaps, storedQuestions, citationRecords, savedReview] = await Promise.all([
      includeAnalyses
        ? Analysis.find({ paperId: { $in: paperIds }, ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(300).lean()
        : Promise.resolve([]),
      requestedFeatureNames.length
        ? AiFeatureResult.find({
          projectId: original.projectId, ownerId: req.userId, workspaceId: req.workspaceId,
          feature: { $in: requestedFeatureNames },
        }).sort({ createdAt: -1 }).limit(40).lean()
        : Promise.resolve([]),
      includeGaps
        ? ResearchGap.find({ projectId: original.projectId, ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(100).lean()
        : Promise.resolve([]),
      includeQuestions
        ? Question.find({ ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(200).lean()
        : Promise.resolve([]),
      includeCitations
        ? Citation.find({ paperId: { $in: paperIds }, ownerId: req.userId, workspaceId: req.workspaceId }).sort({ createdAt: -1 }).limit(500).lean()
        : Promise.resolve([]),
      includeLiteratureReview
        ? LiteratureReviewDocument.findOne({
          projectId: original.projectId, ownerId: req.userId, workspaceId: req.workspaceId,
        }).select('-history').lean()
        : Promise.resolve(null),
    ]);
    const questions = storedQuestions.filter((question) =>
      (question.supportingPaperIds || []).some((paperId: string) => selectedIds.has(String(paperId).toLowerCase())));
    const relevantAiFeatureResults = aiFeatureResults.filter((item: any) =>
      item.feature !== 'literature-comparison'
      || (item.paperIds || []).length > 0
        && (item.paperIds || []).every((paperId: unknown) => selectedIds.has(String(paperId).toLowerCase())));
    const relevantGaps = savedGaps.filter((gap) => {
      const supportingIds = (gap.supportingPaperIds || []).map((paperId: unknown) => String(paperId).toLowerCase());
      return !supportingIds.length || supportingIds.some((paperId: string) => selectedIds.has(paperId));
    });
    const sourceTypes = ['project-metadata', 'selected-publication-metadata'];
    if (includeAnalyses) sourceTypes.push('stored-paper-analyses');
    if (includeGaps) sourceTypes.push('saved-research-gaps');
    if (includeQuestions) sourceTypes.push('saved-research-questions');
    if (includeCitations) sourceTypes.push('saved-citations', 'paper-citation-metadata');
    if (modules.includes('literature-comparison')) sourceTypes.push('saved-literature-comparisons');

    const paperSources = papers.map((paper) => {
      const source: Record<string, unknown> = {
        paperId: String(paper._id), title: paper.title, authors: paper.authors || [],
        publicationYear: paper.publicationYear, venue: paper.venue, doi: paper.doi,
        publicationUrl: paper.publicationUrl, abstract: paper.abstract, keywords: paper.keywords || [],
        identifiers: paper.identifiers, discoveredIdentifiers: paper.discoveredIdentifiers,
      };
      if (includeCitations) {
        Object.assign(source, {
          metadataStatus: paper.metadataStatus, metadataProvider: paper.metadataProvider,
          metadataVerificationMethod: paper.metadataVerificationMethod,
          citationMetadataSource: paper.citationMetadataSource, citationRetrievedAt: paper.citationRetrievedAt,
          citationMetadataError: paper.citationMetadataError, citationCount: paper.citationCount,
          referenceCount: paper.referenceCount, referencedWorks: paper.referencedWorks,
          citingWorks: paper.citingWorks, citingSource: paper.citingSource,
        });
      }
      if (includeAnalyses) {
        source.analyses = analyses.filter((analysis: any) => String(analysis.paperId) === String(paper._id)).map((analysis: any) => ({
          researchObjective: analysis.researchObjective, methodology: analysis.methodology,
          datasets: analysis.datasets, findings: analysis.findings, limitations: analysis.limitations,
          futureWork: analysis.futureWork, contributions: analysis.contributions,
          sourceReferences: analysis.sourceReferences, analysisStatus: analysis.analysisStatus,
          confidence: analysis.confidence, deepAnalysis: analysis.deepAnalysis,
        }));
      }
      return source;
    });
    const sourceReferencesByPaper = new Map<string, string[]>(
      paperSources.map((source: any) => [
        String(source.paperId),
        (source.analyses || []).flatMap((analysis: any) => analysis.sourceReferences || [])
          .filter((reference: unknown): reference is string => typeof reference === 'string'),
      ]),
    );
    const review = savedReview as any;
    const reviewPaperIds = (review?.selectedPaperIds || []).map((paperId: unknown) => String(paperId));
    const reviewMatchesSelection = reviewPaperIds.length > 0
      && reviewPaperIds.every((paperId: string) => selectedIds.has(paperId.toLowerCase()));
    if (includeLiteratureReview && reviewMatchesSelection) sourceTypes.push('saved-literature-review');
    const sourceReview = review ? {
      included: reviewMatchesSelection,
      ...(reviewMatchesSelection ? {
        title: review.title, revision: review.revision, selectedPaperIds: reviewPaperIds,
        sections: review.sections, notes: review.notes, themes: review.themes, analyses: review.analyses,
      } : {
        title: review.title, selectedPaperIds: reviewPaperIds,
        reason: 'Saved synthesis has no selected source IDs or references publications outside this report’s selected source set.',
      }),
    } : null;
    const sources = {
      project: {
        projectId: String(project._id), title: project.title, topic: project.topic,
        description: project.description, objectives: project.objectives, keywords: project.keywords,
        domain: project.domain, status: project.status,
      },
      sourcePaperIds: paperIds,
      papers: paperSources,
      includedModules: modules,
      includedSourceTypes: sourceTypes,
      ...(includeGaps ? {
        researchGaps: relevantGaps.map((gap: any) => ({
          gapId: String(gap._id), title: gap.title, description: gap.description,
          category: gap.category, strength: gap.strength,
          supportingPaperIds: (gap.supportingPaperIds || []).map((paperId: unknown) => String(paperId))
            .filter((paperId: string) => selectedIds.has(paperId.toLowerCase())),
        })),
      } : {}),
      ...(relevantAiFeatureResults.length ? {
        aiFeatureResults: relevantAiFeatureResults.map((item: any) => ({
          feature: item.feature, paperIds: (item.paperIds || []).map((paperId: unknown) => String(paperId)),
          result: item.result, createdAt: item.createdAt,
        })),
      } : {}),
      ...(includeQuestions ? {
        storedQuestions: questions.map((item: any) => ({
          question: item.question, motivation: item.motivation, relatedGapId: item.relatedGapId,
          supportingPaperIds: item.supportingPaperIds, proposedMethodology: item.proposedMethodology,
          feasibility: item.feasibility, status: item.status,
        })),
      } : {}),
      ...(includeCitations ? {
        citations: citationRecords.map((item: any) => ({
          paperId: String(item.paperId), citedPaperId: item.citedPaperId ? String(item.citedPaperId) : undefined,
          style: item.style, formattedText: item.formattedText, createdAt: item.createdAt,
        })),
      } : {}),
      ...(includeLiteratureReview ? { literatureReview: sourceReview } : {}),
      generation: { generationStartedAt, includedModules: modules, includedSourceTypes: sourceTypes },
    };
    failureCode = 'MODEL_GENERATION_FAILED';
    failureMessage = 'AI report generation failed. Please retry; the saved source bundle is retained.';
    if (!await Report.exists({ ...filter, status: 'Generating', generationRunId })) {
      return res.status(409).json({ error: 'This generation attempt is no longer active.' });
    }
    const sourceUpdate = await Report.updateOne(
      { ...filter, status: 'Generating', generationRunId }, { $set: { sources } },
    );
    if (!sourceUpdate.matchedCount) {
      return res.status(409).json({ error: 'This generation attempt is no longer active.' });
    }
    const type = original.type as ReportType;
    const { report: generated, model } = await generateStructuredReport({
      type, depth: original.depth || 'standard', scope: original.scope || undefined,
      language: original.language || 'English', modules, sources,
    });
    failureCode = 'OUTPUT_VALIDATION_FAILED';
    failureMessage = 'Generated report did not meet the evidence requirements. Retry with a narrower source selection.';
    validateGeneratedReport(generated, type, paperIds, sourceReferencesByPaper);
    const generatedAt = new Date();
    const provenance = {
      ...sources,
      generation: { generationStartedAt, provider: 'Google Gemini', model, generatedAt, includedModules: modules, includedSourceTypes: sourceTypes },
    };
    const references = formatReportReferences(papers.map((paper) => ({
      paperId: String(paper._id), title: paper.title, authors: paper.authors,
      publicationYear: paper.publicationYear, venue: paper.venue, doi: paper.doi,
      publicationUrl: paper.publicationUrl,
      identifiers: paper.identifiers as Record<string, string | undefined> | undefined,
    })), original.citationStyle || 'APA');
    const reportContent = renderReportMarkdown(generated, references, paperIds);
    failureCode = 'REPORT_SAVE_FAILED';
    failureMessage = 'The generated report could not be saved. Please retry.';
    const report = await Report.findOne({ ...filter, status: 'Generating', generationRunId });
    if (!report) {
      const exists = await Report.exists(filter);
      return exists
        ? res.status(409).json({ error: 'This generation attempt is no longer active.' })
        : res.status(404).json({ error: 'Report not found.' });
    }
    if (report.reportContent && report.reportContent !== reportContent) {
      report.versions.push({
        title: report.title, status: report.status, reportContent: report.reportContent,
        references: report.references || [], sources: report.sources,
        generatedAt: report.generatedAt, savedAt: new Date(),
      });
    }
    report.reportContent = reportContent;
    report.references = references;
    report.sources = provenance;
    report.status = 'Completed';
    report.generatedAt = generatedAt;
    report.failure = undefined;
    await report.save();
    await Report.updateOne({ ...filter, status: 'Completed', generationRunId }, { $unset: { generationRunId: 1 } });
    return res.json(report);
  } catch (error) {
    const failure = {
      code: failureCode, message: failureMessage, retryable: true, failedAt: new Date(),
    };
    console.error('Report generation failed.', {
      reportId: id, phase: failureCode,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    const report = await Report.findOneAndUpdate(
      { ...filter, status: 'Generating', generationRunId },
      { $set: { status: 'Failed', failure }, $unset: { generationRunId: 1 }, $currentDate: { updatedAt: true } },
      { new: true },
    );
    if (!report) {
      const exists = await Report.exists(filter);
      return exists
        ? res.status(409).json({ error: 'This generation attempt is no longer active.' })
        : res.status(404).json({ error: 'Report not found.' });
    }
    return res.status(502).json({ error: failure.message, report });
  }
}));
router.get('/reports/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const report = await Report.findOne({
    _id: projectIdSchema.parse(req.params.id), ownerId: req.userId, workspaceId: req.workspaceId,
  });
  return report ? res.json(report) : res.status(404).json({ error: 'Report not found.' });
}));
router.patch('/reports/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const id = projectIdSchema.parse(req.params.id);
  const changes = reportPatchSchema.parse(req.body);
  const report = await Report.findOne({ _id: id, ownerId: req.userId, workspaceId: req.workspaceId });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.status === 'Generating') return res.status(409).json({ error: 'A generating report cannot be edited.' });
  if (changes.reportContent !== undefined && changes.reportContent !== report.reportContent) {
    report.versions.push({
      title: report.title, status: report.status, reportContent: report.reportContent || '',
      references: report.references || [], sources: report.sources,
      generatedAt: report.generatedAt, savedAt: new Date(),
    });
  }
  if (changes.title !== undefined) report.title = changes.title;
  if (changes.status !== undefined) report.status = changes.status;
  if (changes.reportContent !== undefined) report.reportContent = changes.reportContent;
  await report.save();
  return res.json(report);
}));
router.post('/reports/:id/duplicate', requireDatabase, authenticate, wrap(async (req, res) => {
  const source = await Report.findOne({
    _id: projectIdSchema.parse(req.params.id), ownerId: req.userId, workspaceId: req.workspaceId,
  });
  if (!source) return res.status(404).json({ error: 'Report not found.' });
  const duplicate = await Report.create({
    projectId: source.projectId, title: `${source.title || 'Research report'} (Copy)`,
    reportContent: source.reportContent || '', references: source.references || [],
    type: source.type, status: 'Draft', depth: source.depth, scope: source.scope,
    citationStyle: source.citationStyle, language: source.language, format: source.format,
    paperIds: source.paperIds || [], modules: source.modules || [],
    sources: source.sources, generatedAt: source.generatedAt, versions: [],
    workspaceId: req.workspaceId, ownerId: req.userId,
  });
  return res.status(201).json(duplicate);
}));
router.delete('/reports/:id', requireDatabase, authenticate, wrap(async (req, res) => {
  const report = await Report.findOneAndDelete({
    _id: projectIdSchema.parse(req.params.id), ownerId: req.userId, workspaceId: req.workspaceId,
  });
  return report ? res.json({ success: true }) : res.status(404).json({ error: 'Report not found.' });
}));

router.use('/citations', requireDatabase, citationRoutes);
router.use('/research-gaps', requireDatabase, researchGapRoutes);
router.use('/ai', aiRoutes);
export default router;
