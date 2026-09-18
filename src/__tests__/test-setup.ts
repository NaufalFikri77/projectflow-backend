// Test setup - creates Hono app for testing without starting server
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from '../middleware/error-handler.js';
import { auditRoutes } from '../routes/audit.routes.js';
import { authRoutes } from '../routes/auth.routes.js';
import { clientRoutes } from '../routes/client.routes.js';
import { projectRoutes } from '../routes/project.routes.js';
import { taskRoutes } from '../routes/task.routes.js';

export const app = new Hono();

app.use('*', cors());
app.use('*', errorHandler);

app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/audit-logs', auditRoutes);
app.route('/api/client', clientRoutes);

/**
 * Helper to login and get token
 */
export async function loginAs(email: string, password = 'password123') {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { data?: { token?: string } };
  return data.data?.token as string;
}

export async function authHeaders(email: string) {
  const token = await loginAs(email);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
