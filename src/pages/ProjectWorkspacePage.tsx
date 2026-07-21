import { useParams } from "react-router-dom";

import ProjectWorkspace from "./ProjectWorkspace";
import { getProject } from "../projects/projectConfig";

export default function ProjectWorkspacePage() {
  const { projectId } =
    useParams<{ projectId: string }>();

  const project = getProject(projectId);

  if (!project) {
    return (
      <main className="empty-state error-state">
        <div>
          <h2>Project not found</h2>
          <p>
            The requested project does not exist or
            is no longer available.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ProjectWorkspace project={project} />
  );
}