import type { FloorId } from "../components/FloorPlan";

export interface ProjectFloor {
  id: FloorId;
  label: string;
  spacesUrl: string;
  regionsUrl: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  code: string;
  description?: string;
  spreadsheetId: string;
  status?: ProjectStatus;
  floors: ProjectFloor[];
}

export type ProjectRole =
  | "admin"
  | "editor"
  | "viewer";

export type ProjectStatus =
  | "active"
  | "archived";

export interface ProjectMembership {
  projectId: string;
  role: ProjectRole;
  active: boolean;
  email?: string;
}

export interface AccessibleProject {
  project: ProjectConfig;
  membership: ProjectMembership;
}