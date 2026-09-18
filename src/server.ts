import { env } from './lib/env.js';
import app from './index.js';

console.log(`ProjectFlow Backend running on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};