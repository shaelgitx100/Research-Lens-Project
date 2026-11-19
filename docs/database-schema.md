# ResearchLens database schema

MongoDB collections are created from Mongoose models in `server/src/model/index.ts`. Models use timestamps unless stated otherwise. Account-owned documents carry `ownerId` and API queries scope records to that account.

| Model | Main fields | Relationships and indexes |
| --- | --- | --- |
| `User` | name, email, passwordHash, role | Unique email; password hash is never returned from account endpoints |
| `Project` | title, topic, description, objectives, keywords, domain, status | `ownerId` indexed |
| `Paper` | title, authors, abstract, publicationYear, venue, DOI, source, keywords, URL, notes, extractedText | `ownerId` and `projectId` indexed |
| `Analysis` | paperId, researchObjective, methodology, datasets, findings, limitations, futureWork, contributions, confidence | `ownerId` and `paperId` indexed |
| `Question` | question, motivation, relatedGapId, supportingPaperIds, proposedMethodology, feasibility, status | `ownerId` indexed |
| `Report` | projectId, title, reportContent, references | `ownerId` indexed |

Feature model modules also define `Citation`, `Annotation`, and `ResearchGap`. Keep these documents owner-scoped in API queries and avoid exposing extracted PDF text in list endpoints unless needed.

## Data notes

- MongoDB ObjectIds are used for users, projects, papers, and analyses.
- A paper can be manually added or associated with an uploaded PDF. Extracted PDF text is capped at 500,000 characters.
- Publication metadata from external indexes should retain its source and identifier so researchers can verify records against the original provider.
- Research gaps and AI-generated content are suggestions, not evidence of novelty. Persist supporting references when implementing automated gap analysis.
