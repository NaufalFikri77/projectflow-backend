import type { Context, Next } from 'hono';
import { type JwtPayload, verifyToken } from '../lib/auth';
import { UnauthorizedError } from '../lib/errors';
import { userRepository } from '../repositories/user.repository';

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    const user = await userRepository.findById(payload.userId);
    if (!user || (payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedError('Invalid or revoked token');
    }
    c.set('user', payload);
    await next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
