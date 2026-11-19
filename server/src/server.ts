import app from './app.js';
import { env } from './Config/env.js';

app.listen(env.port, '0.0.0.0', () => console.log(`ResearchLens API listening on ${env.port}`));