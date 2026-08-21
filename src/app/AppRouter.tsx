import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "../auth/ProtectedRoute";
import LoginPage from "../pages/LoginPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectWorkspacePage from "../pages/ProjectWorkspacePage";
import ProjectAdminPage from "../pages/ProjectAdminPage";
import AdminProjectsPage from "../pages/AdminProjectsPage";
import ProjectSetupPage from "../pages/ProjectSetupPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/projects"
            element={<ProjectsPage />}
          />

          <Route
            path="/projects/:projectId"
            element={<ProjectWorkspacePage />}
          />

          <Route
            path="/projects/:projectId/admin"
            element={<ProjectAdminPage />}
          />

          <Route
            path="/admin/projects/:projectId/setup"
            element={<ProjectSetupPage />}
          />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/projects"
              replace
            />
          }
        />

        <Route
          path="/admin/projects"
          element={
            <AdminProjectsPage />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}