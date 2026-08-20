import {
  httpsCallable,
} from "firebase/functions";

import {
  firebaseFunctions,
} from "../auth/firebase";

export type ProjectRole =
  | "admin"
  | "editor"
  | "viewer";

export interface ProjectMember {
  uid: string;
  email: string;
  displayName: string;
  role: ProjectRole;
  active: boolean;
}

export interface PendingProjectInvite {
  id: string;
  email: string;
  role: ProjectRole;
  status: "pending";
}

export interface ProjectPeople {
  members: ProjectMember[];
  pendingInvites:
    PendingProjectInvite[];
}

export interface CreateProjectInput {
  name: string;
  code: string;
  description: string;
  spreadsheetId: string;
}

export interface CreateProjectResult {
  projectId: string;

  project: {
    id: string;
    name: string;
    code: string;
    description: string;
    spreadsheetId: string;
    status: "draft";
  };
}

interface GrantProjectAccessInput {
  projectId: string;
  email: string;
  role: ProjectRole;
}

interface GrantProjectAccessResult {
  status: "active" | "pending";
  uid?: string;
  email: string;
  displayName?: string;
  role: ProjectRole;
}

interface RevokeProjectAccessInput {
  projectId: string;
  email: string;
}

const grantProjectAccessCallable =
  httpsCallable<
    GrantProjectAccessInput,
    GrantProjectAccessResult
  >(
    firebaseFunctions,
    "grantProjectAccess",
  );

const revokeProjectAccessCallable =
  httpsCallable<
    RevokeProjectAccessInput,
    {
      success: boolean;
      email: string;
    }
  >(
    firebaseFunctions,
    "revokeProjectAccess",
  );

const listProjectPeopleCallable =
  httpsCallable<
    {
      projectId: string;
    },
    ProjectPeople
  >(
    firebaseFunctions,
    "listProjectPeople",
  );

const claimProjectInvitesCallable =
  httpsCallable<
    Record<string, never>,
    {
      claimed: number;
    }
  >(
    firebaseFunctions,
    "claimProjectInvites",
  );

const createProjectCallable =
  httpsCallable<
    CreateProjectInput,
    CreateProjectResult
  >(
    firebaseFunctions,
    "createProject",
  );

export async function listProjectPeople(
  projectId: string,
): Promise<ProjectPeople> {
  const response =
    await listProjectPeopleCallable({
      projectId,
    });

  return response.data;
}

export async function grantProjectAccess(
  projectId: string,
  email: string,
  role: ProjectRole,
): Promise<GrantProjectAccessResult> {
  const response =
    await grantProjectAccessCallable({
      projectId,
      email,
      role,
    });

  return response.data;
}

export async function revokeProjectAccess(
  projectId: string,
  email: string,
): Promise<void> {
  await revokeProjectAccessCallable({
    projectId,
    email,
  });
}

export async function claimProjectInvites():
  Promise<number> {
  const response =
    await claimProjectInvitesCallable(
      {},
    );

  return response.data.claimed;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const response =
    await createProjectCallable(
      input,
    );

  return response.data;
}