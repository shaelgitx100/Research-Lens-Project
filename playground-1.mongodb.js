/* global use, db, ObjectId */
// MongoDB Playground for ResearchLens
// This script matches the app's Mongoose schemas and creates demo data for the project.

const database = "researchlens";
use(database);

const ensureCollection = (name) => {
  if (!db.getCollectionNames().includes(name)) {
    db.createCollection(name);
  }
};

const collections = [
  "users",
  "projects",
  "papers",
  "analyses",
  "aifeatureresults",
  "questions",
  "reports",
  "citations",
  "annotations",
  "researchgaps"
];

collections.forEach(ensureCollection);

// Users
// User does not have ownerId in the schema.
db.users.createIndex({ email: 1 }, { unique: true });

// Projects
// Matches server/src/model/index.ts
// projectSchema: { title, topic, description, objectives, keywords, domain, status, ownerId }
db.projects.createIndex({ ownerId: 1, status: 1 });
db.projects.createIndex({ title: "text", topic: "text", keywords: "text" });

// Papers
db.papers.createIndex({ ownerId: 1, projectId: 1 });
db.papers.createIndex({ title: "text", abstract: "text", keywords: "text" });
db.papers.createIndex({ source: 1, externalId: 1 });

// Analyses
db.analyses.createIndex({ ownerId: 1, paperId: 1 });
db.analyses.createIndex({ paperId: 1 });

// AiFeatureResult
db.aifeatureresults.createIndex({ ownerId: 1, feature: 1 });
db.aifeatureresults.createIndex({ paperId: 1, projectId: 1 });

// Questions
db.questions.createIndex({ ownerId: 1, status: 1 });
db.questions.createIndex({ question: "text", motivation: "text" });

// Reports
db.reports.createIndex({ ownerId: 1, projectId: 1 });

// Citation, Annotation, ResearchGap models in server/src/Models/*.ts
db.citations.createIndex({ paperId: 1, ownerId: 1 });
db.citations.createIndex({ citedPaperId: 1 });
db.annotations.createIndex({ paperId: 1, ownerId: 1 });
db.researchgaps.createIndex({ ownerId: 1, projectId: 1 });
db.researchgaps.createIndex({ supportingPaperIds: 1 });

// ---------------------------
// Seed demo data
// ---------------------------
db.users.deleteMany({ email: /^demo\./ });
db.projects.deleteMany({ title: /^AI Literature Review Project$/ });
db.papers.deleteMany({ source: /^OpenAlex|^Crossref$/ });
db.analyses.deleteMany({ aiProvider: "Google Gemini" });
db.questions.deleteMany({ motivation: /^Demo/ });
db.reports.deleteMany({ title: /^Demo/ });
db.citations.deleteMany({ style: "APA" });
db.annotations.deleteMany({ note: /^Demo/ });
db.researchgaps.deleteMany({ title: /^Demo/ });

const ownerId = new ObjectId();
const projectId = new ObjectId();
const paperId1 = new ObjectId();
const paperId2 = new ObjectId();

// 1) User
// Matches User schema exactly

db.users.insertOne({
  _id: ownerId,
  name: "Demo Researcher",
  email: "demo.researcher@example.com",
  passwordHash: "demo-password-hash",
  role: "researcher",
  institution: "Example University",
  bio: "Researcher testing the ResearchLens workspace.",
  preferences: {
    theme: "dark",
    notifications: {}
  },
  avatar: null,
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 2) Project
db.projects.insertOne({
  _id: projectId,
  title: "AI Literature Review Project",
  topic: "Research discovery and evidence synthesis",
  description: "A sample project for exploring literature gaps and summarizing relevant papers.",
  objectives: "Locate relevant studies, compare themes, and synthesize findings.",
  keywords: ["literature review", "AI", "research workflow"],
  domain: "Applied AI",
  status: "Active",
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 3) Papers
db.papers.insertMany([
  {
    _id: paperId1,
    title: "Adaptive Retrieval for Research Discovery",
    authors: ["A. Smith", "B. Lee", "C. Patel"],
    abstract: "This paper explores adaptive retrieval techniques for research discovery in large-scale academic databases.",
    publicationYear: 2024,
    venue: "ICML",
    doi: "10.1000/example.doi",
    source: "OpenAlex",
    externalId: "openalex:W123456789",
    paperType: "Conference",
    isPreprint: false,
    keywords: ["retrieval", "research discovery", "LLM"],
    publicationUrl: "https://example.com/paper-1",
    openAccess: true,
    citationCount: 128,
    referenceCount: 27,
    referencedWorks: ["W1111111", "W2222222"],
    institutions: ["Example University"],
    projectId,
    ownerId,
    notes: "Seeded demo paper",
    read: false,
    fileName: "adaptive-retrieval.pdf",
    extractedText: "This is demo extracted text for a seeded research paper.",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: paperId2,
    title: "Graph-Based Literature Mapping",
    authors: ["D. Brown", "E. Kim"],
    abstract: "A graph-based framework for mapping citations and concept clusters in interdisciplinary literatures.",
    publicationYear: 2023,
    venue: "NeurIPS",
    doi: "10.1000/example.doi.2",
    source: "Crossref",
    externalId: "crossref:123456",
    paperType: "Journal",
    isPreprint: false,
    keywords: ["graph", "citation analysis", "mapping"],
    publicationUrl: "https://example.com/paper-2",
    openAccess: false,
    citationCount: 95,
    referenceCount: 18,
    referencedWorks: ["W3333333"],
    institutions: ["Research Lab"],
    projectId,
    ownerId,
    notes: "Demo literature mapping article",
    read: true,
    fileName: "graph-mapping.pdf",
    extractedText: "Sample extracted text for graph-based mapping.",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// 4) Analyses
db.analyses.insertOne({
  paperId: paperId1,
  ownerId,
  researchObjective: "Assess retrieval quality for research discovery workflows.",
  methodology: "Review literature and compare retrieval strategies across evidence sources.",
  datasets: "Synthetic and demo corpus references",
  findings: "Adaptive retrieval improves relevance and contextual coverage.",
  limitations: "Demo findings are illustrative and not real academic evidence.",
  futureWork: "Evaluate with a real dataset and expert validation.",
  contributions: "Provides a practical literature discovery workflow.",
  sourceReferences: ["OpenAlex", "Crossref"],
  analysisStatus: "Completed",
  confidence: "Medium",
  deepAnalysis: {
    summary: "The study suggests retrieval quality is improved when source metadata is incorporated.",
    recommendations: ["Validate with expert review", "Check source provenance"]
  },
  relatedLiterature: [
    { title: "Adaptive Retrieval for Research Discovery", source: "OpenAlex" }
  ],
  aiProvider: "Google Gemini",
  aiModel: "gemini-3.8-flash",
  createdAt: new Date(),
  updatedAt: new Date()
});

// 5) AI feature results
db.aifeatureresults.insertOne({
  feature: "citation-analysis",
  paperId: paperId1,
  projectId,
  ownerId,
  result: {
    summary: "Strong citation coverage across the demo corpus.",
    recommendations: ["Check for supporting evidence", "Validate author affiliations"]
  },
  aiProvider: "Google Gemini",
  aiModel: "gemini-3.8-flash",
  createdAt: new Date(),
  updatedAt: new Date()
});

// 6) Questions
db.questions.insertOne({
  question: "How do retrieval systems perform when scientific abstracts are noisy or incomplete?",
  motivation: "Demo question to test research discovery workflows.",
  relatedGapId: "gap-demo-1",
  supportingPaperIds: [paperId1.toString(), paperId2.toString()],
  proposedMethodology: "Evaluate retrieval ranking against citation and keyword similarity.",
  feasibility: "High",
  status: "Open",
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 7) Reports
db.reports.insertOne({
  projectId: projectId.toString(),
  title: "Demo Research Summary",
  reportContent: "This is a demo report generated for the ResearchLens project.",
  references: [paperId1.toString(), paperId2.toString()],
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 8) Citation
db.citations.insertOne({
  paperId: paperId1,
  citedPaperId: paperId2,
  style: "APA",
  formattedText: "Smith, A., Lee, B., & Patel, C. (2024). Adaptive Retrieval for Research Discovery. Example University.",
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 9) Annotation
db.annotations.insertOne({
  paperId: paperId1,
  page: 3,
  selectedText: "adaptive retrieval techniques",
  note: "Demo annotation for a key research statement.",
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 10) ResearchGap
db.researchgaps.insertOne({
  title: "Demo Research Gap",
  description: "Existing methods insufficiently combine retrieval scoring with evidence provenance validation.",
  category: "Methodological",
  strength: "Medium",
  projectId,
  supportingPaperIds: [paperId1, paperId2],
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date()
});

print("ResearchLens MongoDB schema and seed data setup completed successfully.");