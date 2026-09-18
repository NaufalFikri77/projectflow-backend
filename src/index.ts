import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { auditRoutes } from './routes/audit.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { clientRoutes } from './routes/client.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { taskRoutes } from './routes/task.routes.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
app.use('*', errorHandler);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/audit-logs', auditRoutes);
app.route('/api/client', clientRoutes);

// API info
app.get('/api', (c) =>
  c.json({
    name: 'ProjectFlow API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      tasks: '/api/tasks',
      auditLogs: '/api/audit-logs',
      client: '/api/client',
    },
  }),
);

// 404 handler
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    },
    404,
  ),
);

console.log(`🚀 ProjectFlow Backend running on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};

export { app };
