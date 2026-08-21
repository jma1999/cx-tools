import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  firestoreDb,
} from "../auth/firebase";

import {
  useAuth,
} from "../auth/AuthProvider";

import {
  createProject,
  listAdminProjects,
} from "../services/projectAdmin";

import type {
  AdminProjectSummary,
} from "../services/projectAdmin";

export default function AdminProjectsPage() {
  const {
    appUser,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    projects,
    setProjects,
  ] = useState<
    AdminProjectSummary[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    authorized,
    setAuthorized,
  ] = useState<
    boolean | null
  >(null);

  const [
    showCreateForm,
    setShowCreateForm,
  ] = useState(false);

  const [name, setName] =
    useState("");

  const [code, setCode] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    spreadsheetId,
    setSpreadsheetId,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  async function loadAdminProjects():
    Promise<void> {
    if (!appUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userSnapshot =
        await getDoc(
          doc(
            firestoreDb,
            "users",
            appUser.uid,
          ),
        );

      const allowed =
        userSnapshot.data()
          ?.systemRole ===
        "admin";

      setAuthorized(
        allowed,
      );

      if (!allowed) {
        return;
      }

      const loadedProjects =
        await listAdminProjects();

      setProjects(
        loadedProjects,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Projects could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminProjects();
  }, [appUser?.uid]);

  async function handleCreateProject():
    Promise<void> {
    if (!name.trim()) {
      setError(
        "Enter a project name.",
      );

      return;
    }

    setCreating(true);
    setError("");

    try {
      const result =
        await createProject({
          name: name.trim(),
          code: code.trim(),
          description:
            description.trim(),
          spreadsheetId:
            spreadsheetId.trim(),
        });

      navigate(
        `/admin/projects/${result.projectId}/setup`,
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The project could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (
    authorized === false
  ) {
    return (
      <main className="admin-projects-page">
        <div className="admin-error-message">
          You do not have permission
          to manage cxTools projects.
        </div>

        <Link
          to="/projects"
          className="secondary-button"
        >
          Back to projects
        </Link>
      </main>
    );
  }

  return (
    <main className="admin-projects-page">
      <header className="admin-projects-header">
        <div>
          <p className="eyebrow">
            cxTools administration
          </p>

          <h1>
            Projects
          </h1>

          <p>
            Create and configure
            commissioning projects.
          </p>
        </div>

        <div className="admin-projects-header-actions">
          <Link
            to="/projects"
            className="secondary-button"
          >
            Back
          </Link>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setMessage("");
              setError("");
              setShowCreateForm(true);
            }}
          >
            + New project
          </button>
        </div>
      </header>

      {message && (
        <div className="admin-success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="admin-error-message">
          {error}
        </div>
      )}

      {showCreateForm && (
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>
                New project
              </h2>

              <p>
                Create the project
                shell first. Floors and
                project files come next.
              </p>
            </div>
          </div>

          <div className="new-project-form">
            <label>
              <span>
                Project name
              </span>

              <input
                type="text"
                value={name}
                placeholder="Example: North Tower Lighting Cx"
                disabled={
                  creating
                }
                onChange={(
                  event,
                ) =>
                  setName(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Project code
              </span>

              <input
                type="text"
                value={code}
                placeholder="NT-LCX"
                disabled={
                  creating
                }
                onChange={(
                  event,
                ) =>
                  setCode(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label className="full-width">
              <span>
                Description
              </span>

              <textarea
                rows={3}
                value={
                  description
                }
                placeholder="Optional project description"
                disabled={
                  creating
                }
                onChange={(
                  event,
                ) =>
                  setDescription(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label className="full-width">
              <span>
                Google Sheet ID
              </span>

              <input
                type="text"
                value={
                  spreadsheetId
                }
                placeholder="Optional for now"
                disabled={
                  creating
                }
                onChange={(
                  event,
                ) =>
                  setSpreadsheetId(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <div className="new-project-actions full-width">
              <button
                type="button"
                className="secondary-button"
                disabled={
                  creating
                }
                onClick={() => {
                  setShowCreateForm(false);
                  setName("");
                  setCode("");
                  setDescription("");
                  setSpreadsheetId("");
                  setError("");
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={
                  creating ||
                  !name.trim()
                }
                onClick={() =>
                  void handleCreateProject()
                }
              >
                {creating
                  ? "Creating…"
                  : "Create draft project"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>
              All projects
            </h2>

            <p>
              Draft, active and archived
              cxTools projects.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            Loading projects…
          </div>
        ) : projects.length ===
          0 ? (
          <div className="admin-empty-state">
            No projects yet.
          </div>
        ) : (
          <div className="admin-project-list">
            {projects.map(
              (project) => (
                <div
                  className="admin-project-row"
                  key={
                    project.id
                  }
                >
                  <div>
                    <strong>
                      {
                        project.name
                      }
                    </strong>

                    <span>
                      {project.code ||
                        project.id}
                    </span>
                  </div>

                  <span
                    className={`admin-project-status ${project.status}`}
                  >
                    {
                      project.status
                    }
                  </span>

                  <Link
                    className="secondary-button"
                    to={
                      project.status ===
                      "draft"
                        ? `/admin/projects/${project.id}/setup`
                        : `/projects/${project.id}`
                    }
                  >
                    {project.status ===
                    "draft"
                      ? "Continue setup"
                      : "Open"}
                  </Link>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}