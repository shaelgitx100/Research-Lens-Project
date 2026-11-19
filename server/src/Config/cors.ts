import cors, { type CorsOptions } from 'cors';
import { env } from './env.js';

const options: CorsOptions = {
  origin: env.corsOrigins?.length ? env.corsOrigins : true,
  credentials: true,
};

export const corsMiddleware = cors(options);
