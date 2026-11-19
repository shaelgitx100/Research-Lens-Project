import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './Config/env.js';
import { corsMiddleware } from './Config/cors.js';
import { connectDB, isDatabaseConnected } from './Config/db.js';
import apiRoutes from './routes/index.js';
import { errorMiddleware } from './Middleware/errorMiddleware.js';
import authRoutes from "./routes/auth.routes.js";

const app = express();
const port = env.port;

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

void connectDB(env.mongodbUri);

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  database: isDatabaseConnected() ? 'connected' : 'unavailable',
  gemini: env.geminiApiKey ? 'configured' : 'not configured',
}));
app.use('/api', apiRoutes);

app.use(errorMiddleware);

export default app;
