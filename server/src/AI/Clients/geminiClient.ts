import { getGeminiClient } from '../../Config/gemini.js';
import { AppError } from '../../Utils/AppError.js';
import { paperAnalysisResponseSchema, paperAnalysisSchema, type PaperAnalysisResult } from '../Types/analysis.types.js';
import type { PaperAnalysisInput } from '../Types/paper.types.js';
import { buildPaperAnalysisPrompt } from '../Prompts/paperAnalysis.prompt.js';
import { RESEARCH_ASSISTANT_SYSTEM_PROMPT } from '../Prompts/system.prompt.js';
import { validateEvidenceQuotes } from '../Utils/evidenceValidator.js';
import { parseStructuredResponse } from '../Utils/responseParser.js';
import { generateWithGeminiFallback, geminiErrorStatus } from './geminiRequest.js';

export async function generatePaperAnalysis(input: PaperAnalysisInput): Promise<{ analysis: PaperAnalysisResult; model: string }> {
  try {
    const { result: response, model } = await generateWithGeminiFallback((model) => getGeminiClient().models.generateContent({
      model,
      contents: buildPaperAnalysisPrompt(input),
      config: {
        systemInstruction: RESEARCH_ASSISTANT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: paperAnalysisResponseSchema,
        temperature: 0.2,
        maxOutputTokens: 5000,
      },
    }));

    const parsed = parseStructuredResponse(response.text, paperAnalysisSchema, 'paper analysis');
    return { analysis: validateEvidenceQuotes(parsed, input.sourceText), model };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const status = geminiErrorStatus(error);
    if (status === 429) throw new AppError(429, 'Gemini is rate limited. Please wait a moment and try again.');
    if (status === 401 || status === 403) throw new AppError(503, 'Gemini rejected its server credentials. Add a valid GEMINI_API_KEY to server/.env.');
    if ([500, 502, 503, 504].includes(status ?? 0)) throw new AppError(503, 'Gemini is temporarily unavailable due to high demand. Please try again in a moment.');
    console.error('Gemini paper analysis request failed.', { status: status || 'unknown' });
    throw new AppError(502, 'Gemini could not complete the paper analysis. Please try again.');
  }
}
