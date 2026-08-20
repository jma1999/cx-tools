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

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  firestoreDb,
} from "../auth/firebase";

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

  const [
    isSystemAdmin,
    setIsSystemAdmin,
  ] = useState(false);

  useEffect(() => {
    if (!appUser) {
      setAccessibleProjects([]);
      setIsSystemAdmin(false);
      setProjectsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProjects(): Promise<void> {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        /*
        * Pending invite claiming is optional.
        * A failure here must never prevent an
        * existing user from seeing their projects.
        */
        try {
          await claimProjectInvites();
        } catch (claimError) {
          console.error(
            "Project invite claiming failed:",
            claimError,
          );
        }

        try {
          const userSnapshot =
            await getDoc(
              doc(
                firestoreDb,
                "users",
                appUser.uid,
              ),
            );

          setIsSystemAdmin(
            userSnapshot.data()?.systemRole ===
              "admin",
          );
        } catch (adminError) {
          console.error(
            "System admin lookup failed:",
            adminError,
          );

          setIsSystemAdmin(false);
        }

        const loadedProjects =
          await loadUserProjects(
            appUser.uid,
          );

        setAccessibleProjects(loadedProjects);
      } catch (error) {
        console.error(
          "Project loading failed:",
          error,
        );

        setProjectsError(
          error instanceof Error
            ? error.message
            : "Projects could not be loaded.",
        );
      } 
      
      finally {
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

          {isSystemAdmin && (
            <Link
              className="projects-admin-button"
              to="/admin/projects"
            >
              Admin
            </Link>
          )}

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