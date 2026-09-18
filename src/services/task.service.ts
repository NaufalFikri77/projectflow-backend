import type { Department, Priority, Prisma, Role, TaskStatus } from '@prisma/client';
import type { JwtPayload } from '../lib/auth.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { canChangeStatus, getPermissions, isValidStatusTransition } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { type QueryParams, buildPaginationMeta } from '../lib/query-helpers.js';
import { dependencyRepository } from '../repositories/dependency.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository } from '../repositories/task.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from '../schemas/task.schema';

export class TaskService {
  async list(currentUser: JwtPayload, query: QueryParams) {
    const where: Prisma.TaskWhereInput = {};

    // ABAC: Filter based on role
    if (currentUser.role === 'CLIENT') {
      // Client can only see clientVisible tasks in their projects
      where.clientVisible = true;
      where.project = { clientId: currentUser.userId, isDeleted: false };
    } else if (currentUser.role !== 'PRODUCT_MANAGER') {
      // Internal team: only relevant tasks in projects they're members of.
      where.AND = [
        { project: { members: { some: { userId: currentUser.userId } }, isDeleted: false } },
        {
          OR: [
            { assigneeId: currentUser.userId },
            { department: currentUser.department as Department },
          ],
        },
      ];
    } else {
      where.project = { isDeleted: false };
    }

    // Search
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (query.filters.status) {
      where.status = query.filters.status as TaskStatus;
    }
    if (query.filters.priority) {
      where.priority = query.filters.priority as Priority;
    }
    if (query.filters.department) {
      where.department = query.filters.department as Department;
    }
    if (query.filters.projectId) {
      where.projectId = query.filters.projectId as string;
    }
    if (query.filters.assigneeId) {
      where.assigneeId = query.filters.assigneeId as string;
    }

    const { data, total } = await taskRepository.findMany({
      where,
      skip: query.pagination.skip,
      take: query.pagination.limit,
      orderBy: { [query.sort.sortBy]: query.sort.sortOrder } as Prisma.TaskOrderByWithRelationInput,
    });

    // Strip internal data for client
    if (currentUser.role === 'CLIENT') {
      return {
        data: data.map(this.toClientView),
        meta: buildPaginationMeta(total, query.pagination),
      };
    }

    return {
      data,
      meta: buildPaginationMeta(total, query.pagination),
    };
  }

  async getById(id: string, currentUser: JwtPayload) {
    const task = await taskRepository.findById(id, true);
    if (!task) {
      throw new NotFoundError('Task');
    }

    // ABAC
    await this.checkTaskAccess(task, currentUser);

    if (currentUser.role === 'CLIENT') {
      if (!task.clientVisible) {
        throw new NotFoundError('Task');
      }
      return this.toClientView(task);
    }

    return task;
  }

  async create(input: CreateTaskInput, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canCreateTask) {
      throw new ForbiddenError('You do not have permission to create tasks');
    }

    // Verify project exists
    const project = await projectRepository.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    if (input.assigneeId) {
      await this.validateAssignee(input.projectId, input.assigneeId, input.department);
    }

    const taskData: Prisma.TaskCreateInput = {
      title: input.title,
      description: input.description,
      status: input.status || 'TODO',
      priority: input.priority || 'MEDIUM',
      department: input.department,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      clientVisible: input.clientVisible ?? false,
      project: { connect: { id: input.projectId } },
    };

    if (input.assigneeId) {
      taskData.assignee = { connect: { id: input.assigneeId } };
    }

    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: taskData,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          taskId: createdTask.id,
          userId: currentUser.userId,
          action: 'CREATE',
          newValue: 'Task created',
        },
      });
      return createdTask;
    });

    return task;
  }

  async update(id: string, input: UpdateTaskInput, currentUser: JwtPayload) {
    const task = await taskRepository.findById(id, true);
    if (!task) {
      throw new NotFoundError('Task');
    }

    await this.checkTaskAccess(task, currentUser);

    const permissions = getPermissions(currentUser.role as Role);
    const { version, status, ...coreFields } = input;

    // Check if user is trying to edit core fields
    const hasCoreFieldChanges = Object.keys(coreFields).length > 0;
    if (hasCoreFieldChanges && !permissions.canEditTaskCore) {
      throw new ForbiddenError(
        'You do not have permission to edit task details. You can only update status and attachments.',
      );
    }

    // Handle status change
    if (status && status !== task.status) {
      this.ensureStatusPermission(task, currentUser);
      // Check PM restriction
      if (
        !canChangeStatus(
          currentUser.role as Role,
          task.status,
          status as TaskStatus,
          task.assigneeId,
          currentUser.userId,
        )
      ) {
        throw new ForbiddenError('Product Manager cannot change status from IN_PROGRESS to DONE');
      }

      // Check valid transition
      if (!isValidStatusTransition(task.status, status as TaskStatus)) {
        throw new ValidationError(`Invalid status transition from ${task.status} to ${status}`);
      }

      // Check dependencies for IN_PROGRESS
      if (status === 'IN_PROGRESS') {
        await this.validateDependenciesForStart(id);
      }
    }

    // Build update data
    const updateData: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (status !== undefined) updateData.status = status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.department !== undefined) updateData.department = input.department;
    if (input.assigneeId !== undefined) {
      updateData.assignee = input.assigneeId
        ? { connect: { id: input.assigneeId } }
        : { disconnect: true };
    }
    if (input.dueDate !== undefined) {
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.clientVisible !== undefined) updateData.clientVisible = input.clientVisible;

    if (input.assigneeId !== undefined || input.department !== undefined) {
      const assigneeId = input.assigneeId === undefined ? task.assigneeId : input.assigneeId;
      if (assigneeId) {
        await this.validateAssignee(
          task.projectId,
          assigneeId,
          input.department ?? task.department,
        );
      }
    }

    // Optimistic locking
    const auditEntries = this.buildAuditLogs(task, updateData, currentUser.userId);
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: { id, version, isDeleted: false },
        data: { ...updateData, version: { increment: 1 }, updatedAt: new Date() },
      });
      if (result.count === 1 && auditEntries.length > 0) {
        await tx.auditLog.createMany({ data: auditEntries });
      }
      return result.count;
    });
    if (updated === 0) {
      throw new ConflictError(
        'Task has been modified by another user. Please refresh and try again.',
      );
    }

    // Return updated task
    return taskRepository.findById(id, true);
  }

  async updateStatus(id: string, input: UpdateTaskStatusInput, currentUser: JwtPayload) {
    const task = await taskRepository.findById(id);
    if (!task) {
      throw new NotFoundError('Task');
    }

    await this.checkTaskAccess(task, currentUser);
    this.ensureStatusPermission(task, currentUser);

    // Check role-based status change permission
    if (
      !canChangeStatus(
        currentUser.role as Role,
        task.status,
        input.status as TaskStatus,
        task.assigneeId,
        currentUser.userId,
      )
    ) {
      throw new ForbiddenError('Product Manager cannot change status from IN_PROGRESS to DONE');
    }

    // Check valid transition
    if (!isValidStatusTransition(task.status, input.status as TaskStatus)) {
      throw new ValidationError(`Invalid status transition from ${task.status} to ${input.status}`);
    }

    // Check dependencies for IN_PROGRESS
    if (input.status === 'IN_PROGRESS') {
      await this.validateDependenciesForStart(id);
    }

    // Optimistic locking
    const auditEntry = {
      taskId: id,
      userId: currentUser.userId,
      action: 'STATUS_CHANGE',
      changedColumn: 'status',
      oldValue: task.status,
      newValue: input.status,
    };
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: { id, version: input.version, isDeleted: false },
        data: {
          status: input.status as TaskStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (result.count === 1) {
        await tx.auditLog.create({ data: auditEntry });
      }
      return result.count;
    });

    if (updated === 0) {
      throw new ConflictError(
        'Task has been modified by another user. Please refresh and try again.',
      );
    }

    return taskRepository.findById(id, true);
  }

  async delete(id: string, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canCreateTask) {
      throw new ForbiddenError('You do not have permission to delete tasks');
    }

    const task = await taskRepository.findById(id);
    if (!task) {
      throw new NotFoundError('Task');
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          taskId: id,
          userId: currentUser.userId,
          action: 'DELETE',
          newValue: 'Task soft deleted',
        },
      });
    });
  }

  // ========== Private Methods ==========

  private async validateDependenciesForStart(taskId: string) {
    const deps = await dependencyRepository.findByTaskId(taskId);
    const unfinished = deps.filter(
      (d) => d.dependsOnTask.status !== 'DONE' && !d.dependsOnTask.isDeleted,
    );

    if (unfinished.length > 0) {
      const taskNames = unfinished.map((d) => d.dependsOnTask.title).join(', ');
      throw new ValidationError(
        `Cannot start task: the following dependencies are not completed: ${taskNames}`,
      );
    }
  }

  private buildAuditLogs(
    oldTask: { id: string; [key: string]: unknown },
    changes: Record<string, unknown>,
    userId: string,
  ) {
    const auditEntries: Prisma.AuditLogCreateManyInput[] = [];
    const trackFields = [
      'title',
      'description',
      'status',
      'priority',
      'department',
      'assigneeId',
      'dueDate',
      'clientVisible',
    ];

    for (const field of trackFields) {
      if (changes[field] !== undefined && changes[field] !== oldTask[field]) {
        auditEntries.push({
          taskId: oldTask.id,
          userId,
          action: field === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
          changedColumn: field,
          oldValue: String(oldTask[field] ?? ''),
          newValue: String(changes[field] ?? ''),
        });
      }
    }

    return auditEntries;
  }

  private async validateAssignee(projectId: string, assigneeId: string, department: string) {
    const assignee = await userRepository.findById(assigneeId);
    if (!assignee || assignee.role === 'CLIENT') {
      throw new ValidationError('Assignee must be an internal project member');
    }
    if (assignee.department !== department) {
      throw new ValidationError('Assignee department must match the task department');
    }
    if (!(await projectRepository.isUserMember(projectId, assigneeId))) {
      throw new ValidationError('Assignee must be a member of the project');
    }
  }

  private ensureStatusPermission(task: { assigneeId: string | null }, currentUser: JwtPayload) {
    if (
      ['UI_UX', 'FRONTEND', 'BACKEND'].includes(currentUser.role) &&
      task.assigneeId !== currentUser.userId
    ) {
      throw new ForbiddenError('Only the assigned team member can change this task status');
    }
  }

  private async checkTaskAccess(
    task: {
      projectId: string;
      department?: Department;
      assigneeId?: string | null;
      project?: { clientId: string; isDeleted?: boolean } | null;
    },
    currentUser: JwtPayload,
  ) {
    if (currentUser.role === 'PRODUCT_MANAGER') return;

    if (currentUser.role === 'CLIENT') {
      // Check project belongs to client
      const project = task.project || (await projectRepository.findById(task.projectId));
      if (project?.clientId !== currentUser.userId) {
        throw new ForbiddenError('You do not have access to this task');
      }
      return;
    }

    if (task.project?.isDeleted) {
      throw new NotFoundError('Task');
    }

    // Internal team: must be member of the project
    const isMember = await projectRepository.isUserMember(task.projectId, currentUser.userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this task');
    }
    if (task.assigneeId !== currentUser.userId && task.department !== currentUser.department) {
      throw new ForbiddenError('You do not have access to this task');
    }
  }

  private toClientView(task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
  }) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      project: task.project ? { id: task.project.id, name: task.project.name } : undefined,
      // NO assignee, department, internal data
    };
  }
}

export const taskService = new TaskService();
