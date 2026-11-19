import { extractDatasetNames, matchFamilies, METRICS } from '../analysis/taxonomy';
import { uniq } from '../Utils/text';
import { Dimension, composite } from './scorecard';
import { GapCategory, GapPaper } from './types';

export interface GapLike {
  title: string; category: GapCategory; supportingPaperIds: string[]; meta: Record<string, string>;
  description: string; supportingEvidence: { excerpt: string }[];
  scorecard?: { dimensions: Dimension[] };
}
export interface QuestionDraft {
  question: string; motivation: string; supportingPaperIds: string[]; proposedMethodology: string; requiredDataset: string;
  evaluationMetrics: string[]; expectedContribution: string; feasibility: { level: 'High' | 'Medium' | 'Low'; explanation: string };
}

export const QUESTION_DISCLAIMER = 'Generated proposal. Requires human academic review before use.';

export function generateQuestions(gap: GapLike, topic: string, papers: GapPaper[]): QuestionDraft[] {
  const sup = papers.filter((p) => gap.supportingPaperIds.includes(p.id));
  const focus = gap.meta.focus || gap.title.toLowerCase();
  const t = topic || 'the research topic';

  let q: string[];
  switch (gap.category) {
    case 'methodology':
      q = [
        `Can ${gap.meta.minority} complement or replace ${gap.meta.dominant} in studies of ${t}, and how do the resulting conclusions differ?`,
        `How closely do ${gap.meta.minority} and ${gap.meta.dominant} agree when applied to the same models and datasets in ${t}?`,
      ];
      break;
    case 'contradiction':
      q = [
        `Under which conditions do studies of ${focus} report favorable versus unfavorable findings, and can a controlled replication reconcile them?`,
        `Which experimental factors explain the divergent findings on ${focus} within ${t}?`,
      ];
      break;
    case 'dataset':
      q = [
        `Do the findings reported in studies of ${t} still hold when evaluated on data that addresses ${focus}?`,
        `How should evaluation data for ${t} be constructed to reduce ${focus}?`,
      ];
      break;
    case 'model':
      q = [
        `How do existing approaches in ${t} behave under ${focus}, and does this change the reliability of reported results?`,
        `What evaluation design best isolates the effect of ${focus} on conclusions in ${t}?`,
      ];
      break;
    case 'futureWork':
      q = [
        `What is the effect of ${focus} on the outcomes studied in ${t}, as recommended by multiple authors?`,
        `Which study design would best operationalize ${focus} using resources already available in ${t} research?`,
      ];
      break;
    default:
      q = [
        `How does ${focus} affect the validity of conclusions reported in studies of ${t}, and can it be mitigated through a controlled design?`,
        `Which evaluation protocol best quantifies ${focus} across the datasets and models used in ${t} research?`,
      ];
  }

  const fams = uniq(
    sup.flatMap((p) => matchFamilies((p.analysis?.methodology || []).map((e) => e.text).join(' ')).map((m) => m.family.label))
  ).slice(0, 3);
  const datasets = uniq(sup.flatMap((p) => extractDatasetNames((p.analysis?.datasets || []).map((e) => e.text).join(' ')))).slice(0, 4);
  const corpus = sup.flatMap((p) => [...(p.analysis?.findings || []), ...(p.analysis?.methodology || [])]).map((e) => e.text).join(' ');
  const metrics = METRICS.filter((m) => m.re.test(corpus)).map((m) => m.label).slice(0, 4);

  const dims = gap.scorecard?.dimensions || [];
  const feas = dims.find((d) => d.key === 'feasibility')?.score ?? 0.5;
  const data = dims.find((d) => d.key === 'dataAvailability')?.score ?? 0.5;
  const f = (feas + data) / 2;
  const level = f >= 0.65 ? 'High' : f >= 0.45 ? 'Medium' : 'Low';
  const comp = dims.length ? composite(dims) : undefined;

  return q.map((question, i) => ({
    question,
    motivation: `${gap.description} The gap is supported by ${sup.length} analyzed paper${sup.length === 1 ? '' : 's'}.`,
    supportingPaperIds: gap.supportingPaperIds,
    proposedMethodology: fams.length
      ? `${i === 0 ? 'Controlled comparative study' : 'Replication with systematic variation'} building on: ${fams.join(', ')}.`
      : 'Controlled comparative study using methods reported in the supporting papers.',
    requiredDataset: datasets.length ? `Datasets named in supporting papers: ${datasets.join(', ')}.` : 'No dataset is named in the supporting papers. To be chosen by the researcher.',
    evaluationMetrics: metrics.length ? metrics : ['To be defined by the researcher'],
    expectedContribution: `Evidence on ${focus} that clarifies or extends the ${sup.length} supporting studies.`,
    feasibility: {
      level,
      explanation: `Based on heuristic feasibility and dataset availability scores${comp !== undefined ? ` (gap composite ${comp} of 100)` : ''}. ${QUESTION_DISCLAIMER}`,
    },
  }));
}
