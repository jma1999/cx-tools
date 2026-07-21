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
  floors: ProjectFloor[];
}