import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, isDeleted: false },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async incrementTokenVersion(id: string) {
    return prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async findMany(where: Prisma.UserWhereInput = {}) {
    return prisma.user.findMany({
      where: { ...where, isDeleted: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
