import { getGeminiClient } from '../../Config/gemini.js';
import { AppError } from '../../Utils/AppError.js';
import { aiFeatureResultSchema, aiFeatureResponseSchema, type AiFeatureName, type AiFeatureResult } from '../Types/feature.types.js';
import { RESEARCH_ASSISTANT_SYSTEM_PROMPT } from '../Prompts/system.prompt.js';
import { PAPER_SUMMARY_PROMPT } from '../Prompts/summary.prompt.js';
import { RESEARCH_GAP_PROMPT } from '../Prompts/researchGap.prompt.js';
import { LITERATURE_REVIEW_PROMPT } from '../Prompts/literatureReview.prompt.js';
import { METHODOLOGY_PROMPT } from '../Prompts/methodology.prompt.js';
import { RESEARCH_QUESTION_PROMPT } from '../Prompts/researchQuestion.prompt.js';
import { parseStructuredResponse } from '../Utils/responseParser.js';
import { truncateToTokenBudget } from '../Utils/tokenCounter.js';
import { validateEvidenceQuotes } from '../Utils/evidenceValidator.js';
import type { AiFeatureGeneratedContent } from '../Types/ai.types.js';
import { generateWithGeminiFallback, geminiErrorStatus } from '../Clients/geminiRequest.js';

const instructions: Record<AiFeatureName, string> = {
  'paper-summary': PAPER_SUMMARY_PROMPT,
  methodology: METHODOLOGY_PROMPT,
  'literature-review': LITERATURE_REVIEW_PROMPT,
  'research-gap': RESEARCH_GAP_PROMPT,
  'research-questions': RESEARCH_QUESTION_PROMPT,
  hypothesis: 'Develop testable, directional or non-directional hypotheses from the supplied research question and context. State constructs and assumptions; do not invent evidence.',
  'research-proposal': 'Draft a structured research proposal with background, problem, objectives, questions, literature rationale, proposed method, ethics, feasibility, and limitations. Label suggestions as proposals.',
  'citation-analysis': 'Analyze only the citation and reference metadata provided. Describe visible citation patterns and missing metadata; do not claim external citation counts or influence.',
  'pdf-analysis': 'Analyze the extracted PDF text for document structure, research purpose, methods, results, limitations, and evidence. Mention extraction or OCR limitations if apparent.',
  'research-assistant': 'Answer the latest user research question using only supplied project/paper context and conversation. Clearly mark uncertainty and avoid fabricating references.',
  'literature-comparison': 'Compare only the supplied publications. Identify documented similarities, differences, conflicting findings, methods, data, limitations, and potential research gaps. For every comparison, name the paper(s) using the supplied Paper A/B labels. Distinguish source-reported facts from interpretation. Do not infer fields from publication titles, invent facts, or claim novelty. Missing information must be stated as not reported. Include concise exact quotes in evidence and say which paper each quote comes from. Use the requested section headings when present.',
};

export async function generateFeatureResult(feature: AiFeatureName, context: string): Promise<AiFeatureGeneratedContent> {
  try {
    const boundedContext = truncateToTokenBudget(context, 20_000);
    const prompt = `Feature: ${feature}\nInstructions: ${instructions[feature]}\n\nUse only the supplied context. For missing information say "Not reported in the supplied context." Evidence quotes must be exact substrings of that context. Return concise, structured academic output.\n\n<context>\n${boundedContext}\n</context>`;
    const { result: response, model } = await generateWithGeminiFallback((model) => getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: RESEARCH_ASSISTANT_SYSTEM_PROMPT, responseMimeType: 'application/json', responseSchema: aiFeatureResponseSchema, temperature: 0.2, maxOutputTokens: 5000 },
    }));
    const parsed = parseStructuredResponse(response.text, aiFeatureResultSchema, 'research result');
    return { result: validateEvidenceQuotes(parsed, boundedContext), model };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const status = geminiErrorStatus(error) ?? 0;
    if (status === 429) throw new AppError(429, 'Gemini is rate limited. Please wait and try again.');
    if (status === 401 || status === 403) throw new AppError(503, 'Gemini rejected server credentials. Configure GEMINI_API_KEY in server/.env.');
    if ([500, 502, 503, 504].includes(status)) throw new AppError(503, 'Gemini is temporarily unavailable due to high demand. Please try again in a moment.');
    console.error('Gemini feature request failed.', { feature, status: status || 'unknown' });
    throw new AppError(502, 'Gemini could not complete this request. Please try again.');
  }
}
