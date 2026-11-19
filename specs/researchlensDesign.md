# ResearchLens Technical Design

## Acceptance criteria
1. A user can register, log in, and reach a protected dashboard.
2. A user can create a project, search OpenAlex, Crossref or Semantic Scholar, import records, or upload a PDF.
3. Paper analysis extracts objective, questions, methodology, datasets, findings, limitations, future work and contributions with section and page references. Missing items read "Not explicitly stated in the source."
4. Gap discovery compares analyzed papers and produces gaps with supporting papers, excerpts, reasoning, evidence strength and a coverage indicator.
5. Questions, scorecard, knowledge graph, citation network, trends, comparison, review builder and reports all derive from stored records only.
6. Every seeded record is flagged DEMO and can be removed in one action.

## Three perspectives
Frontend: React, TypeScript, Tailwind, dark first theme, custom SVG charts and graph, debounced search, pagination, loading, error and empty states, escaped markdown rendering (no raw HTML injection).
Backend: Express and Mongoose. Controllers stay thin. Business logic lives in analysis, discovery, mapping, reports and services. External metadata is reached only through integrations.
Security: see the checkpoint below.

## Security checkpoint (completed before coding)
1. Authentication: bcrypt hashes (cost 12), JWT in an httpOnly SameSite cookie, generic login errors, dummy hash compare for unknown emails.
2. Authorization: every query is scoped by ownerId. Identifiers from the client are validated as ObjectIds.
3. Input validation: zod on body, query and params. Unknown fields are stripped. Mongo operator keys are removed by a sanitizer.
4. Output encoding: the client never uses dangerouslySetInnerHTML. Markdown is parsed into React elements and only http(s) links are allowed.
5. CSRF: cookie authenticated mutating requests must carry an Origin equal to CLIENT_ORIGIN.
6. Rate limiting: a global limiter plus a strict limiter on auth routes.
7. Uploads: PDF only, size capped, magic byte check, page cap, parse timeout, memory storage (never written to disk).
8. Secrets: environment only, validated at boot, never returned in responses. Password hashes and reset tokens are excluded from queries by default.
9. Errors: one handler, no stack traces in production, security events logged.
10. Password reset: random token, only its SHA256 hash stored, one hour expiry. With no email provider configured the link is written to the server log in development only.

## Academic integrity rules enforced in code
Retrieved metadata is never invented. Analysis items carry origin labels (sourceDerived, userEdited). Gaps are labeled potential until a researcher verifies them. Every gap states its coverage (supporting papers out of analyzed papers) and a caveat that absence in a collected set is not absence in the literature. Scores are heuristic, and the composite formula is documented and adjustable.

## Data model
User, ResearchProject, Paper, PaperAnalysis, ResearchGap, ResearchQuestion, KnowledgeNode, KnowledgeEdge, ResearchReport, plus LiteratureReview and Notification.
