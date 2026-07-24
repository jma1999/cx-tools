import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

import {
  ProjectProvider,
} from "../projects/ProjectProvider";

import {
  loadAccessibleProject,
} from "../projects/projectRepository";

import type {
  AccessibleProject,
} from "../projects/projectTypes";

import ProjectWorkspace from "./ProjectWorkspace";

export default function ProjectWorkspacePage() {
  const { projectId } =
    useParams<{
      projectId: string;
    }>();

  const { appUser } = useAuth();

  const [
    projectAccess,
    setProjectAccess,
  ] = useState<AccessibleProject | null>(
    null,
  );

  const [
    projectLoading,
    setProjectLoading,
  ] = useState(true);

  const [
    projectError,
    setProjectError,
  ] = useState("");

  useEffect(() => {
    if (
      !appUser ||
      !projectId
    ) {
      setProjectAccess(null);
      setProjectLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProject(): Promise<void> {
      setProjectLoading(true);
      setProjectError("");

      try {
        const loadedAccess =
          await loadAccessibleProject(
            appUser.uid,
            projectId!,
          );

        if (!cancelled) {
          setProjectAccess(
            loadedAccess,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setProjectError(
            error instanceof Error
              ? error.message
              : "The project could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setProjectLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [
    appUser,
    projectId,
  ]);

  if (projectLoading) {
    return (
      <div className="route-loading">
        Loading project…
      </div>
    );
  }

  if (
    projectError ||
    !projectAccess
  ) {
    return (
      <main className="project-access-error">
        <section>
          <p className="eyebrow">
            Project access
          </p>

          <h1>
            Project unavailable
          </h1>

          <p>
            {projectError ||
              "This project does not exist, is archived, or has not been assigned to your account."}
          </p>

          <Link
            to="/projects"
            className="primary-button"
          >
            Return to projects
          </Link>
        </section>
      </main>
    );
  }

  return (
    <ProjectProvider
      project={
        projectAccess.project
      }
      membership={
        projectAccess.membership
      }
    >
      <ProjectWorkspace />
    </ProjectProvider>
  );
}