import { useEffect, useState } from "react";

import FloorPlan from "../features/commissioning/FloorPlan";
import type { FloorId } from "../features/commissioning/FloorPlan";
import type { ProjectConfig } from "../projects/projectTypes";

import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

import {
  connectGoogleSheets,
  disconnectGoogleSheets,
  initializeGoogleSheets,
  type GoogleUser,
} from "../services/googleSheets";

interface ProjectWorkspaceProps {
  project: ProjectConfig;
}

type AuthStatus =
  | "initializing"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export default function ProjectWorkspace({
  project,
}: ProjectWorkspaceProps) {
  const [selectedFloor, setSelectedFloor] =
    useState<FloorId>(project.floors[0].id);

  const { appUser, signOut } = useAuth();

  const [googleUser, setGoogleUser] =
    useState<GoogleUser | null>(null);

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("initializing");

  const [authError, setAuthError] = useState("");

  const selectedFloorConfig =
    project.floors.find(
      (floor) => floor.id === selectedFloor,
    ) ?? project.floors[0];

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
        </div>

        <div className="header-actions">
          {/* Keep your existing Google connection controls here. */}
          <div className="workspace-app-account">
            <span>{appUser?.email}</span>

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
                  selectedFloor === floor.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSelectedFloor(floor.id)
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

        
      </nav>

      <FloorPlan
        key={`${project.id}-${selectedFloor}-${googleUser?.email ?? "local"}`}
        projectId={project.id}
        floor={selectedFloor}
        floorDataUrl={selectedFloorConfig.spacesUrl}
        regionDataUrl={selectedFloorConfig.regionsUrl}
        googleUser={googleUser}
        onConnectGoogle={() =>
          void handleConnectGoogle()
        }
      />
    </main>
  );
}