import { handle } from 'hono/vercel';
import { app } from '../src/index.js';

const honoHandler = handle(app);

export default (request: Request) => {
  const url = new URL(request.url);

  if (
    !url.pathname.startsWith('/api/') &&
    /^\/(auth|projects|tasks|audit-logs|client)(\/|$)/.test(url.pathname)
  ) {
    url.pathname = `/api${url.pathname}`;
  }

  return honoHandler(new Request(url, request));
};