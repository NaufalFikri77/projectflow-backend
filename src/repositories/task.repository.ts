import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class TaskRepository {
  async findById(id: string, includeRelations = false) {
    return prisma.task.findFirst({
      where: { id, isDeleted: false },
      include: includeRelations
        ? {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                avatarUrl: true,
              },
            },
            project: {
              select: { id: true, name: true, clientId: true, isDeleted: true },
            },
            dependencies: {
              include: {
                dependsOnTask: {
                  select: { id: true, title: true, status: true },
                },
              },
            },
            dependedOnBy: {
              include: {
                task: {
                  select: { id: true, title: true, status: true },
                },
              },
            },
            attachments: {
              where: { isDeleted: false },
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                mimeType: true,
                fileSize: true,
                createdAt: true,
                uploadedBy: { select: { id: true, name: true } },
              },
            },
            _count: {
              select: {
                auditLogs: true,
                attachments: { where: { isDeleted: false } },
              },
            },
          }
        : undefined,
    });
  }

  async findMany(params: {
    where?: Prisma.TaskWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.TaskOrderByWithRelationInput;
  }) {
    const { where = {}, skip, take, orderBy } = params;
    const finalWhere = { ...where, isDeleted: false };

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where: finalWhere,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              avatarUrl: true,
            },
          },
          project: {
            select: { id: true, name: true },
          },
          dependencies: {
            include: {
              dependsOnTask: {
                select: { id: true, title: true, status: true },
              },
            },
          },
          _count: {
            select: {
              attachments: { where: { isDeleted: false } },
            },
          },
        },
      }),
      prisma.task.count({ where: finalWhere }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.TaskCreateInput) {
    return prisma.task.create({
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Update with optimistic locking
   * Only updates if the version matches
   */
  async updateWithVersion(id: string, version: number, data: Prisma.TaskUpdateInput) {
    // Use updateMany with version check for optimistic locking
    const result = await prisma.task.updateMany({
      where: { id, version, isDeleted: false },
      data: {
        ...data,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  async softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async getTaskStatusCounts(projectId: string) {
    const counts = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId, isDeleted: false },
      _count: { status: true },
    });
    return counts;
  }
}

export const taskRepository = new TaskRepository();
