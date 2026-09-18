import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
