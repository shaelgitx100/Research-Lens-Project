import { AppError } from '../../Utils/AppError.js';
import type { z } from 'zod';

/** Parse JSON model output and validate it against the requested runtime schema. */
export function parseStructuredResponse<T>(text: string | undefined, schema: z.ZodType<T>, label = 'AI response'): T {
  if (!text?.trim()) throw new AppError(502, `Gemini returned an empty ${label}. Please try again.`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new AppError(502, `Gemini returned unreadable ${label}. Please try again.`);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) throw new AppError(502, `Gemini returned ${label} in an unexpected format. Please try again.`);
  return parsed.data;
}
