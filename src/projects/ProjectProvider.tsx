import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  ProjectConfig,
  ProjectFloor,
} from "./projectTypes";

interface ProjectContextValue {
  project: ProjectConfig;
  selectedFloor: ProjectFloor;
  setSelectedFloorId: (floorId: string) => void;
}

const ProjectContext =
  createContext<ProjectContextValue | undefined>(
    undefined,
  );

interface ProjectProviderProps {
  project: ProjectConfig;
  children: ReactNode;
}

export function ProjectProvider({
  project,
  children,
}: ProjectProviderProps) {
  const [selectedFloorId, setSelectedFloorIdState] =
    useState(project.floors[0]?.id ?? "");

  useEffect(() => {
    setSelectedFloorIdState(
      project.floors[0]?.id ?? "",
    );
  }, [project.id, project.floors]);

  const selectedFloor = useMemo(
    () =>
      project.floors.find(
        (floor) => floor.id === selectedFloorId,
      ) ?? project.floors[0],
    [project.floors, selectedFloorId],
  );

  const setSelectedFloorId = useCallback(
    (floorId: string): void => {
      const floorExists = project.floors.some(
        (floor) => floor.id === floorId,
      );

      if (!floorExists) {
        throw new Error(
          `Floor ${floorId} does not exist in project ${project.id}.`,
        );
      }

      setSelectedFloorIdState(floorId);
    },
    [project.floors, project.id],
  );

  if (!selectedFloor) {
    throw new Error(
      `Project ${project.id} does not contain any floors.`,
    );
  }

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      selectedFloor,
      setSelectedFloorId,
    }),
    [
      project,
      selectedFloor,
      setSelectedFloorId,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error(
      "useProject must be used inside ProjectProvider.",
    );
  }

  return context;
}