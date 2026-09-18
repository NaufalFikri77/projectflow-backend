import app from './index.js';
import { env } from './lib/env.js';

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`ProjectFlow Backend running on port ${server.port}`);
