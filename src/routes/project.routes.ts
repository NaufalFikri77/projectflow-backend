import { Hono } from 'hono';
import { buildSuccessResponse, parseQueryParams } from '../lib/query-helpers.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  addMemberSchema,
  createProjectSchema,
  updateProjectSchema,
} from '../schemas/project.schema.js';
import { projectService } from '../services/project.service.js';

const projects = new Hono();

// All project routes require authentication
projects.use('*', authMiddleware);

// GET /api/projects
projects.get('/', async (c) => {
  const user = c.get('user');
  const query = parseQueryParams(c);
  const result = await projectService.list(user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

// GET /api/projects/internal-candidates
projects.get('/internal-candidates', async (c) => {
  const user = c.get('user');
  const candidates = await projectService.getInternalCandidates(user);
  return c.json(buildSuccessResponse(candidates));
});

// GET /api/projects/:id
projects.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const project = await projectService.getById(id, user);
  return c.json(buildSuccessResponse(project));
});

// POST /api/projects
projects.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const input = createProjectSchema.parse(body);
  const project = await projectService.create(input, user);
  return c.json(buildSuccessResponse(project), 201);
});

// PUT /api/projects/:id
projects.put('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const input = updateProjectSchema.parse(body);
  const project = await projectService.update(id, input, user);
  return c.json(buildSuccessResponse(project));
});

// DELETE /api/projects/:id
projects.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await projectService.delete(id, user);
  return c.json(buildSuccessResponse({ message: 'Project deleted successfully' }));
});

// POST /api/projects/:id/members
projects.post('/:id/members', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');
  const body = await c.req.json();
  const input = addMemberSchema.parse(body);
  const member = await projectService.addMember(projectId, input.userId, user);
  return c.json(buildSuccessResponse(member), 201);
});

// DELETE /api/projects/:id/members/:userId
projects.delete('/:id/members/:userId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');
  const userId = c.req.param('userId');
  await projectService.removeMember(projectId, userId, user);
  return c.json(buildSuccessResponse({ message: 'Member removed successfully' }));
});

export { projects as projectRoutes };
