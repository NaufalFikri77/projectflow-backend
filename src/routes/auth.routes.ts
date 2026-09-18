import { Hono } from 'hono';
import { buildSuccessResponse } from '../lib/query-helpers.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';

const auth = new Hono();

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const input = registerSchema.parse(body);
  const result = await authService.register(input);
  return c.json(buildSuccessResponse(result), 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const input = loginSchema.parse(body);
  const result = await authService.login(input);
  return c.json(buildSuccessResponse(result));
});

// POST /api/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user');
  await authService.logout(user.userId);
  return c.json(buildSuccessResponse({ message: 'Logged out successfully' }));
});

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const profile = await authService.getProfile(user.userId);
  return c.json(buildSuccessResponse(profile));
});

export { auth as authRoutes };
