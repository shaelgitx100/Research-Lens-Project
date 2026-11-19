import mongoose, { Schema, type InferSchemaType, type Model, type Types } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'researcher', 'supervisor', 'admin'], default: 'researcher' },
  institution: { type: String, maxlength: 160, default: '' },
  bio: { type: String, maxlength: 1000, default: '' },
  preferences: { type: Schema.Types.Mixed, default: { theme: 'dark', notifications: {} } },
  avatar: { data: Buffer, contentType: String, updatedAt: Date },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
}, { timestamps: true });
type UserRecord = InferSchemaType<typeof userSchema>;

const projectSchema = new Schema({
  title: { type: String, required: true, maxlength: 200 }, topic: String, description: String,
  objectives: String, keywords: [String], domain: String,
  status: { type: String, default: 'Active' },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

const paperSchema = new Schema({
  title: { type: String, required: true, maxlength: 500 }, authors: [String], abstract: String,
  publicationYear: Number, venue: String, doi: String, source: String, externalId: String,
  identifiers: {
    openAlexId: String, semanticScholarId: String, arxivId: String, pmid: String,
  },
  discoveredIdentifiers: {
    doi: String, openAlexId: String, semanticScholarId: String, arxivId: String, pmid: String,
  },
  metadataStatus: { type: String, enum: ['pending', 'resolving', 'matched', 'ambiguous', 'not_found', 'provider_unavailable'], index: true },
  metadataProvider: String, metadataVerificationMethod: { type: String, enum: ['provider', 'source', 'researcher'] },
  metadataCandidates: [Schema.Types.Mixed], metadataError: String,
  metadataAttempts: { type: Number, default: 0 }, metadataRetryAt: Date, metadataStartedAt: Date, metadataLastEnrichedAt: Date,
  citationMetadataSource: String, citationRetrievedAt: Date, referenceRetrievedAt: Date, citationMetadataError: String,
  citingWorks: [Schema.Types.Mixed], citingSource: String, citingRetrievedAt: Date,
  paperType: String, isPreprint: Boolean, keywords: [String], publicationUrl: String, openAccess: Boolean,
  citationCount: Number, referenceCount: Number, referencedWorks: [String], institutions: [String],
  projectId: { type: Schema.Types.ObjectId, index: true }, workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true }, isDemo: { type: Boolean, default: false },
  ownerId: { type: Schema.Types.ObjectId, index: true }, notes: String,
  read: { type: Boolean, default: false }, fileName: String, extractedText: String,
}, { timestamps: true });

const analysisSchema = new Schema({
  paperId: { type: Schema.Types.ObjectId, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: Schema.Types.ObjectId, index: true },
  researchObjective: String, methodology: String, datasets: String, findings: String,
  limitations: String, futureWork: String, contributions: String, sourceReferences: [String],
  analysisStatus: String, confidence: String, deepAnalysis: Schema.Types.Mixed, relatedLiterature: [Schema.Types.Mixed],
  aiProvider: String, aiModel: String,
}, { timestamps: true });

const aiFeatureResultSchema = new Schema({
  feature: { type: String, required: true, index: true },
  paperId: { type: Schema.Types.ObjectId, index: true },
  paperIds: { type: [Schema.Types.ObjectId], index: true, default: undefined },
  projectId: { type: Schema.Types.ObjectId, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  result: { type: Schema.Types.Mixed, required: true },
  aiProvider: { type: String, default: 'Google Gemini' },
  aiModel: { type: String, required: true },
}, { timestamps: true });

const questionSchema = new Schema({
  question: { type: String, required: true }, motivation: String, relatedGapId: String,
  supportingPaperIds: [String], proposedMethodology: String, feasibility: String, status: String,
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: Schema.Types.ObjectId, index: true },
}, { timestamps: true });

const reportSchema = new Schema({
  projectId: String, title: String, reportContent: String, references: [String],
  type: { type: String, enum: ['project', 'literature-review', 'gap-assessment', 'bibliometric', 'methodology', 'findings'] },
  status: { type: String, default: 'Draft' },
  depth: { type: String, enum: ['executive', 'standard', 'comprehensive'] },
  scope: String,
  citationStyle: { type: String, enum: ['APA', 'MLA', 'Chicago'] },
  language: String,
  format: { type: String, enum: ['html', 'pdf', 'docx'] },
  paperIds: [String],
  modules: [String],
  sources: Schema.Types.Mixed,
  failure: Schema.Types.Mixed,
  versions: { type: [Schema.Types.Mixed], default: [] },
  generatedAt: Date,
  generationStartedAt: Date,
  generationRunId: { type: String, select: false },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  ownerId: { type: Schema.Types.ObjectId, index: true },
}, { timestamps: true });

const researchNotebookSectionSchema = new Schema({
  id: { type: String, required: true, maxlength: 60 },
  title: { type: String, required: true, maxlength: 120 },
  content: { type: String, default: '', maxlength: 50000 },
}, { _id: false });
const researchNotebookSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sections: { type: [researchNotebookSectionSchema], required: true },
  citationStyle: { type: String, enum: ['APA', 'MLA', 'Chicago'], default: 'APA' },
  version: { type: Number, default: 0 },
}, { timestamps: true });
researchNotebookSchema.index({ ownerId: 1, workspaceId: 1, projectId: 1 }, { unique: true });

const literatureReviewSectionSchema = new Schema({
  id: { type: String, required: true, maxlength: 60 },
  title: { type: String, required: true, maxlength: 120 },
  content: { type: Schema.Types.Mixed, required: true },
}, { _id: false });
const literatureReviewThemeSchema = new Schema({
  id: { type: String, required: true, maxlength: 60 },
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 2000, default: '' },
  paperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
}, { _id: false });
const literatureReviewAnalysisSchema = new Schema({
  id: { type: String, required: true, maxlength: 60 },
  kind: { type: String, required: true, maxlength: 60 },
  feature: { type: String, required: true, maxlength: 60 },
  themeId: { type: String, maxlength: 60, default: null },
  title: { type: String, required: true, maxlength: 300 },
  summary: { type: String, required: true, maxlength: 5000 },
  sections: [{
    heading: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 8000 },
  }],
  recommendations: [{ type: String, maxlength: 1000 }],
  evidence: [{
    claim: { type: String, required: true, maxlength: 500 },
    quote: { type: String, required: true, maxlength: 600 },
    sourceLocation: { type: String, maxlength: 160, default: '' },
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true },
    paperTitle: { type: String, required: true, maxlength: 500 },
    authors: [String],
    year: { type: Number, min: 1500, max: 2100 },
    doi: { type: String, maxlength: 500 },
    sourceDocument: { type: String, maxlength: 2000 },
  }],
  limitations: [{ type: String, maxlength: 500 }],
  confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
  sourcePaperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  createdAt: { type: Date, required: true },
}, { _id: false });
const literatureReviewVersionSchema = new Schema({
  revision: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 160 },
  sections: { type: [literatureReviewSectionSchema], required: true },
  selectedPaperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  notes: { type: String, maxlength: 30000, default: '' },
  themes: { type: [literatureReviewThemeSchema], default: [] },
  analyses: { type: [literatureReviewAnalysisSchema], default: [] },
  savedAt: { type: Date, required: true },
}, { _id: false });
const literatureReviewDocumentSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 160, default: 'Literature Review' },
  sections: { type: [literatureReviewSectionSchema], required: true },
  selectedPaperIds: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  notes: { type: String, maxlength: 30000, default: '' },
  themes: { type: [literatureReviewThemeSchema], default: [] },
  analyses: { type: [literatureReviewAnalysisSchema], default: [] },
  revision: { type: Number, default: 0 },
  history: { type: [literatureReviewVersionSchema], default: [] },
}, { timestamps: true });
literatureReviewDocumentSchema.index({ ownerId: 1, workspaceId: 1, projectId: 1 }, { unique: true });
type LiteratureReviewSectionRecord = { id: string; title: string; content: unknown };
type LiteratureReviewVersionRecord = {
  revision: number;
  title: string;
  sections: LiteratureReviewSectionRecord[];
  selectedPaperIds: Types.ObjectId[];
  notes: string;
  themes: { id: string; title: string; description: string; paperIds: Types.ObjectId[] }[];
  analyses: {
    id: string; kind: string; feature: string; themeId: string | null; title: string; summary: string;
    sections: { heading: string; content: string }[]; recommendations: string[];
    evidence: {
      claim: string; quote: string; sourceLocation: string; paperId: Types.ObjectId; paperTitle: string;
      authors: string[]; year?: number; doi?: string; sourceDocument?: string;
    }[];
    limitations: string[]; confidence: 'low' | 'medium' | 'high'; sourcePaperIds: Types.ObjectId[]; createdAt: Date;
  }[];
  savedAt: Date;
};
type LiteratureReviewDocumentRecord = LiteratureReviewVersionRecord & {
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  history: LiteratureReviewVersionRecord[];
  createdAt: Date;
  updatedAt: Date;
};

const workspaceSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  nameKey: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });
workspaceSchema.index({ ownerId: 1, nameKey: 1 }, { unique: true });
workspaceSchema.index({ ownerId: 1, isDefault: 1 }, {
  unique: true,
  partialFilterExpression: { isDefault: true },
});

// Reuse compiled models during development reloads.
export const User: Model<UserRecord> = mongoose.models.User || mongoose.model<UserRecord>('User', userSchema);
export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);
export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
export const Paper = mongoose.models.Paper || mongoose.model('Paper', paperSchema);
export const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
export const AiFeatureResult = mongoose.models.AiFeatureResult || mongoose.model('AiFeatureResult', aiFeatureResultSchema);
export const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
export const ResearchNotebook = mongoose.models.ResearchNotebook || mongoose.model('ResearchNotebook', researchNotebookSchema);
export const LiteratureReviewDocument: Model<LiteratureReviewDocumentRecord> =
  (mongoose.models.LiteratureReviewDocument as Model<LiteratureReviewDocumentRecord> | undefined)
  || mongoose.model<LiteratureReviewDocumentRecord>('LiteratureReviewDocument', literatureReviewDocumentSchema);
