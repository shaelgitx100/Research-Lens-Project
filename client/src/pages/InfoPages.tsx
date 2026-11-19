import { Link } from 'react-router-dom';

const Wrap = ({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) => (
  <main className="mx-auto max-w-4xl px-4 py-14"><h1 className="text-4xl">{title}</h1><p className="mt-3 text-muted">{lead}</p><div className="mt-8 space-y-4">{children}</div><div className="mt-10"><Link to="/register" className="btnPrimary">Start Discovering</Link></div></main>
);
const Card = ({ t, d }: { t: string; d: string }) => <div className="card p-5"><h2 className="text-lg">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></div>;

export const About = () => (
  <Wrap title="About ResearchLens" lead="Transform scattered academic knowledge into structured research opportunities.">
    <Card t="Why it exists" d="Students and researchers struggle to find relevant papers, compare methods, notice repeated limitations and justify a research question with evidence. ResearchLens keeps that work in one traceable workspace." />
    <Card t="Who it is for" d="University students, undergraduate and graduate researchers, PhD candidates, supervisors, research groups and independent researchers." />
    <Card t="Academic integrity" d="Papers, authors, DOIs and citations are never invented. Retrieved metadata, source derived findings, AI generated interpretations and potential research gaps are always labeled separately, and every gap lists its supporting papers. Generated output needs human review." />
  </Wrap>
);
export const Features = () => (
  <Wrap title="Features" lead="One workflow from topic to report.">
    {[['Paper discovery', 'OpenAlex, Crossref and Semantic Scholar search with filters, manual import and PDF upload.'], ['Paper analysis', 'Eight structured fields with section and page references. Missing items are marked, never guessed.'], ['Research gap discovery', 'Limitation, methodology, dataset, model, contradiction and future work analysis with evidence pages.'], ['Opportunity scorecard', 'Six scored dimensions with explanations and adjustable weights. The formula is documented.'], ['Literature map and citation network', 'Interactive graphs with zoom, pan, search, filters and relationship descriptions.'], ['Trends, comparison, review builder and reports', 'Trend analytics that avoid unsupported claims, side by side comparison, themed reviews and printable reports with references from saved metadata.']].map(([t, d]) => <Card key={t} t={t} d={d} />)}
  </Wrap>
);
export const HowItWorks = () => (
  <Wrap title="How it works" lead="Eight steps from an idea to a defensible research direction.">
    {[['Create', 'Define a project, topic, objectives and keywords.'], ['Discover', 'Search and collect relevant publications.'], ['Analyze', 'Extract objectives, methods, findings, limitations and future work.'], ['Connect', 'Build the literature and citation graphs.'], ['Identify', 'Find potential gaps across the collection.'], ['Formulate', 'Generate evidence supported research questions.'], ['Evaluate', 'Prioritize opportunities with the scorecard.'], ['Report', 'Generate a structured report with traceable references.']].map(([t, d], i) => <Card key={t} t={`${i + 1}. ${t}`} d={d} />)}
  </Wrap>
);
