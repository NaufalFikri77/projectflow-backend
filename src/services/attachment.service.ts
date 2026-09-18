import { mkdir, unlink } from 'node:fs/promises';
import type { Role } from '@prisma/client';
import type { JwtPayload } from '../lib/auth.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { getPermissions } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { attachmentRepository } from '../repositories/attachment.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository } from '../repositories/task.repository.js';

export class AttachmentService {
  private readonly maxFileSize = 10 * 1024 * 1024;
  private readonly allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip',
  ]);

  async getByTaskId(taskId: string, currentUser: JwtPayload) {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task');
    }

    // Check access
    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenError('Clients cannot access attachments');
    }

    if (currentUser.role !== 'PRODUCT_MANAGER') {
      const isMember = await projectRepository.isUserMember(task.projectId, currentUser.userId);
      if (!isMember) {
        throw new ForbiddenError('You do not have access to this task');
      }
    }

    return attachmentRepository.findByTaskId(taskId);
  }

  async upload(taskId: string, file: File, currentUser: JwtPayload) {
    const permissions = getPermissions(currentUser.role as Role);
    if (!permissions.canUploadAttachment) {
      throw new ForbiddenError('You do not have permission to upload attachments');
    }

    if (!file.name || file.size === 0 || file.size > this.maxFileSize) {
      throw new ValidationError('File must be non-empty and no larger than 10 MB');
    }
    if (!this.allowedTypes.has(file.type)) {
      throw new ValidationError('File type is not allowed');
    }

    const extension = file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : '';
    const allowedExtensions: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/zip': ['.zip'],
    };
    if (!allowedExtensions[file.type]?.includes(extension)) {
      throw new ValidationError('File extension does not match its MIME type');
    }

    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task');
    }

    // Check project membership
    if (currentUser.role !== 'PRODUCT_MANAGER') {
      const isMember = await projectRepository.isUserMember(task.projectId, currentUser.userId);
      if (!isMember) {
        throw new ForbiddenError('You do not have access to this task');
      }
    }

    const storedName = `${crypto.randomUUID()}${extension}`;
    const uploadDirectory = `${process.cwd()}/uploads`;
    await mkdir(uploadDirectory, { recursive: true });
    await Bun.write(`${uploadDirectory}/${storedName}`, file);

    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.attachment.create({
          data: {
            filename: file.name,
            fileUrl: '',
            mimeType: file.type,
            fileSize: file.size,
            task: { connect: { id: taskId } },
            uploadedBy: { connect: { id: currentUser.userId } },
          },
        });
        const updated = await tx.attachment.update({
          where: { id: created.id },
          data: { fileUrl: `/api/attachments/${created.id}/download?file=${storedName}` },
          include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        });
        await tx.auditLog.create({
          data: {
            taskId,
            userId: currentUser.userId,
            action: 'UPDATE',
            changedColumn: 'attachment',
            newValue: `Uploaded: ${file.name}`,
          },
        });
        return updated;
      });
    } catch (error) {
      try {
        await unlink(`${uploadDirectory}/${storedName}`);
      } catch {}
      throw error;
    }
  }

  async getDownload(attachmentId: string, storedName: string, currentUser: JwtPayload) {
    const attachment = await attachmentRepository.findById(attachmentId);
    if (!attachment || !attachment.fileUrl.endsWith(`file=${storedName}`)) {
      throw new NotFoundError('Attachment');
    }
    await this.ensureTaskAccess(attachment.task.projectId, currentUser);
    return `${process.cwd()}/uploads/${storedName}`;
  }

  async delete(attachmentId: string, currentUser: JwtPayload) {
    const attachment = await attachmentRepository.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundError('Attachment');
    }

    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenError('Clients cannot delete attachments');
    }

    if (currentUser.role !== 'PRODUCT_MANAGER') {
      const isMember = await projectRepository.isUserMember(
        attachment.task.projectId,
        currentUser.userId,
      );
      if (!isMember) {
        throw new ForbiddenError('You do not have access to this attachment');
      }
    }

    if (currentUser.role !== 'PRODUCT_MANAGER' && attachment.uploadedById !== currentUser.userId) {
      throw new ForbiddenError('Only the uploader or a Product Manager can delete this attachment');
    }

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.attachment.update({
        where: { id: attachmentId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          taskId: attachment.taskId,
          userId: currentUser.userId,
          action: 'DELETE',
          changedColumn: 'attachment',
          oldValue: attachment.filename,
          newValue: 'Attachment soft deleted',
        },
      });
      return deleted;
    });
  }

  private async ensureTaskAccess(projectId: string, currentUser: JwtPayload) {
    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenError('Clients cannot access attachments');
    }
    if (currentUser.role !== 'PRODUCT_MANAGER') {
      const isMember = await projectRepository.isUserMember(projectId, currentUser.userId);
      if (!isMember) throw new ForbiddenError('You do not have access to this task');
    }
  }
}

export const attachmentService = new AttachmentService();
