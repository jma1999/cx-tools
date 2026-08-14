import type { ProjectConfig } from "./projectTypes";

export const PROJECTS: ProjectConfig[] = [
  {
    id: "keystone-lighting-cx",
    name: "Keystone Lighting & Electrical Panels Commissioning",
    code: "Cx-LT",
    description: "Lighting commissioning for Floors 03 and 04.",
    spreadsheetId: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID,
    floors: [
      {
        id: "03",
        label: "Floor 03",
        spacesUrl:
          "/projects/keystone-lighting-cx/data/floor-03-spaces.json",
        regionsUrl:
          "/projects/keystone-lighting-cx/data/floor-03-regions.json",
      },
      {
        id: "04",
        label: "Floor 04",
        spacesUrl:
          "/projects/keystone-lighting-cx/data/floor-04-spaces.json",
        regionsUrl:
          "/projects/keystone-lighting-cx/data/floor-04-regions.json",
      },
    ],
  },
  {
    id: "test-project",
    name: "Repository Test Project",
    code: "Cx-Test",
    spreadsheetId:
      import.meta.env
        .VITE_TEST_SPREADSHEET_ID,
    floors: [
      {
        id: "03",
        label: "Floor 03",
        spacesUrl:
          "/projects/keystone-lighting-cx/data/floor-03-spaces.json",
        regionsUrl:
          "/projects/keystone-lighting-cx/data/floor-03-regions.json",
      },
    ],
  },
];

export function getProject(
  projectId: string | undefined,
): ProjectConfig | undefined {
  return PROJECTS.find(
    (project) => project.id === projectId,
  );
}