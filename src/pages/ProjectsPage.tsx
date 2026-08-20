import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

import {
  loadUserProjects,
} from "../projects/projectRepository";

import type {
  AccessibleProject,
} from "../projects/projectTypes";

import {
  claimProjectInvites,
} from "../services/projectAdmin";

export default function ProjectsPage() {
  const {
    appUser,
    signOut,
  } = useAuth();

  const [
    accessibleProjects,
    setAccessibleProjects,
  ] = useState<AccessibleProject[]>([]);

  const [
    projectsLoading,
    setProjectsLoading,
  ] = useState(true);

  const [
    projectsError,
    setProjectsError,
  ] = useState("");

  useEffect(() => {
    if (!appUser) {
      setAccessibleProjects([]);
      setProjectsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProjects(): Promise<void> {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        /*
        * Converts any pending email
        * invitations into memberships first.
        */
        await claimProjectInvites();

        const projects =
          await loadUserProjects(
            appUser.uid,
          );

        if (!cancelled) {
          setAccessibleProjects(projects);
        }
      } catch (error) {
        if (!cancelled) {
          setProjectsError(
            error instanceof Error
              ? error.message
              : "Projects could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [appUser]);

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="eyebrow">
            RBGB Internal Tools
          </p>

          <h1>Projects</h1>

          <p>
            Select a project to open its
            commissioning workspace.
          </p>
        </div>

        <div className="projects-account">
          <span>{appUser?.email}</span>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void signOut()
            }
          >
            Sign out
          </button>
        </div>
      </header>

      {projectsLoading && (
        <section className="projects-message">
          Loading your projects…
        </section>
      )}

      {!projectsLoading &&
        projectsError && (
          <section className="projects-message projects-error">
            <h2>
              Projects could not be loaded
            </h2>

            <p>{projectsError}</p>
          </section>
        )}

      {!projectsLoading &&
        !projectsError &&
        accessibleProjects.length === 0 && (
          <section className="projects-message">
            <h2>No projects assigned</h2>

            <p>
              Your account does not currently
              have access to any active projects.
            </p>
          </section>
        )}

      {!projectsLoading &&
        !projectsError &&
        accessibleProjects.length > 0 && (
          <section className="project-grid">
            {accessibleProjects.map(
              ({
                project,
                membership,
              }) => (
                <article
                  className="project-card"
                  key={project.id}
                >
                  <div className="project-card-topline">
                    <p className="eyebrow">
                      {project.code}
                    </p>

                    <span className="project-role">
                      {membership.role}
                    </span>
                  </div>

                  <h2>{project.name}</h2>

                  {project.description && (
                    <p>
                      {project.description}
                    </p>
                  )}

                  <span className="project-floor-list">
                    {project.floors
                      .map(
                        (floor) =>
                          floor.label,
                      )
                      .join(" · ")}
                  </span>

                  <Link
                    className="primary-button project-link"
                    to={`/projects/${project.id}`}
                  >
                    Open project
                  </Link>
                </article>
              ),
            )}
          </section>
        )}
    </main>
  );
}