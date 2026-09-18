import type { Prisma, Role } from '@prisma/client';
import type { JwtPayload } from '../lib/auth.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { getPermissions } from '../lib/permissions.js';
import { type QueryParams, buildPaginationMeta } from '../lib/query-helpers.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { taskRepository } from '../repositories/task.repository.js';

export class AuditService {
  async getByTaskId(taskId: string, currentUser: JwtPayload, query: QueryParams) {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task');
    }

    // Only PM can view audit logs
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canViewAuditLog) {
      throw new ForbiddenError('You do not have permission to view audit logs');
    }

    const { data, total } = await auditRepository.findByTaskId(taskId, {
      skip: query.pagination.skip,
      take: query.pagination.limit,
    });

    return {
      data,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }

  async list(currentUser: JwtPayload, query: QueryParams) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canViewAuditLog) {
      throw new ForbiddenError('You do not have permission to view audit logs');
    }

    const where: Prisma.AuditLogWhereInput = {};

    if (query.filters.taskId) {
      where.taskId = query.filters.taskId as string;
    }
    if (query.filters.userId) {
      where.userId = query.filters.userId as string;
    }
    if (query.filters.action) {
      where.action = query.filters.action as string;
    }

    if (query.search) {
      where.OR = [
        { changedColumn: { contains: query.search, mode: 'insensitive' } },
        { oldValue: { contains: query.search, mode: 'insensitive' } },
        { newValue: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { data, total } = await auditRepository.findMany({
      where,
      skip: query.pagination.skip,
      take: query.pagination.limit,
      orderBy: {
        [query.sort.sortBy]: query.sort.sortOrder,
      } as Prisma.AuditLogOrderByWithRelationInput,
    });

    return {
      data,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }
}

export const auditService = new AuditService();
