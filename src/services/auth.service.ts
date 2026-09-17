import { comparePassword, generateToken, hashPassword } from '../lib/auth';
import { ConflictError, NotFoundError, UnauthorizedError } from '../lib/errors';
import { userRepository } from '../repositories/user.repository';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';

export class AuthService {
  async register(input: RegisterInput) {
    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const hashedPw = await hashPassword(input.password);
    const user = await userRepository.create({
      ...input,
      password: hashedPw,
      role: 'CLIENT',
      department: 'CLIENT',
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      token,
    };
  }

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await comparePassword(input.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  async logout(userId: string) {
    return userRepository.incrementTokenVersion(userId);
  }
}

export const authService = new AuthService();
