import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class ProjectRepository {
  async findById(id: string, includeRelations = false) {
    return prisma.project.findFirst({
      where: { id, isDeleted: false },
      include: includeRelations
        ? {
            client: {
              select: { id: true, name: true, email: true },
            },
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, role: true, department: true },
                },
              },
            },
            _count: {
              select: { tasks: { where: { isDeleted: false } } },
            },
          }
        : undefined,
    });
  }

  async findMany(params: {
    where?: Prisma.ProjectWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.ProjectOrderByWithRelationInput;
  }) {
    const { where = {}, skip, take, orderBy } = params;
    const finalWhere = { ...where, isDeleted: false };

    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where: finalWhere,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { tasks: { where: { isDeleted: false } } },
          },
        },
      }),
      prisma.project.count({ where: finalWhere }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({
      data,
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return prisma.project.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async isUserMember(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return !!member;
  }

  async addMember(projectId: string, userId: string) {
    return prisma.projectMember.create({
      data: { projectId, userId },
    });
  }

  async removeMember(projectId: string, userId: string) {
    return prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}

export const projectRepository = new ProjectRepository();
