import { splitSentences, truncate } from '../Utils/text';

export interface Evidence { text: string; section?: string; page?: number; origin: 'sourceDerived' | 'userEdited' }
export interface AnalysisResult {
  researchObjective: Evidence[]; researchQuestions: Evidence[]; methodology: Evidence[]; datasets: Evidence[];
  findings: Evidence[]; limitations: Evidence[]; futureWork: Evidence[]; contributions: Evidence[];
  notExplicit: string[]; textBasis: 'abstract' | 'fullText';
  sourceReferences: { field: string; section?: string; page?: number; quote: string }[];
}

export const NOT_STATED = 'Not explicitly stated in the source.';
export const FIELDS = ['researchObjective', 'researchQuestions', 'methodology', 'datasets', 'findings', 'limitations', 'futureWork', 'contributions'] as const;
type FieldName = (typeof FIELDS)[number];

interface Sentence { text: string; section: string; page?: number }

const HEADING = /^(?:\d+(?:\.\d+)*\.?\s+)?(abstract|introduction|background|related work|methods?|methodology|materials and methods|approach|experiments?|experimental (?:setup|results)|results?(?: and discussion)?|evaluation|discussion|limitations?|conclusions?(?: and future work)?|future work|summary)\s*:?\s*$/i;

export function parseSentences(text: string, defaultSection = 'Abstract'): Sentence[] {
  const pages = text.split('\f');
  const paged = pages.length > 1;
  const out: Sentence[] = [];
  let section = defaultSection;
  pages.forEach((pageText, pi) => {
    let buffer: string[] = [];
    const flush = () => {
      if (!buffer.length) return;
      for (const s of splitSentences(buffer.join(' '))) out.push({ text: s, section, page: paged ? pi + 1 : undefined });
      buffer = [];
    };
    for (const raw of pageText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const h = line.length < 60 ? line.match(HEADING) : null;
      if (h) {
        flush();
        section = h[1].replace(/\b\w/g, (c) => c.toUpperCase());
      } else buffer.push(line);
    }
    flush();
  });
  return out;
}

interface Rule { cue: RegExp; prefer: RegExp; max: number; sectionOnly?: RegExp }

const RULES: Record<FieldName, Rule> = {
  researchObjective: { cue: /\b(this (paper|study|work|article|thesis|research)|we (aim|investigate|study|examine|explore|address|propose|present|ask)|the (aim|goal|objective|purpose) of)\b/i, prefer: /abstract|introduction/i, max: 2 },
  researchQuestions: { cue: /\?\s*$|\bresearch questions?\b|\bRQ\d\b|\bhypothes[ie]s\b|\bwe ask\b/i, prefer: /introduction|abstract/i, max: 3 },
  methodology: { cue: /\b(we (use|used|employ|employed|apply|applied|adopt|adopted|train|trained|evaluate|evaluated|conduct|conducted|implement|implemented|compare|compared)|methodology|approach|framework|algorithm|experiment(al)?|simulation|survey|interview|regression|user study|benchmark)\b/i, prefer: /method|approach|experiment|evaluation/i, max: 4 },
  datasets: { cue: /\b(data ?sets?|corpus|corpora|benchmarks?|participants|cohort|collected from|samples? (of|from))\b/i, prefer: /method|experiment|evaluation|results/i, max: 3 },
  findings: { cue: /\b(results? (show|indicate|reveal|suggest|demonstrate)|we (find|found|observe|observed|show|showed|demonstrate|demonstrated)|outperform\w*|significantly|improv(e|ed|es|ement)|reveal(s|ed)?|indicate(s|d)?|degrad\w+|differ\w*)\b/i, prefer: /results|abstract|conclusion|discussion/i, max: 4 },
  limitations: { cue: /\b(limitations?|limited (to|by)|restricted to|does not|do not|cannot|can not|did not|only (evaluated|tested|considered|used)|small (sample|dataset)|not (been )?(evaluated|studied|investigated|considered|isolated)|beyond the scope|caveat|weakness|fail(s|ed)? to|lacks?)\b/i, prefer: /limitation|discussion|conclusion/i, max: 5 },
  futureWork: { cue: /\b(future (work|research|studies|directions?)|in (the )?future|we plan|remains? (to be|an open)|should (explore|investigate|examine|study|address|compare|extend|evaluate|enforce|link|expand|establish|test|measure|assess|build)|will (explore|investigate|examine)|open (question|problem))\b/i, prefer: /future|conclusion|discussion/i, max: 4 },
  contributions: { cue: /\b(contributions?|we (propose|introduce|present|develop)|novel|first (to|study)|this (paper|work) (propose|introduce|present)s?)\b/i, prefer: /introduction|abstract|conclusion/i, max: 3 },
};

export function analyzeText(text: string, basis: 'abstract' | 'fullText' = 'abstract'): AnalysisResult {
  const sentences = parseSentences(text, basis === 'abstract' ? 'Abstract' : 'Front matter');
  const result: any = { notExplicit: [] as string[], textBasis: basis, sourceReferences: [] as AnalysisResult['sourceReferences'] };

  for (const field of FIELDS) {
    const rule = RULES[field];
    const scored = sentences
      .map((s, i) => ({ s, i, score: (rule.cue.test(s.text) ? 1 : 0) + (rule.cue.test(s.text) && rule.prefer.test(s.section) ? 2 : 0) + (field === 'limitations' && /limitation/i.test(s.text) ? 2 : 0) }))
      .filter((x) => x.score > 0 && x.s.text.length < 700)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, rule.max)
      .sort((a, b) => a.i - b.i);
    const items: Evidence[] = scored.map(({ s }) => ({ text: s.text, section: s.section, page: s.page, origin: 'sourceDerived' }));
    result[field] = items;
    if (!items.length) result.notExplicit.push(field);
    for (const it of items) result.sourceReferences.push({ field, section: it.section, page: it.page, quote: truncate(it.text, 160) });
  }
  return result as AnalysisResult;
}
