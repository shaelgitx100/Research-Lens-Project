# ResearchLens API

The API is mounted at `/api`. JSON requests should use `Content-Type: application/json`. Authenticated endpoints require `Authorization: Bearer <token>`. Tokens expire after eight hours.

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API, database, and Gemini configuration availability |

## Authentication

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ "name", "email", "password" }` | Create an account |
| POST | `/api/auth/login` | `{ "email", "password" }` | Sign in |
| GET | `/api/auth/me` | — | Read the signed-in account |

Registration and login return `{ token, user }`. Passwords must be at least eight characters. Configure `JWT_SECRET` with at least 32 characters.

## Research data

All endpoints below require a bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/api/projects` | List or create projects |
| GET | `/api/projects/:id` | Read a project |
| GET, POST | `/api/papers` | List or save papers |
| POST | `/api/papers/upload` | Upload a PDF as multipart field `file` |
| GET | `/api/papers/:id` | Read a saved paper |
| GET | `/api/papers/:id/analysis` | List paper analyses |
| POST | `/api/ai/papers/:paperId/analyze` | Analyze a saved paper with Gemini and save the structured result |
| POST | `/api/ai/features/:feature` | Run one of the ten saved-paper/project research tools and save the structured result |
| GET | `/api/ai/features/:feature` | List the signed-in user's 20 latest saved results for a feature |
| GET, POST | `/api/questions` | List or add research questions |
| GET, POST | `/api/reports` | List or create research reports |
| POST | `/api/reports/generate` | Generate a project literature report; body: `{ "projectId" }` |
| GET | `/api/reports/:id` | Read a report |
| GET, POST | `/api/citations` | List saved citations or format a paper citation; body: `{ "paperId", "style" }` |
| GET, POST | `/api/research-gaps` | List or create account-scoped research opportunities |

Errors use `{ "error": "...", "details": ... }` and an appropriate HTTP status. API-backed routes return `503` when MongoDB is unavailable.

## Gemini paper analysis

`POST /api/ai/papers/:paperId/analyze` requires a bearer token and a saved paper owned by the signed-in user. It analyzes extracted PDF text when available, otherwise the paper abstract. Source text is sent to Google Gemini; generated output is validated against a structured schema, quotations are checked against the supplied text, and the result is saved in MongoDB. The endpoint is limited to five requests per user per minute.

Configure `GEMINI_API_KEY` in `server/.env`. `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`. `GEMINI_MODELS` optionally sets a comma-separated priority list (default: `gemini-3.8-flash,gemini-3.5-flash-lite`). Requests retry transient 429/5xx errors with exponential backoff before switching models; `GEMINI_RETRY_ATTEMPTS`, `GEMINI_RETRY_BASE_DELAY_MS`, and `GEMINI_MODEL_COOLDOWN_MS` tune this behavior. Invalid credentials and malformed requests are returned without retry or model switching. Never put the key in client-side code or commit it to source control. Gemini output is a research aid; verify every claim against the original paper.

### Gemini research features

`POST /api/ai/features/:feature` requires a bearer token and accepts an optional `paperId`, `projectId`, `topic`, `question`, `context`, and recent `messages`. Paper and project identifiers are always resolved within the signed-in user's account. At least one context source is required. Valid feature names are `paper-summary`, `methodology`, `literature-review`, `research-gap`, `research-questions`, `hypothesis`, `research-proposal`, `citation-analysis`, `pdf-analysis`, and `research-assistant`. The response is schema-validated, evidence quotations are retained only when they exactly occur in the supplied context, and the result is saved with the owner, feature, Gemini model, and associated paper/project IDs. Requests share the five-per-minute per-user Gemini limit. PDF analysis requires extracted text from a saved PDF; literature synthesis uses only papers saved to the supplied project.

## Academic discovery

| Method | Path | Parameters | Purpose |
| --- | --- | --- | --- |
| GET | `/api/papers/search` | `provider`, `q`, `author`, `keywords`, `venue`, `yearFrom`, `yearTo`, `openAccess`, `page`, `perPage` | Search OpenAlex, Semantic Scholar, Crossref, arXiv, CORE, PubMed or DOAJ |
| GET | `/api/papers/recommendations` | `paperId` (Semantic Scholar paper ID) | Retrieve related-paper recommendations |
| POST | `/api/papers/import` | `{ "projectId", "papers": [...] }` | Save provider records with source and citation metadata |

CORE searches require `CORE_API_KEY`. `SEMANTIC_SCHOLAR_API_KEY` enables the authenticated API rate limit. NCBI E-utilities supports optional `NCBI_API_KEY`, `NCBI_EMAIL` and `NCBI_TOOL`; requests are paced to NCBI's published limits. arXiv requests are paced to avoid excess traffic. Google Scholar has no official public search API, so the discovery UI opens Scholar searches in a separate browser tab and does not scrape or import Scholar results. arXiv records are marked as preprints until publication elsewhere is independently verified.

Automated AI analysis endpoints have been removed. Academic discovery endpoints continue to use their listed scholarly data providers.
