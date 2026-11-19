import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';
import { AppError } from '../Utils/AppError.js';

let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (!env.geminiApiKey) {
    throw new AppError(503, 'Gemini is not configured. Add GEMINI_API_KEY to server/.env and restart the API.');
  }
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

export function getGeminiModel(): string {
  return env.geminiModel;
}
