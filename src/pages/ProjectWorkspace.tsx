import { useEffect, useMemo, useState } from "react";

import FloorPlan from "../features/commissioning/FloorPlan";
import type { FloorId } from "../features/commissioning/FloorPlan";
import type { ProjectConfig } from "../projects/projectTypes";
import { useProject } from "../projects/ProjectProvider";

import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

import {
  connectGoogleSheets,
  disconnectGoogleSheets,
  initializeGoogleSheets,
  createGoogleSheetsRepository,
  type GoogleUser,
} from "../services/googleSheets";

type AuthStatus =
  | "initializing"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export default function ProjectWorkspace() {
  const {
    project,
    membership,
    permissions,
    selectedFloor,
    setSelectedFloorId,
  } = useProject();

  const repository = useMemo(
    () =>
      createGoogleSheetsRepository(
        project.spreadsheetId,
      ),
    [project.spreadsheetId],
  );

  const { appUser, signOut } = useAuth();

  const [googleUser, setGoogleUser] =
    useState<GoogleUser | null>(null);

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("initializing");

  const [authError, setAuthError] = useState("");

  useEffect(() => {
    async function prepareGoogle(): Promise<void> {
      try {
        await initializeGoogleSheets();
        setAuthStatus("disconnected");
      } catch (error) {
        setAuthStatus("error");
        setAuthError(
          error instanceof Error
            ? error.message
            : "Google Sheets could not be initialized.",
        );
      }
    }

    void prepareGoogle();
  }, []);

  async function handleConnectGoogle(): Promise<void> {
    setAuthStatus("connecting");
    setAuthError("");

    try {
      const user = await connectGoogleSheets();
      setGoogleUser(user);
      setAuthStatus("connected");
    } catch (error) {
      setGoogleUser(null);
      setAuthStatus("disconnected");
    }
  }

  function handleDisconnectGoogle(): void {
    disconnectGoogleSheets();
    setGoogleUser(null);
    setAuthStatus("disconnected");
    setAuthError("");
  }

  return (
    <main className="app-shell">
      
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">
            RBGB Internal Tool
          </p>

          <h1>{project.code}</h1>

          <p className="header-description">
            {project.name}
          </p>

          <p className="workspace-access-summary">
            {membership.role === "admin" &&
              "Full project and commissioning access."}

            {membership.role === "editor" &&
              "Commissioning access. Space assignment and project settings are restricted."}

            {membership.role === "viewer" &&
              "Read-only access to commissioning records."}
          </p>
        </div>

        <div className="header-actions">
          {/* Keep your existing Google connection controls here. */}
          <div className="workspace-app-account">
            <span>{appUser?.email}</span>

            <span
              className={`workspace-role workspace-role-${membership.role}`}
            >
              {membership.role}
            </span>

            <button
              type="button"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
          <div className="floor-selector">
            {project.floors.map((floor) => (
              <button
                type="button"
                key={floor.id}
                className={
                  selectedFloor.id === floor.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSelectedFloorId(floor.id)
                }
              >
                {floor.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="workspace-top-nav">
        <Link
          to="/projects"
          className="workspace-back-link"
        >
          &lt;&lt; All projects
        </Link>

        {permissions.canManageMembers && (
          <Link
            className="workspace-admin-link"
            to={`/projects/${project.id}/admin`}
          >
            Admin
          </Link>
        )}
        
      </nav>

      <FloorPlan
        projectId={project.id}
        floor={selectedFloor.id}
        floorDataUrl={selectedFloor.spacesUrl}
        regionDataUrl={selectedFloor.regionsUrl}
        panelTestsUrl={selectedFloor.panelTestsUrl}
        repository={repository}
        googleUser={googleUser}
        onConnectGoogle={() =>
          void handleConnectGoogle()
        }
      />
    </main>
  );
}