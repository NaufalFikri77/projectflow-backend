import type { Context, Next } from 'hono';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error instanceof AppError && 'errors' in error ? { details: error.errors } : {}),
          },
        },
        error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 500,
      );
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.flatten().fieldErrors,
          },
        },
        422,
      );
    }

    console.error('Unhandled error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500,
    );
  }
}
