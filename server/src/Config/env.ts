import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load server/.env relative to this file, regardless of the process working directory.
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const defaultGeminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const geminiModels = [...new Set((process.env.GEMINI_MODELS || `${defaultGeminiModel},gemini-3.5-flash-lite`)
  .split(',').map((model) => model.trim()).filter(Boolean))];

export const env = {
  port: Number(process.env.PORT) || 3001,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  corsOrigins: (process.env.CORS_ORIGIN || process.env.CLIENT_URL)?.split(',').map((origin) => origin.trim()).filter(Boolean),
  maxUploadMb: Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 25),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: geminiModels[0] || defaultGeminiModel,
  geminiModels,
  geminiRetryAttempts: Math.max(1, Math.min(5, Number(process.env.GEMINI_RETRY_ATTEMPTS) || 3)),
  geminiRetryBaseDelayMs: Math.max(0, Math.min(10_000, Number(process.env.GEMINI_RETRY_BASE_DELAY_MS) || 250)),
  geminiModelCooldownMs: Math.max(1_000, Math.min(300_000, Number(process.env.GEMINI_MODEL_COOLDOWN_MS) || 30_000)),
};
