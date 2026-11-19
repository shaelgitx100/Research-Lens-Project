import { PDFParse } from 'pdf-parse';

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.trim().slice(0, 500_000);
    if (!text) throw Object.assign(new Error('No selectable text found. Scanned PDFs require OCR.'), { status: 422 });
    return { text, pages: result.total };
  } finally { await parser.destroy(); }
}
