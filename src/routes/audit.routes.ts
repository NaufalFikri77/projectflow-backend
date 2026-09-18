import { Hono } from 'hono';
import { buildSuccessResponse, parseQueryParams } from '../lib/query-helpers.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { auditService } from '../services/audit.service.js';

const auditLogs = new Hono();

auditLogs.use('*', authMiddleware);

// GET /api/audit-logs
auditLogs.get('/', async (c) => {
  const user = c.get('user');
  const query = parseQueryParams(c);
  const result = await auditService.list(user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

export { auditLogs as auditRoutes };
