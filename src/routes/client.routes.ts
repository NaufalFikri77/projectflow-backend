import { Hono } from 'hono';
import { buildSuccessResponse, parseQueryParams } from '../lib/query-helpers';
import { authMiddleware } from '../middleware/auth.middleware';
import { clientService } from '../services/client.service';

const clientDashboard = new Hono();

clientDashboard.use('*', authMiddleware);

// GET /api/client/projects
clientDashboard.get('/projects', async (c) => {
  const user = c.get('user');
  const query = parseQueryParams(c);
  const result = await clientService.getProjects(user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

// GET /api/client/projects/:id
clientDashboard.get('/projects/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const project = await clientService.getProjectDetail(id, user);
  return c.json(buildSuccessResponse(project));
});

// GET /api/client/projects/:id/tasks
clientDashboard.get('/projects/:id/tasks', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');
  const query = parseQueryParams(c);
  const result = await clientService.getProjectTasks(projectId, user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

export { clientDashboard as clientRoutes };
