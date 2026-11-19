import { describe, expect, it } from 'vitest';
import { isValidEditorDocument, sourceContainsEvidenceQuote } from '../Services/literatureReviewWorkspaceService.js';

describe('literature review editor document validation', () => {
  it('accepts supported rich-text blocks and formatting marks', () => {
    expect(isValidEditorDocument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Synthesis', marks: [{ type: 'bold' }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Evidence-based text.', marks: [{ type: 'italic' }, { type: 'underline' }] }] },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }] },
      ],
    })).toBe(true);
  });

  describe('literature synthesis source passage validation', () => {
    it('matches exact source passages independent of case and line wrapping', () => {
      expect(sourceContainsEvidenceQuote(
        'The paper reports a robust effect\nacross the evaluated sample.',
        'ROBUST effect across the evaluated sample.',
      )).toBe(true);
    });

    it('rejects empty or unsupported passages', () => {
      expect(sourceContainsEvidenceQuote('Available source text.', 'A fabricated conclusion.')).toBe(false);
      expect(sourceContainsEvidenceQuote('Available source text.', '   ')).toBe(false);
    });
  });

  it('rejects unsupported nodes, attributes, and malformed editor documents', () => {
    expect(isValidEditorDocument({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/image' } }] })).toBe(false);
    expect(isValidEditorDocument({ type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }] })).toBe(false);
    expect(isValidEditorDocument({ type: 'doc', content: [{ type: 'text', text: 'unsafe', marks: [{ type: 'bold', attrs: { style: 'color:red' } }] }] })).toBe(false);
    expect(isValidEditorDocument({ type: 'paragraph', content: [] })).toBe(false);
  });
});
