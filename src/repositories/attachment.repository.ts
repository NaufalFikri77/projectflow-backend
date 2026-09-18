import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class AttachmentRepository {
  async findById(id: string) {
    return prisma.attachment.findFirst({
      where: { id, isDeleted: false },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, projectId: true } },
      },
    });
  }

  async findByTaskId(taskId: string) {
    return prisma.attachment.findMany({
      where: { taskId, isDeleted: false },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.AttachmentCreateInput) {
    return prisma.attachment.create({
      data,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async softDelete(id: string) {
    return prisma.attachment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}

export const attachmentRepository = new AttachmentRepository();
