const sectionTitles = [
  ['introduction', 'Introduction'],
  ['research-background', 'Research Background'],
  ['thematic-synthesis', 'Thematic Literature Synthesis'],
  ['methodological-analysis', 'Methodological Analysis'],
  ['comparative-discussion', 'Comparative Discussion'],
  ['research-limitations', 'Research Limitations'],
  ['research-gaps', 'Research Gaps'],
  ['conclusion', 'Conclusion'],
  ['references', 'References'],
] as const;

export const initialLiteratureReviewSections = sectionTitles.map(([id, title]) => ({
  id,
  title,
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
}));

const nodeTypes = new Set([
  'doc', 'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem',
  'table', 'tableRow', 'tableCell', 'tableHeader', 'text', 'hardBreak', 'horizontalRule',
]);
const markTypes = new Set(['bold', 'italic', 'underline', 'strike', 'code']);
const attrsByNode: Record<string, string[]> = {
  heading: ['level'],
  orderedList: ['start'],
  tableCell: ['colspan', 'rowspan', 'colwidth'],
  tableHeader: ['colspan', 'rowspan', 'colwidth'],
};

export function sourceContainsEvidenceQuote(sourceText: string, quote: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const normalizedQuote = normalize(quote);
  return normalizedQuote.length > 0 && normalize(sourceText).includes(normalizedQuote);
}

export function isValidEditorDocument(value: unknown): boolean {
  let nodeCount = 0;
  let textLength = 0;
  const visit = (node: unknown, depth: number): boolean => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 24 || ++nodeCount > 20000) return false;
    const record = node as Record<string, unknown>;
    const nodeType = record.type;
    if (typeof nodeType !== 'string' || !nodeTypes.has(nodeType)) return false;
    if (Object.keys(record).some((key) => !['type', 'attrs', 'content', 'text', 'marks'].includes(key))) return false;
    if (record.attrs !== undefined) {
      if (!record.attrs || typeof record.attrs !== 'object' || Array.isArray(record.attrs)) return false;
      const attrs = record.attrs as Record<string, unknown>;
      if (Object.keys(attrs).some((key) => !(attrsByNode[nodeType] || []).includes(key))) return false;
      if (nodeType === 'heading' && ![1, 2, 3].includes(attrs.level as number)) return false;
      if (nodeType === 'orderedList' && (!Number.isInteger(attrs.start) || Number(attrs.start) < 1)) return false;
      if (['tableCell', 'tableHeader'].includes(nodeType)) {
        if (attrs.colspan !== undefined && (!Number.isInteger(attrs.colspan) || Number(attrs.colspan) < 1 || Number(attrs.colspan) > 20)) return false;
        if (attrs.rowspan !== undefined && (!Number.isInteger(attrs.rowspan) || Number(attrs.rowspan) < 1 || Number(attrs.rowspan) > 20)) return false;
        if (attrs.colwidth !== undefined && attrs.colwidth !== null && (!Array.isArray(attrs.colwidth) || attrs.colwidth.length > 20 || attrs.colwidth.some((width) => width !== null && (!Number.isInteger(width) || Number(width) < 1 || Number(width) > 2000)))) return false;
      }
    }
    if (nodeType === 'text') {
      if (typeof record.text !== 'string' || record.text.length > 100000 || record.content !== undefined) return false;
      textLength += record.text.length;
      if (textLength > 500000) return false;
      if (record.marks !== undefined) {
        if (!Array.isArray(record.marks) || record.marks.length > 5) return false;
        for (const mark of record.marks) {
          if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return false;
          const item = mark as Record<string, unknown>;
          if (Object.keys(item).some((key) => key !== 'type') || typeof item.type !== 'string' || !markTypes.has(item.type)) return false;
        }
      }
      return true;
    }
    if (record.text !== undefined || record.marks !== undefined) return false;
    if (record.content !== undefined) {
      if (!Array.isArray(record.content) || record.content.length > 10000) return false;
      return record.content.every((child) => visit(child, depth + 1));
    }
    return !['doc', 'table', 'tableRow', 'tableCell', 'tableHeader', 'bulletList', 'orderedList', 'listItem'].includes(nodeType);
  };
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
    && (value as Record<string, unknown>).type === 'doc'
    && visit(value, 0)
    && textLength <= 500000,
  );
}
