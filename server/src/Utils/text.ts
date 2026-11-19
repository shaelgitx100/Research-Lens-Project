export const STOP = new Set(
  ('a an the of and or to in on for with by from as at is are was were be been being this that these those it its we our their they them can may might could would should will not no nor but if then than so such also however which who whom whose into over under between among within without using used use based via per each other more most less least many much very only one two three both either has have had do does did there here when where while although though because since').split(' ')
);
export const FILLER = new Set(
  ('future work works research study studies paper papers approach approaches method methods result results show shows shown propose proposed present presented investigate analysis should need needs further additional remain remains likely').split(' ')
);

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '\u2026' : t;
}

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2 && !STOP.has(t)).map(stem);
}

/** Adjacent non stopword bigrams, with filler words excluded. */
export function bigrams(text: string): string[] {
  const raw = (text.toLowerCase().match(/[a-z0-9]+/g) || []).map(stem);
  const out: string[] = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const a = raw[i], b = raw[i + 1];
    if (a.length < 3 || b.length < 3) continue;
    if (STOP.has(a) || STOP.has(b) || FILLER.has(a) || FILLER.has(b)) continue;
    out.push(`${a} ${b}`);
  }
  return out;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(\[])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
