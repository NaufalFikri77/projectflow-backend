import type { Role } from '@prisma/client';
import type { JwtPayload } from '../lib/auth';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { getPermissions } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import { dependencyRepository } from '../repositories/dependency.repository';
import { projectRepository } from '../repositories/project.repository';
import { taskRepository } from '../repositories/task.repository';

export class DependencyService {
  async getTaskDependencies(taskId: string, currentUser: JwtPayload) {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task');
    }

    await this.checkTaskAccess(taskId, task.projectId, currentUser);

    return dependencyRepository.findByTaskId(taskId, currentUser.role === 'CLIENT');
  }

  async addDependency(taskId: string, dependsOnTaskId: string, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canManageDependency) {
      throw new ForbiddenError('You do not have permission to manage task dependencies');
    }

    // Can't depend on itself
    if (taskId === dependsOnTaskId) {
      throw new ValidationError('A task cannot depend on itself');
    }

    // Check both tasks exist
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task');
    }

    const dependsOnTask = await taskRepository.findById(dependsOnTaskId);
    if (!dependsOnTask) {
      throw new NotFoundError('Dependency task');
    }

    // Check same project
    if (task.projectId !== dependsOnTask.projectId) {
      throw new ValidationError('Dependencies must be within the same project');
    }

    // Check duplicate
    const exists = await dependencyRepository.exists(taskId, dependsOnTaskId);
    if (exists) {
      throw new ConflictError('This dependency already exists');
    }

    // Check circular dependency
    await this.checkCircularDependency(taskId, dependsOnTaskId);

    return prisma.$transaction(async (tx) => {
      const dep = await tx.taskDependency.create({
        data: { taskId, dependsOnTaskId },
      });

      if (dependsOnTask.status !== 'DONE') {
        const blocked = await tx.task.updateMany({
          where: { id: taskId, version: task.version, isDeleted: false },
          data: { status: 'BLOCKED', version: { increment: 1 }, updatedAt: new Date() },
        });
        if (blocked.count !== 1) {
          throw new ConflictError(
            'Task has been modified by another user. Please refresh and try again.',
          );
        }
        await tx.auditLog.create({
          data: {
            taskId,
            userId: currentUser.userId,
            action: 'STATUS_CHANGE',
            changedColumn: 'status',
            oldValue: task.status,
            newValue: 'BLOCKED',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          taskId,
          userId: currentUser.userId,
          action: 'UPDATE',
          changedColumn: 'dependency',
          newValue: `Added dependency on: ${dependsOnTask.title}`,
        },
      });

      return dep;
    });
  }

  async removeDependency(depId: string, currentUser: JwtPayload, taskId: string) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canManageDependency) {
      throw new ForbiddenError('You do not have permission to manage task dependencies');
    }

    const dependency = await dependencyRepository.findById(depId);
    if (!dependency || dependency.task.id !== taskId) {
      throw new NotFoundError('Dependency');
    }

    await this.checkTaskAccess(taskId, dependency.task.projectId, currentUser);

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.taskDependency.delete({ where: { id: depId } });
      await tx.auditLog.create({
        data: {
          taskId,
          userId: currentUser.userId,
          action: 'UPDATE',
          changedColumn: 'dependency',
          oldValue: dependency.dependsOnTask.id,
          newValue: `Removed dependency: ${dependency.dependsOnTask.id}`,
        },
      });
      return deleted;
    });
  }

  /**
   * Check for circular dependencies using DFS
   * Before adding taskId -> dependsOnTaskId, we check:
   * Can we reach taskId starting from dependsOnTaskId?
   */
  private async checkCircularDependency(taskId: string, dependsOnTaskId: string) {
    const reachable = await dependencyRepository.getAllDependencyIds(dependsOnTaskId);
    if (reachable.has(taskId)) {
      throw new ValidationError('Cannot add dependency: this would create a circular dependency');
    }
  }

  private async checkTaskAccess(taskId: string, projectId: string, currentUser: JwtPayload) {
    if (currentUser.role === 'PRODUCT_MANAGER') return;

    if (currentUser.role === 'CLIENT') {
      const task = await taskRepository.findById(taskId);
      if (!task?.clientVisible) {
        throw new ForbiddenError('You do not have access to this task');
      }
      const project = await projectRepository.findById(projectId);
      if (project?.clientId !== currentUser.userId) {
        throw new ForbiddenError('You do not have access to this task');
      }
      return;
    }

    const isMember = await projectRepository.isUserMember(projectId, currentUser.userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this task');
    }
  }
}

export const dependencyService = new DependencyService();
