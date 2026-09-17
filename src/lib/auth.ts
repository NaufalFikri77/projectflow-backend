import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from './env';

const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  department: string;
  tokenVersion?: number;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return z
    .object({
      userId: z.string().min(1),
      email: z.string().email(),
      role: z.enum(['PRODUCT_MANAGER', 'UI_UX', 'FRONTEND', 'BACKEND', 'CLIENT']),
      department: z.enum(['MANAGEMENT', 'DESIGN', 'FRONTEND', 'BACKEND', 'CLIENT']),
      tokenVersion: z.number().int().nonnegative().optional(),
    })
    .parse(decoded);
}

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}
