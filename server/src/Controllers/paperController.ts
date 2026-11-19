import { asyncHandler } from '../Utils/asyncHandler.js';
import { paperSchema } from '../Validators/paperValidator.js';
import { createPaper, getPaper, listPapers } from '../Services/paperService.js';
import { extractPdfText } from '../Services/pdfService.js';
import { Paper } from '../model/index.js';

export const list = asyncHandler(async (req, res) => res.json({ items: await listPapers(req.userId!, Number(req.query.page) || 1) }));
export const create = asyncHandler(async (req, res) => res.status(201).json(await createPaper(req.userId!, paperSchema.parse(req.body))));
export const get = asyncHandler(async (req, res) => {
  const paper = await getPaper(req.userId!, req.params.id);
  return paper ? res.json(paper) : res.status(404).json({ error: 'Paper not found.' });
});
export const uploadPdf = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a PDF file to upload.' });
  const extracted = await extractPdfText(req.file.buffer);
  const paper = await Paper.create({ title: String(req.body.title || req.file.originalname).slice(0, 500), authors: [], source: 'PDF upload', fileName: req.file.originalname, extractedText: extracted.text, ownerId: req.userId });
  return res.status(201).json({ paper, pages: extracted.pages });
});
