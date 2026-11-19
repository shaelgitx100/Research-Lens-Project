type EvidenceItem = { quote: string };
type EvidenceValidatable = {
  evidence: EvidenceItem[];
  evidenceLimits?: string[];
  limitations?: unknown;
};

export function validateEvidenceQuotes<T extends EvidenceValidatable>(analysis: T, sourceText: string): T {
  const verified = analysis.evidence.filter(({ quote }) => sourceText.includes(quote.trim()));
  const rejectedCount = analysis.evidence.length - verified.length;
  const validated = { ...analysis, evidence: verified };

  if ('evidenceLimits' in analysis) {
    const evidenceLimits = [...(analysis.evidenceLimits || [])];
    if (rejectedCount > 0) evidenceLimits.unshift(`${rejectedCount} generated quotation(s) did not exactly match the supplied text and were removed.`);
    if (analysis.evidence.length > 0 && verified.length === 0) {
      evidenceLimits.unshift('No generated quotation passed exact source-text verification. Check the paper directly before relying on any finding.');
    }
    return { ...validated, evidenceLimits: evidenceLimits.slice(0, 8) } as T;
  }

  if (Array.isArray(analysis.limitations) && rejectedCount > 0) {
    const limitations = [...analysis.limitations, `${rejectedCount} quotation(s) were removed because they did not exactly match the supplied text.`];
    return { ...validated, limitations: limitations.slice(0, 10) } as T;
  }
  return validated as T;
}
