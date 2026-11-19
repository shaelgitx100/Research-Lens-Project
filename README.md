# ResearchLens

ResearchLens is a research-intelligence prototype built with React, TypeScript, Express, and MongoDB. The running preview opens in **demo mode**. Dashboard figures and all example papers, authors, projects, questions, graph relationships, and trends are fictional illustrations, not academic evidence. Academic search results are labeled by source.

## Run locally

Requirements: Node.js 20+, npm, and (for persistent API operations) MongoDB.

```sh
npm install
npm install --prefix server
cp server/.env.example server/.env
# Set MONGODB_URI, a long random JWT_SECRET, and GEMINI_API_KEY in server/.env
# Set ADMIN_EMAIL to the account that should receive administrator access.
npm run dev
```

Open the Vite address printed in the terminal. Vite proxies `/api` to Express on port 3001. `npm run build` runs TypeScript validation and a production client build. `GET /api/health` reports database availability without exposing configuration.

## Implemented

- Responsive demo dashboard, project cards, paper library, graph, gap detail, questions, trends, comparison, review editor, report preview/print, scorecard weights, settings and global workspace search.
- Live academic discovery through OpenAlex, Semantic Scholar, Crossref, arXiv, CORE, PubMed and DOAJ via Express; Google Scholar searches open in a separate tab because Scholar has no official public search API. Semantic Scholar recommendations and citations/references are available where the API returns them. arXiv records are explicitly labeled preprints. CORE requires `CORE_API_KEY`; Semantic Scholar, NCBI and DOAJ credentials are optional and documented in `server/.env.example`.
- Citation Network reads owner-scoped saved publications, merges duplicate works by normalized DOI or provider-scoped identifiers, and enriches imports and PDF uploads using DOI or exact-title searches across OpenAlex, Semantic Scholar, Crossref, arXiv, and PubMed identifiers. Title matches require corroborating metadata; ambiguous candidates need researcher confirmation. Resolution status and provider citation/reference/citing-work provenance are persisted with retrieval timestamps. Directed links are built only from provider reference lists; fictional DEMO papers are excluded.
- Compare Literature accepts 2–6 owner-scoped saved papers and runs a Gemini comparison from their extracted PDF text or saved abstracts. It persists the comparison with its selected paper IDs, shows source-grounded analysis and exact quotations, and exports the generated result as JSON. Papers without sufficient source text are rejected with a clear request to add an abstract or upload/analyze the PDF; missing study details are not filled with fabricated values.
- Express/MongoDB endpoints for registration, login, profile customization, profile-picture upload, password reset, owner-scoped project CRUD, paper import and retrieval, PDF upload/text extraction, Gemini-powered paper analysis and research features (summary, methodology, literature review, gaps, questions, hypotheses, proposal, citation analysis, PDF analysis, and research assistant), saved questions, and report creation/retrieval. AI requests follow the route/controller/service/client/response-validation/MongoDB lifecycle documented in [docs/architecture.md](./docs/architecture.md). API authentication uses a Bearer token and requires a configured secret of at least 32 characters. Passwords and reset tokens are hashed. API operations requiring persistence return 503 when MongoDB is unavailable.
- Source metadata and missing information are preserved rather than invented. Demo relationships do not claim to be real citations.

## Prototype limitations

OCR for scanned PDFs, proof of research novelty, systematic-review completeness, full citation coverage beyond provider-returned metadata, complete filtering and pagination, user-managed evidence, notifications persistence, and report persistence from the UI remain limited. Compare Literature uses only the source text saved for selected papers and does not establish completeness of the literature; its AI interpretations and recommendations require researcher review. The citation graph links records in the saved library; external citing and referenced works are expanded when the selected provider exposes them. Gemini analysis can make mistakes: quotations are checked against the input text, but all interpretations and recommendations still need human review. Related-paper searches are exploratory rather than systematic. The engine does not conduct experiments, collect data, generate genuine findings, or submit academic work. Password reset delivery requires `PASSWORD_RESET_WEBHOOK_URL`; use an HTTPS email-provider webhook in production. There is no verified real-world evidence in the seeded examples. Do not use demo records in academic work. Production deployment still requires security review, accessible interaction review, rate-limit and session hardening, file retention/virus scanning, and a real database deployment.
