import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(300),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  department: z.enum(['MANAGEMENT', 'DESIGN', 'FRONTEND', 'BACKEND', 'CLIENT']),
  assigneeId: z.string().cuid('Invalid assignee ID').optional().nullable(),
  projectId: z.string().cuid('Invalid project ID'),
  dueDate: z.string().datetime().optional().nullable(),
  clientVisible: z.boolean().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  department: z.enum(['MANAGEMENT', 'DESIGN', 'FRONTEND', 'BACKEND', 'CLIENT']).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  clientVisible: z.boolean().optional(),
  version: z.number().int().positive('Version is required for optimistic locking'),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']),
  version: z.number().int().positive('Version is required for optimistic locking'),
});

export const addDependencySchema = z.object({
  dependsOnTaskId: z.string().cuid('Invalid task ID'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
