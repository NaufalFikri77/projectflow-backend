import app from './index.js';
import { env } from './lib/env.js';

console.log(`ProjectFlow Backend running on port ${env.PORT}`);

export default {
  hostname: '0.0.0.0',
  port: env.PORT,
  fetch: app.fetch,
};
