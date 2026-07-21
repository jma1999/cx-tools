import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { PROJECTS } from "../projects/projectConfig";

export default function ProjectsPage() {
  const {
    appUser,
    signOut,
  } = useAuth();

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="eyebrow">
            RBGB
          </p>

          <h1>cxProjects</h1>

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
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="project-grid">
        {PROJECTS.map((project) => (
          <article
            className="project-card"
            key={project.id}
          >
            <p className="eyebrow">
              {project.code}
            </p>

            <h2>{project.name}</h2>

            {project.description && (
              <p>{project.description}</p>
            )}

            <span className="project-floor-list">
              {project.floors
                .map((floor) => floor.label)
                .join(" · ")}
            </span>

            <Link
              className="primary-button project-link"
              to={`/projects/${project.id}`}
            >
              Open project
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}