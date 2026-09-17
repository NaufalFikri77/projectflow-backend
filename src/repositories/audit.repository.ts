import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class AuditRepository {
  async create(data: Prisma.AuditLogCreateInput) {
    return prisma.auditLog.create({ data });
  }

  async createMany(data: Prisma.AuditLogCreateManyInput[]) {
    return prisma.auditLog.createMany({ data });
  }

  async findByTaskId(taskId: string, params?: { skip?: number; take?: number }) {
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where: { taskId } }),
    ]);
    return { data, total };
  }

  async findMany(params: {
    where?: Prisma.AuditLogWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.AuditLogOrderByWithRelationInput;
  }) {
    const { where = {}, skip, take, orderBy } = params;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          task: {
            select: { id: true, title: true, projectId: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }
}

export const auditRepository = new AuditRepository();
