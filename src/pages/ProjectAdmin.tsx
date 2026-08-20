import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  Navigate,
} from "react-router-dom";

import {
  grantProjectAccess,
  listProjectPeople,
  revokeProjectAccess,
} from "../services/projectAdmin";

import type {
  PendingProjectInvite,
  ProjectMember,
  ProjectRole,
} from "../services/projectAdmin";

import {
  useProject,
} from "../projects/ProjectProvider";

const ROLE_LABELS:
  Record<ProjectRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export default function ProjectAdmin() {
  const {
    project,
    membership,
    permissions,
  } = useProject();

  const [members, setMembers] =
    useState<ProjectMember[]>([]);

  const [
    pendingInvites,
    setPendingInvites,
  ] = useState<
    PendingProjectInvite[]
  >([]);

  const [email, setEmail] =
    useState("");

  const [role, setRole] =
    useState<ProjectRole>("editor");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function refreshPeople():
    Promise<void> {
    setLoading(true);
    setError("");

    try {
      const data =
        await listProjectPeople(
          project.id,
        );

      setMembers(
        data.members ?? [],
      );

      setPendingInvites(
        data.pendingInvites ?? [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Project members could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshPeople();
  }, [project.id]);

  async function handleGrantAccess():
    Promise<void> {
    const trimmedEmail =
      email.trim();

    if (!trimmedEmail) {
      setError(
        "Enter an email address.",
      );

      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result =
        await grantProjectAccess(
          project.id,
          trimmedEmail,
          role,
        );

      setEmail("");

      setMessage(
        result.status === "active"
          ? `Access granted to ${result.email}.`
          : `Invitation prepared for ${result.email}. Access will activate when they first sign in.`,
      );

      await refreshPeople();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Access could not be granted.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(
    targetEmail: string,
  ): Promise<void> {
    const confirmed =
      window.confirm(
        `Revoke project access for ${targetEmail}?`,
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await revokeProjectAccess(
        project.id,
        targetEmail,
      );

      setMessage(
        `Access revoked for ${targetEmail}.`,
      );

      await refreshPeople();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Access could not be revoked.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(
    member: ProjectMember,
    nextRole: ProjectRole,
  ): Promise<void> {
    if (
      nextRole === member.role
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await grantProjectAccess(
        project.id,
        member.email,
        nextRole,
      );

      setMessage(
        `${member.email} is now ${ROLE_LABELS[nextRole]}.`,
      );

      await refreshPeople();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The role could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    !permissions.canManageMembers
  ) {
    return (
      <Navigate
        to={`/projects/${project.id}`}
        replace
      />
    );
  }

  return (
    <main className="project-admin-page">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">
            Project administration
          </p>

          <h1>
            {project.name}
          </h1>

          <p>
            Manage who can access
            this commissioning
            project.
          </p>
        </div>

        <Link
          className="secondary-button"
          to={`/projects/${project.id}`}
        >
          Back to workspace
        </Link>
      </header>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>Add person</h2>

            <p>
              Grant access by email.
              Users who have not used
              cxTools yet will appear as
              pending until first sign-in.
            </p>
          </div>
        </div>

        <div className="admin-invite-form">
          <label>
            <span>Email</span>

            <input
              type="email"
              value={email}
              placeholder="engineer@company.com"
              disabled={saving}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Role</span>

            <select
              value={role}
              disabled={saving}
              onChange={(event) =>
                setRole(
                  event.target
                    .value as ProjectRole,
                )
              }
            >
              <option value="admin">
                Admin
              </option>

              <option value="editor">
                Editor
              </option>

              <option value="viewer">
                Viewer
              </option>
            </select>
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() =>
              void handleGrantAccess()
            }
          >
            {saving
              ? "Saving…"
              : "Grant access"}
          </button>
        </div>

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
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>People</h2>

            <p>
              Active project members and
              their access levels.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={
              loading || saving
            }
            onClick={() =>
              void refreshPeople()
            }
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            Loading people…
          </div>
        ) : members.length === 0 ? (
          <div className="admin-empty-state">
            No active members found.
          </div>
        ) : (
          <div className="admin-people-list">
            {members.map(
              (member) => {
                const isCurrentUser =
                  member.uid ===
                  membership.uid;

                return (
                  <div
                    className="admin-person-row"
                    key={member.uid}
                  >
                    <div className="admin-person-avatar">
                      {(
                        member.displayName ||
                        member.email ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="admin-person-details">
                      <strong>
                        {member.displayName ||
                          member.email}
                      </strong>

                      {member.displayName && (
                        <span>
                          {member.email}
                        </span>
                      )}
                    </div>

                    <span className="admin-status-badge active">
                      Active
                    </span>

                    <select
                      className="admin-role-select"
                      value={member.role}
                      disabled={
                        saving ||
                        isCurrentUser
                      }
                      onChange={(event) =>
                        void handleRoleChange(
                          member,
                          event.target
                            .value as ProjectRole,
                        )
                      }
                    >
                      <option value="admin">
                        Admin
                      </option>

                      <option value="editor">
                        Editor
                      </option>

                      <option value="viewer">
                        Viewer
                      </option>
                    </select>

                    <button
                      type="button"
                      className="admin-revoke-button"
                      disabled={
                        saving ||
                        isCurrentUser
                      }
                      onClick={() =>
                        void handleRevoke(
                          member.email,
                        )
                      }
                    >
                      {isCurrentUser
                        ? "You"
                        : "Revoke"}
                    </button>
                  </div>
                );
              },
            )}
          </div>
        )}

        {pendingInvites.length >
          0 && (
          <>
            <div className="admin-subheading">
              <h3>
                Pending access
              </h3>

              <span>
                {
                  pendingInvites.length
                }
              </span>
            </div>

            <div className="admin-people-list">
              {pendingInvites.map(
                (invite) => (
                  <div
                    className="admin-person-row"
                    key={invite.id}
                  >
                    <div className="admin-person-avatar pending">
                      {invite.email
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="admin-person-details">
                      <strong>
                        {invite.email}
                      </strong>

                      <span>
                        Waiting for first
                        sign-in
                      </span>
                    </div>

                    <span className="admin-status-badge pending">
                      Pending
                    </span>

                    <span className="admin-role-label">
                      {
                        ROLE_LABELS[
                          invite.role
                        ]
                      }
                    </span>

                    <button
                      type="button"
                      className="admin-revoke-button"
                      disabled={saving}
                      onClick={() =>
                        void handleRevoke(
                          invite.email,
                        )
                      }
                    >
                      Revoke
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}