import type {
  ProjectRole,
} from "./projectTypes";

export interface ProjectPermissions {
  canViewProject: boolean;
  canAssignSpaces: boolean;
  canCompleteChecklists: boolean;
  canPerformTesting: boolean;
  canAddComments: boolean;
  canCreateIssues: boolean;
  canResolveIssues: boolean;
  canManageProject: boolean;
  canManageMembers: boolean;
}

const ROLE_PERMISSIONS: Record<
  ProjectRole,
  ProjectPermissions
> = {
  admin: {
    canViewProject: true,
    canAssignSpaces: true,
    canCompleteChecklists: true,
    canPerformTesting: true,
    canAddComments: true,
    canCreateIssues: true,
    canResolveIssues: true,
    canManageProject: true,
    canManageMembers: true,
  },

  editor: {
    canViewProject: true,
    canAssignSpaces: false,
    canCompleteChecklists: true,
    canPerformTesting: true,
    canAddComments: true,
    canCreateIssues: true,
    canResolveIssues: true,
    canManageProject: false,
    canManageMembers: false,
  },

  viewer: {
    canViewProject: true,
    canAssignSpaces: false,
    canCompleteChecklists: false,
    canPerformTesting: false,
    canAddComments: false,
    canCreateIssues: false,
    canResolveIssues: false,
    canManageProject: false,
    canManageMembers: false,
  },
};

export function getProjectPermissions(
  role: ProjectRole,
): ProjectPermissions {
  return ROLE_PERMISSIONS[role];
}