import type { Prisma, ProjectStatus, Role } from '@prisma/client';
import type { JwtPayload } from '../lib/auth.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { getPermissions } from '../lib/permissions.js';
import { type QueryParams, buildPaginationMeta } from '../lib/query-helpers.js';
import { projectRepository } from '../repositories/project.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schema.js';

export class ProjectService {
  async list(currentUser: JwtPayload, query: QueryParams) {
    const where: Prisma.ProjectWhereInput = {};

    // ABAC: Filter based on role
    if (currentUser.role === 'CLIENT') {
      // Client can only see their own projects
      where.clientId = currentUser.userId;
    } else if (currentUser.role !== 'PRODUCT_MANAGER') {
      // Internal team: only see projects they're members of
      where.members = { some: { userId: currentUser.userId } };
    }

    // Search filter
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (query.filters.status) {
      where.status = query.filters.status as ProjectStatus;
    }

    const { data, total } = await projectRepository.findMany({
      where,
      skip: query.pagination.skip,
      take: query.pagination.limit,
      orderBy: {
        [query.sort.sortBy]: query.sort.sortOrder,
      } as Prisma.ProjectOrderByWithRelationInput,
    });

    const safeData =
      currentUser.role === 'CLIENT'
        ? data.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            clientId: project.clientId,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            _count: project._count,
          }))
        : data;

    return {
      data: safeData,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }

  async getInternalCandidates(currentUser: JwtPayload) {
    if (currentUser.role !== 'PRODUCT_MANAGER') {
      throw new ForbiddenError('Only Product Managers can list internal team candidates');
    }

    return userRepository.findMany({
      role: { in: ['UI_UX', 'FRONTEND', 'BACKEND'] },
    });
  }

  async getById(id: string, currentUser: JwtPayload) {
    const project = await projectRepository.findById(id, true);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // ABAC: Check access
    await this.checkProjectAccess(project, currentUser);

    if (currentUser.role === 'CLIENT') {
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        clientId: project.clientId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    }

    return project;
  }

  async create(input: CreateProjectInput, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canCreateProject) {
      throw new ForbiddenError('You do not have permission to create projects');
    }

    // Verify client exists
    const client = await userRepository.findById(input.clientId);
    if (!client || client.role !== 'CLIENT') {
      throw new ValidationError('Invalid client ID');
    }

    const project = await projectRepository.create({
      name: input.name,
      description: input.description,
      status: input.status as ProjectStatus,
      client: { connect: { id: input.clientId } },
    });

    // Auto-add PM as member
    await projectRepository.addMember(project.id, currentUser.userId);

    return project;
  }

  async update(id: string, input: UpdateProjectInput, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canEditProject) {
      throw new ForbiddenError('You do not have permission to edit projects');
    }

    const project = await projectRepository.findById(id);
    if (!project) {
      throw new NotFoundError('Project');
    }

    return projectRepository.update(id, input);
  }

  async delete(id: string, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canDeleteProject) {
      throw new ForbiddenError('You do not have permission to delete projects');
    }

    const project = await projectRepository.findById(id);
    if (!project) {
      throw new NotFoundError('Project');
    }

    return projectRepository.softDelete(id);
  }

  async addMember(projectId: string, userId: string, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canEditProject) {
      throw new ForbiddenError('You do not have permission to manage project members');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const user = await userRepository.findById(userId);
    if (!user || user.role === 'CLIENT') {
      throw new NotFoundError('User');
    }

    const isMember = await projectRepository.isUserMember(projectId, userId);
    if (isMember) {
      throw new ValidationError('User is already a member of this project');
    }

    return projectRepository.addMember(projectId, userId);
  }

  async removeMember(projectId: string, userId: string, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canEditProject) {
      throw new ForbiddenError('You do not have permission to manage project members');
    }

    return projectRepository.removeMember(projectId, userId);
  }

  private async checkProjectAccess(
    project: { id: string; clientId: string },
    currentUser: JwtPayload,
  ) {
    if (currentUser.role === 'PRODUCT_MANAGER') return;

    if (currentUser.role === 'CLIENT') {
      if (project.clientId !== currentUser.userId) {
        throw new ForbiddenError('You do not have access to this project');
      }
      return;
    }

    // Internal team: must be a member
    const isMember = await projectRepository.isUserMember(project.id, currentUser.userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this project');
    }
  }
}

export const projectService = new ProjectService();
