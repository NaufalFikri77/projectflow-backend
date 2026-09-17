import type { Role, TaskStatus } from '@prisma/client';

export interface PermissionSet {
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canCreateTask: boolean;
  canEditTaskCore: boolean; // title, description, priority, department, assignee, dueDate, clientVisible
  canUploadAttachment: boolean;
  canManageDependency: boolean;
  canViewAuditLog: boolean;
  canViewAllProjects: boolean;
  canViewInternalData: boolean;
}

const ROLE_PERMISSIONS: Record<Role, PermissionSet> = {
  PRODUCT_MANAGER: {
    canCreateProject: true,
    canEditProject: true,
    canDeleteProject: true,
    canCreateTask: true,
    canEditTaskCore: true,
    canUploadAttachment: true,
    canManageDependency: true,
    canViewAuditLog: true,
    canViewAllProjects: true,
    canViewInternalData: true,
  },
  UI_UX: {
    canCreateProject: false,
    canEditProject: false,
    canDeleteProject: false,
    canCreateTask: false,
    canEditTaskCore: false,
    canUploadAttachment: true,
    canManageDependency: false,
    canViewAuditLog: false,
    canViewAllProjects: false,
    canViewInternalData: true,
  },
  FRONTEND: {
    canCreateProject: false,
    canEditProject: false,
    canDeleteProject: false,
    canCreateTask: false,
    canEditTaskCore: false,
    canUploadAttachment: true,
    canManageDependency: false,
    canViewAuditLog: false,
    canViewAllProjects: false,
    canViewInternalData: true,
  },
  BACKEND: {
    canCreateProject: false,
    canEditProject: false,
    canDeleteProject: false,
    canCreateTask: false,
    canEditTaskCore: false,
    canUploadAttachment: true,
    canManageDependency: false,
    canViewAuditLog: false,
    canViewAllProjects: false,
    canViewInternalData: true,
  },
  CLIENT: {
    canCreateProject: false,
    canEditProject: false,
    canDeleteProject: false,
    canCreateTask: false,
    canEditTaskCore: false,
    canUploadAttachment: false,
    canManageDependency: false,
    canViewAuditLog: false,
    canViewAllProjects: false,
    canViewInternalData: false,
  },
};

export function getPermissions(role: Role): PermissionSet {
  return ROLE_PERMISSIONS[role];
}

/**
 * PM restriction: cannot change status from IN_PROGRESS to DONE
 */
export function canChangeStatus(
  role: Role,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  assigneeId?: string | null,
  currentUserId?: string,
): boolean {
  if (role === 'CLIENT') return false;
  if (
    role === 'PRODUCT_MANAGER' &&
    fromStatus === 'IN_PROGRESS' &&
    toStatus === 'DONE' &&
    (assigneeId === undefined || assigneeId !== currentUserId)
  ) {
    return false;
  }
  return true;
}

/**
 * Check valid status transitions
 */
export function isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  const validTransitions: Record<TaskStatus, TaskStatus[]> = {
    TODO: ['IN_PROGRESS', 'BLOCKED'],
    IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO'],
    BLOCKED: ['TODO', 'IN_PROGRESS'],
    DONE: ['TODO'], // Reopen
  };
  return validTransitions[from]?.includes(to) ?? false;
}
