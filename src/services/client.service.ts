import type { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import type { JwtPayload } from '../lib/auth';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { type QueryParams, buildPaginationMeta } from '../lib/query-helpers';

export class ClientService {
  async getProjects(currentUser: JwtPayload, query: QueryParams) {
    if (currentUser.role !== 'CLIENT') {
      throw new ForbiddenError('This endpoint is only for clients');
    }

    const where: Prisma.ProjectWhereInput = {
      clientId: currentUser.userId,
      isDeleted: false,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.filters.status) {
      where.status = query.filters.status as ProjectStatus;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: query.pagination.skip,
        take: query.pagination.limit,
        orderBy: {
          [query.sort.sortBy]: query.sort.sortOrder,
        } as Prisma.ProjectOrderByWithRelationInput,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          tasks: {
            where: { isDeleted: false, clientVisible: true },
            select: { status: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    // Calculate progress metrics
    const data = projects.map((project) => {
      const totalTasks = project.tasks.length;
      const doneTasks = project.tasks.filter((t) => t.status === 'DONE').length;
      const inProgressTasks = project.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const blockedTasks = project.tasks.filter((t) => t.status === 'BLOCKED').length;

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        progress: {
          total: totalTasks,
          done: doneTasks,
          inProgress: inProgressTasks,
          blocked: blockedTasks,
          percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
      };
    });

    return {
      data,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }

  async getProjectDetail(projectId: string, currentUser: JwtPayload) {
    if (currentUser.role !== 'CLIENT') {
      throw new ForbiddenError('This endpoint is only for clients');
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: currentUser.userId, isDeleted: false },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Get task progress
    const tasks = await prisma.task.findMany({
      where: { projectId, isDeleted: false, clientVisible: true },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        // NO: assignee, department, internal data
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;

    return {
      ...project,
      progress: {
        total: totalTasks,
        done: doneTasks,
        percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      tasks,
    };
  }

  async getProjectTasks(projectId: string, currentUser: JwtPayload, query: QueryParams) {
    if (currentUser.role !== 'CLIENT') {
      throw new ForbiddenError('This endpoint is only for clients');
    }

    // Verify project belongs to client
    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: currentUser.userId, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    const where: Prisma.TaskWhereInput = {
      projectId,
      isDeleted: false,
      clientVisible: true,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.filters.status) {
      where.status = query.filters.status as TaskStatus;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: query.pagination.skip,
        take: query.pagination.limit,
        orderBy: {
          [query.sort.sortBy]: query.sort.sortOrder,
        } as Prisma.TaskOrderByWithRelationInput,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          // NO internal data
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }
}

export const clientService = new ClientService();
