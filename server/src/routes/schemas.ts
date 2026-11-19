import { z } from 'zod';
import { objectId } from '../Middleware/validate';

export const password = z.string().min(10, 'At least 10 characters').max(128).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
const str = (max: number) => z.string().trim().max(max);
const list = (max: number, each = 120) => z.array(z.string().trim().min(1).max(each)).max(max);

export const registerBody = z.object({ name: str(80).min(2), email: z.string().trim().toLowerCase().email().max(160), password, role: z.enum(['student', 'researcher', 'supervisor']).optional() });
export const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
export const forgotBody = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetBody = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/), password });
export const profileBody = z.object({
  name: str(80).min(2).optional(), institution: str(120).optional(), bio: str(500).optional(),
  preferences: z.object({
    theme: z.enum(['dark', 'light', 'forest', 'ocean']).optional(),
    notifications: z.record(z.string(), z.boolean()).optional(),
    research: z.object({ defaultDomain: str(80).optional(), defaultProvider: z.enum(['openalex', 'crossref', 'semanticscholar', 'arxiv', 'core', 'pubmed', 'doaj']).optional(), minPapersForGaps: z.number().int().min(2).max(20).optional() }).optional(),
  }).optional(),
});
export const passwordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

export const projectBody = z.object({
  title: str(200).min(3), topic: str(300).min(3), description: str(4000).optional(), objectives: list(15, 400).optional(),
  keywords: list(25).optional(), domain: str(80).optional(),
  status: z.enum(['planning', 'collecting', 'analyzing', 'reviewing', 'completed']).optional(),
});
export const projectUpdateBody = projectBody.partial();

const httpUrl = z.string().max(600).refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must be an http or https URL');
export const paperRecord = z.object({
  title: str(600).min(1), authors: list(80, 160).default([]), abstract: str(20000).default(''),
  publicationYear: z.number().int().min(1500).max(2200).optional(), venue: str(300).default(''),
  paperType: z.enum(['journal', 'conference', 'preprint', 'book', 'other']).default('other'),
  DOI: str(200).optional(), source: z.enum(['openalex', 'crossref', 'semanticscholar', 'arxiv', 'core', 'pubmed', 'doaj', 'manual']),
  externalId: str(300).optional(), keywords: list(30, 120).default([]), publicationUrl: httpUrl.default(''),
  openAccess: z.boolean().default(false), citationCount: z.number().int().min(0).nullable().optional(), referenceCount: z.number().int().min(0).nullable().optional(),
  referencedWorks: z.array(z.string().max(300)).max(1500).default([]), institutions: list(100, 200).optional(), domain: str(80).optional(),
});
export const importBody = z.object({ projectId: objectId, papers: z.array(paperRecord).min(1).max(50) });

const num = z.coerce.number().int();
export const searchPapersQuery = z.object({
  provider: z.enum(['openalex', 'crossref', 'semanticscholar', 'arxiv', 'core', 'pubmed', 'doaj']).default('openalex'),
  q: str(300).optional(), title: str(300).optional(), author: str(120).optional(), keywords: str(300).optional(),
  domain: str(80).optional(), venue: str(200).optional(), paperType: z.enum(['journal', 'conference', 'preprint', 'book', 'other']).optional(),
  yearFrom: num.min(1500).max(2200).optional(), yearTo: num.min(1500).max(2200).optional(),
  openAccess: z.enum(['true', 'false']).optional(), page: num.min(1).max(200).default(1), perPage: num.min(1).max(25).default(10),
});
export const paperTrendsQuery = z.object({
  q: str(300).min(1),
  yearFrom: num.min(1500).max(2200),
  yearTo: num.min(1500).max(2200),
}).refine((value) => value.yearFrom <= value.yearTo, {
  message: 'From year must be less than or equal to to year.',
  path: ['yearTo'],
});
export const libraryQuery = z.object({
  projectId: objectId.optional(), q: str(200).optional(), year: num.optional(), collection: str(80).optional(), tag: str(80).optional(),
  read: z.enum(['true', 'false']).optional(), analysis: z.enum(['analyzed', 'unanalyzed']).optional(),
  sort: z.enum(['title', 'date', 'added', 'relevance']).default('added'), page: num.min(1).default(1), limit: num.min(1).max(50).default(20),
});
export const paperPatch = z.object({
  notes: str(8000).optional(), tags: list(30, 60).optional(), collections: list(30, 80).optional(), read: z.boolean().optional(),
  title: str(600).min(1).optional(), abstract: str(20000).optional(), authors: list(80, 160).optional(), publicationYear: z.number().int().min(1500).max(2200).optional(),
  venue: str(300).optional(), keywords: list(30, 120).optional(),
});
export const analyzeBody = z.object({ useFullText: z.boolean().optional() });
const evItem = z.object({ text: str(2500).min(1), section: str(80).optional(), page: z.number().int().optional() });
export const analysisPut = z.object(Object.fromEntries(['researchObjective', 'researchQuestions', 'methodology', 'datasets', 'findings', 'limitations', 'futureWork', 'contributions'].map((k) => [k, z.array(evItem).max(20).optional()])) as any);

export const projectIdBody = z.object({ projectId: objectId });
export const gapListQuery = z.object({
  projectId: objectId.optional(), category: z.enum(['limitation', 'methodology', 'dataset', 'model', 'contradiction', 'futureWork']).optional(),
  label: str(60).optional(), q: str(200).optional(), classification: z.enum(['potential', 'researcherVerified']).optional(),
  page: num.min(1).default(1), limit: num.min(1).max(50).default(20),
});
export const gapPatch = z.object({ classification: z.enum(['potential', 'researcherVerified']).optional(), reviewerNote: str(3000).optional() });

export const questionGenerateBody = z.object({ projectId: objectId, gapIds: z.array(objectId).max(30).optional() });
export const questionBody = z.object({
  projectId: objectId, question: str(1500).min(10), motivation: str(3000).optional(), relatedGapId: objectId.optional(), supportingPaperIds: z.array(objectId).max(100).optional(),
  proposedMethodology: str(3000).optional(), requiredDataset: str(1500).optional(), evaluationMetrics: list(15, 120).optional(), expectedContribution: str(2000).optional(), notes: str(5000).optional(),
});
export const questionPatch = questionBody.omit({ projectId: true }).partial().extend({ status: z.enum(['proposed', 'saved', 'archived']).optional() });
export const questionListQuery = z.object({ projectId: objectId.optional(), status: z.enum(['proposed', 'saved', 'archived']).optional(), gapId: objectId.optional(), page: num.min(1).default(1), limit: num.min(1).max(100).default(30) });

export const nodeBody = z.object({ projectId: objectId, label: str(300).min(1), type: z.enum(['paper', 'author', 'topic', 'keyword', 'methodology', 'dataset', 'limitation', 'gap']), description: str(2000).optional() });
export const edgeBody = z.object({ projectId: objectId, sourceNodeId: objectId, targetNodeId: objectId, relationshipType: str(60).min(1), description: str(1500).optional(), evidencePaperIds: z.array(objectId).max(50).optional() });

export const reportGenBody = z.object({ projectId: objectId, title: str(300).optional() });
export const reportPut = z.object({ title: str(300).min(1).optional(), reportContent: z.string().min(1).max(400000).optional() });
export const reviewPut = z.object({
  themes: z.array(z.object({ themeId: str(60).min(1), title: str(200).min(1), paperIds: z.array(objectId).max(200), summary: str(6000).default(''), summaryOrigin: z.enum(['sourceDerived', 'userWritten', 'aiSuggested']).default('userWritten'), notes: str(6000).default('') })).max(30),
});
export const compareBody = z.object({ paperIds: z.array(objectId).min(2).max(6) });
export const globalSearchQuery = z.object({
  q: str(200).min(2), types: str(200).optional(), year: num.optional(), domain: str(80).optional(), venue: str(200).optional(),
  paperType: z.enum(['journal', 'conference', 'preprint', 'book', 'other']).optional(), status: z.enum(['analyzed', 'unanalyzed']).optional(),
  page: num.min(1).default(1), limit: num.min(1).max(50).default(15),
});
export const readBody = z.object({ ids: z.array(objectId).max(100).optional() });
