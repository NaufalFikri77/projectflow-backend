import { prisma } from '../lib/prisma';

export class DependencyRepository {
  async findById(id: string) {
    return prisma.taskDependency.findUnique({
      where: { id },
      include: {
        task: { select: { id: true, projectId: true } },
        dependsOnTask: { select: { id: true, projectId: true } },
      },
    });
  }

  async findByTaskId(taskId: string, clientSafe = false) {
    return prisma.taskDependency.findMany({
      where: {
        taskId,
        ...(clientSafe ? { dependsOnTask: { isDeleted: false, clientVisible: true } } : {}),
      },
      include: {
        dependsOnTask: {
          select: { id: true, title: true, status: true, isDeleted: true },
        },
      },
    });
  }

  async findDependents(taskId: string) {
    return prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      include: {
        task: {
          select: { id: true, title: true, status: true },
        },
      },
    });
  }

  async create(taskId: string, dependsOnTaskId: string) {
    return prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId },
    });
  }

  async delete(id: string) {
    return prisma.taskDependency.delete({
      where: { id },
    });
  }

  async exists(taskId: string, dependsOnTaskId: string) {
    const dep = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    return !!dep;
  }

  /**
   * Get all dependencies recursively for circular dependency detection
   */
  async getAllDependencyIds(taskId: string, visited = new Set<string>()): Promise<Set<string>> {
    if (visited.has(taskId)) return visited;
    visited.add(taskId);

    const deps = await prisma.taskDependency.findMany({
      where: { taskId },
      select: { dependsOnTaskId: true },
    });

    for (const dep of deps) {
      await this.getAllDependencyIds(dep.dependsOnTaskId, visited);
    }

    return visited;
  }
}

export const dependencyRepository = new DependencyRepository();
