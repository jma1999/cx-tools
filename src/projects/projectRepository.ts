import {
    collection,
    doc,
    getDoc,
    getDocs,
    type DocumentData,
  } from "firebase/firestore";
  
  import { firestoreDb } from "../auth/firebase";
  
  import type {
    AccessibleProject,
    ProjectConfig,
    ProjectFloor,
    ProjectMembership,
    ProjectRole,
  } from "./projectTypes";
  
  const PROJECT_ROLES: ProjectRole[] = [
    "admin",
    "editor",
    "viewer",
  ];
  
  function requiredString(
    data: DocumentData,
    key: string,
    documentPath: string,
  ): string {
    const value = data[key];
  
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      throw new Error(
        `${documentPath} is missing a valid "${key}" field.`,
      );
    }
  
    return value.trim();
  }
  
  function optionalString(
    data: DocumentData,
    key: string,
  ): string | undefined {
    const value = data[key];
  
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return undefined;
    }
  
    return value.trim();
  }
  
  function parseMembership(
    projectId: string,
    data: DocumentData,
  ): ProjectMembership {
    const role = data.role;
  
    if (
      typeof role !== "string" ||
      !PROJECT_ROLES.includes(
        role as ProjectRole,
      )
    ) {
      throw new Error(
        `Membership for project ${projectId} has an invalid role.`,
      );
    }
  
    return {
      projectId,
      role: role as ProjectRole,
      active: data.active === true,
      email: optionalString(data, "email"),
    };
  }
  
  function parseFloor(
    floorId: string,
    data: DocumentData,
  ): {
    floor: ProjectFloor;
    order: number;
  } {
    const documentPath =
      `projects/*/floors/${floorId}`;
  
    const floor: ProjectFloor = {
      id: floorId as ProjectFloor["id"],
  
      label: requiredString(
        data,
        "label",
        documentPath,
      ),
  
      spacesUrl: requiredString(
        data,
        "spacesUrl",
        documentPath,
      ),
  
      regionsUrl: requiredString(
        data,
        "regionsUrl",
        documentPath,
      ),
    };
  
    return {
      floor,
      order:
        typeof data.order === "number"
          ? data.order
          : 0,
    };
  }
  
  async function loadProjectDocument(
    projectId: string,
  ): Promise<ProjectConfig | null> {
    const projectReference = doc(
      firestoreDb,
      "projects",
      projectId,
    );
  
    const projectSnapshot =
      await getDoc(projectReference);
  
    if (!projectSnapshot.exists()) {
      return null;
    }
  
    const projectData =
      projectSnapshot.data();
  
    const floorsSnapshot = await getDocs(
      collection(
        projectReference,
        "floors",
      ),
    );
  
    const floors = floorsSnapshot.docs
      .map((floorDocument) =>
        parseFloor(
          floorDocument.id,
          floorDocument.data(),
        ),
      )
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
  
        return a.floor.label.localeCompare(
          b.floor.label,
        );
      })
      .map(({ floor }) => floor);
  
    if (floors.length === 0) {
      throw new Error(
        `Project ${projectId} does not contain any floor documents.`,
      );
    }
  
    const status =
      projectData.status === "archived"
        ? "archived"
        : "active";
  
    return {
      id: projectSnapshot.id,
  
      name: requiredString(
        projectData,
        "name",
        `projects/${projectId}`,
      ),
  
      code: requiredString(
        projectData,
        "code",
        `projects/${projectId}`,
      ),
  
      description: optionalString(
        projectData,
        "description",
      ),
  
      spreadsheetId: requiredString(
        projectData,
        "spreadsheetId",
        `projects/${projectId}`,
      ),
  
      status,
      floors,
    };
  }
  
  export async function loadUserProjects(
    userId: string,
  ): Promise<AccessibleProject[]> {
    if (!userId.trim()) {
      throw new Error(
        "A Firebase user ID is required to load projects.",
      );
    }
  
    const membershipsSnapshot =
      await getDocs(
        collection(
          firestoreDb,
          "users",
          userId,
          "memberships",
        ),
      );
  
    const memberships =
      membershipsSnapshot.docs
        .map((membershipDocument) =>
          parseMembership(
            membershipDocument.id,
            membershipDocument.data(),
          ),
        )
        .filter(
          (membership) =>
            membership.active,
        );
  
    const loadedProjects =
      await Promise.all(
        memberships.map(
          async (
            membership,
          ): Promise<AccessibleProject | null> => {
            const project =
              await loadProjectDocument(
                membership.projectId,
              );
  
            if (
              !project ||
              project.status === "archived"
            ) {
              return null;
            }
  
            return {
              project,
              membership,
            };
          },
        ),
      );
  
    return loadedProjects
      .filter(
        (
          entry,
        ): entry is AccessibleProject =>
          entry !== null,
      )
      .sort((a, b) =>
        a.project.name.localeCompare(
          b.project.name,
        ),
      );
  }
  
  export async function loadAccessibleProject(
    userId: string,
    projectId: string,
  ): Promise<AccessibleProject | null> {
    if (
      !userId.trim() ||
      !projectId.trim()
    ) {
      return null;
    }
  
    /*
     * Read membership first.
     *
     * This prevents us from requesting a protected project
     * document when the signed-in user has no membership.
     */
    const membershipSnapshot =
      await getDoc(
        doc(
          firestoreDb,
          "users",
          userId,
          "memberships",
          projectId,
        ),
      );
  
    if (!membershipSnapshot.exists()) {
      return null;
    }
  
    const membership = parseMembership(
      projectId,
      membershipSnapshot.data(),
    );
  
    if (!membership.active) {
      return null;
    }
  
    const project =
      await loadProjectDocument(projectId);
  
    if (
      !project ||
      project.status === "archived"
    ) {
      return null;
    }
  
    return {
      project,
      membership,
    };
  }