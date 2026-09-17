import { Hono } from 'hono';
import { buildSuccessResponse, parseQueryParams } from '../lib/query-helpers';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  addDependencySchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../schemas/task.schema';
import { attachmentService } from '../services/attachment.service';
import { auditService } from '../services/audit.service';
import { dependencyService } from '../services/dependency.service';
import { taskService } from '../services/task.service';

const tasks = new Hono();

// All task routes require authentication
tasks.use('*', authMiddleware);

// ==================== TASK CRUD ====================

// GET /api/tasks
tasks.get('/', async (c) => {
  const user = c.get('user');
  const query = parseQueryParams(c);
  const result = await taskService.list(user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

// GET /api/tasks/:id
tasks.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const task = await taskService.getById(id, user);
  return c.json(buildSuccessResponse(task));
});

// POST /api/tasks
tasks.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const input = createTaskSchema.parse(body);
  const task = await taskService.create(input, user);
  return c.json(buildSuccessResponse(task), 201);
});

// PUT /api/tasks/:id
tasks.put('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const input = updateTaskSchema.parse(body);
  const task = await taskService.update(id, input, user);
  return c.json(buildSuccessResponse(task));
});

// PATCH /api/tasks/:id/status
tasks.patch('/:id/status', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const input = updateTaskStatusSchema.parse(body);
  const task = await taskService.updateStatus(id, input, user);
  return c.json(buildSuccessResponse(task));
});

// DELETE /api/tasks/:id
tasks.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await taskService.delete(id, user);
  return c.json(buildSuccessResponse({ message: 'Task deleted successfully' }));
});

// ==================== DEPENDENCIES ====================

// GET /api/tasks/:id/dependencies
tasks.get('/:id/dependencies', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const deps = await dependencyService.getTaskDependencies(id, user);
  return c.json(buildSuccessResponse(deps));
});

// POST /api/tasks/:id/dependencies
tasks.post('/:id/dependencies', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const body = await c.req.json();
  const input = addDependencySchema.parse(body);
  const dep = await dependencyService.addDependency(taskId, input.dependsOnTaskId, user);
  return c.json(buildSuccessResponse(dep), 201);
});

// DELETE /api/tasks/:id/dependencies/:depId
tasks.delete('/:id/dependencies/:depId', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const depId = c.req.param('depId');
  await dependencyService.removeDependency(depId, user, taskId);
  return c.json(buildSuccessResponse({ message: 'Dependency removed successfully' }));
});

// ==================== ATTACHMENTS ====================

// GET /api/tasks/:id/attachments
tasks.get('/:id/attachments', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const attachments = await attachmentService.getByTaskId(taskId, user);
  return c.json(buildSuccessResponse(attachments));
});

// POST /api/tasks/:id/attachments
tasks.post('/:id/attachments', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'A file is required' } },
      422,
    );
  }

  const attachment = await attachmentService.upload(taskId, file, user);
  return c.json(buildSuccessResponse(attachment), 201);
});

// GET /api/attachments/:id/download
tasks.get('/attachments/:id/download', async (c) => {
  const user = c.get('user');
  const attachmentId = c.req.param('id');
  const storedName = c.req.query('file');
  if (!storedName || storedName.includes('/') || storedName.includes('\\')) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
      404,
    );
  }
  const filePath = await attachmentService.getDownload(attachmentId, storedName, user);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Attachment file not found' } },
      404,
    );
  }
  return new Response(file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${attachmentId}"`,
    },
  });
});

// DELETE /api/attachments/:id
tasks.delete('/attachments/:id', async (c) => {
  const user = c.get('user');
  const attachmentId = c.req.param('id');
  await attachmentService.delete(attachmentId, user);
  return c.json(buildSuccessResponse({ message: 'Attachment deleted successfully' }));
});

// ==================== AUDIT LOGS ====================

// GET /api/tasks/:id/audit-logs
tasks.get('/:id/audit-logs', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const query = parseQueryParams(c);
  const result = await auditService.getByTaskId(taskId, user, query);
  return c.json(buildSuccessResponse(result.data, result.meta));
});

export { tasks as taskRoutes };
