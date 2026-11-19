import { describe, expect, it } from 'vitest';
import {
  formatReportReferences, renderReportMarkdown, reportGenerationSchema,
  isReportGenerationStale, reportOutline, validateGeneratedReport, type GeneratedReport,
} from '../reports/reportGeneration.js';

const paperId = '0123456789abcdef01234567';
const validReport: GeneratedReport = {
  executiveSummary: 'A summary based on the stored publications.',
  executiveSummaryClaims: [],
  sections: reportOutline('project').map((heading) => ({
    heading,
    content: 'Not reported in the supplied sources.',
    claims: [],
  })),
};

describe('research report output validation', () => {
  it('treats missing or ten-minute-old generation leases as stale', () => {
    const now = Date.now();
    expect(isReportGenerationStale(new Date(now - 9 * 60_000), now)).toBe(false);
    expect(isReportGenerationStale(new Date(now - 10 * 60_000), now)).toBe(true);
    expect(isReportGenerationStale(undefined, now)).toBe(true);
  });

  it('rejects malformed structure and evidence that names an unselected paper', () => {
    expect(reportGenerationSchema.safeParse({ ...validReport, unexpected: true }).success).toBe(false);
    const report = structuredClone(validReport);
    report.sections[0].claims = [{
      statement: 'A finding.',
      kind: 'source-derived',
      sourcePaperIds: ['fedcba9876543210fedcba98'],
      sourceLocations: [],
    }];
    expect(() => validateGeneratedReport(report, 'project', [paperId])).toThrow(/outside the selected source set/);
  });

  it('requires source IDs for derived claims and enforces the category outline', () => {
    const report = structuredClone(validReport);
    report.sections[0].claims = [{ statement: 'An interpretation.', kind: 'interpretation', sourcePaperIds: [], sourceLocations: [] }];
    expect(() => validateGeneratedReport(report, 'project', [paperId])).toThrow(/must identify source paper IDs/);
    expect(() => validateGeneratedReport(validReport, 'findings', [paperId])).toThrow(/requested outline/);
  });

  it('renders labels, source IDs, citation markers, and preserved DOI references', () => {
    const report = structuredClone(validReport);
    report.sections[0].claims = [
      { statement: 'A reported finding.', kind: 'source-derived', sourcePaperIds: [paperId], sourceLocations: [] },
      { statement: 'An interpretation.', kind: 'interpretation', sourcePaperIds: [paperId], sourceLocations: [] },
      { statement: 'No sample size was reported.', kind: 'absent-evidence', sourcePaperIds: [], sourceLocations: [] },
    ];
    const references = formatReportReferences([{
      paperId, title: 'Saved study', authors: ['A. Researcher'], publicationYear: 2024,
      doi: '10.1234/example', identifiers: { openAlexId: 'W123' },
    }], 'APA');
    const markdown = renderReportMarkdown(report, references, [paperId]);
    expect(markdown).toContain('**Source-derived:** A reported finding. [1]');
    expect(markdown).toContain(`Source paper IDs: ${paperId}`);
    expect(markdown).toContain('**AI interpretation:**');
    expect(markdown).toContain('**Absent evidence:**');
    expect(markdown).toContain('https://doi.org/10.1234/example');
    expect(markdown).toContain('openAlexId: W123');
  });

  it('preserves only saved page or section references on claims', () => {
    const report = structuredClone(validReport);
    report.sections[0].claims = [{
      statement: 'A finding with a saved location.',
      kind: 'source-derived',
      sourcePaperIds: [paperId],
      sourceLocations: [{ paperId, reference: 'pp. 7–8, Results' }],
    }];
    const savedLocations = new Map([[paperId, ['pp. 7–8, Results']]]);
    expect(() => validateGeneratedReport(report, 'project', [paperId])).toThrow(/not present in the saved source data/);
    expect(() => validateGeneratedReport(report, 'project', [paperId], savedLocations)).not.toThrow();
    expect(renderReportMarkdown(report, [], [paperId])).toContain('Source locations: 1 · pp. 7–8, Results');
  });
});
