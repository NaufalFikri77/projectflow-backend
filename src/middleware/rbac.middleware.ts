import type { Role } from '@prisma/client';
import type { Context, Next } from 'hono';
import { ForbiddenError } from '../lib/errors.js';
import { type PermissionSet, getPermissions } from '../lib/permissions.js';

export function requireRole(...allowedRoles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    if (!allowedRoles.includes(user.role as Role)) {
      throw new ForbiddenError(`Role '${user.role}' is not authorized for this action`);
    }

    await next();
  };
}

export function requirePermission(permission: keyof PermissionSet) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    const permissions = getPermissions(user.role as Role);
    if (!permissions[permission]) {
      throw new ForbiddenError(`You do not have permission: ${permission}`);
    }

    await next();
  };
}
