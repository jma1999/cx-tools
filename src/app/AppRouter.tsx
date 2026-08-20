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
      </Routes>
    </BrowserRouter>
  );
}