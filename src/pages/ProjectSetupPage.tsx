import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import {
  firestoreDb,
} from "../auth/firebase";

import {
  upsertProjectFloor,
} from "../services/projectAdmin";

import type {
  ProjectSetupFloor,
} from "../services/projectAdmin";

import {
  validateCommissioningWorkbook,
} from "../services/commissioningImport";

import type {
  CommissioningImportSummary,
} from "../services/commissioningImport";

interface SetupProject {
  id: string;
  name: string;
  code: string;
  description: string;
  spreadsheetId: string;
  status: string;
}

export default function ProjectSetupPage() {
  const {
    projectId,
  } = useParams<{
    projectId: string;
  }>();

  const [
    project,
    setProject,
  ] = useState<
    SetupProject | null
  >(null);

  const [
    floors,
    setFloors,
  ] = useState<
    ProjectSetupFloor[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    floorId,
    setFloorId,
  ] = useState("");

  const [
    floorLabel,
    setFloorLabel,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    commissioningFile,
    setCommissioningFile,
  ] = useState<File | null>(
    null,
  );

  const [
    importSummary,
    setImportSummary,
  ] =
    useState<CommissioningImportSummary | null>(
      null,
    );

  const [
    validatingImport,
    setValidatingImport,
  ] = useState(false);

  async function loadSetup():
    Promise<void> {
    if (!projectId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const projectSnapshot =
        await getDoc(
          doc(
            firestoreDb,
            "projects",
            projectId,
          ),
        );

      if (
        !projectSnapshot.exists()
      ) {
        throw new Error(
          "Project could not be found.",
        );
      }

      const data =
        projectSnapshot.data();

      setProject({
        id:
          projectSnapshot.id,

        name:
          typeof data.name ===
            "string"
            ? data.name
            : projectSnapshot.id,

        code:
          typeof data.code ===
            "string"
            ? data.code
            : "",

        description:
          typeof data.description ===
            "string"
            ? data.description
            : "",

        spreadsheetId:
          typeof data.spreadsheetId ===
            "string"
            ? data.spreadsheetId
            : "",

        status:
          typeof data.status ===
            "string"
            ? data.status
            : "draft",
      });

      const floorSnapshot =
        await getDocs(
          query(
            collection(
              firestoreDb,
              "projects",
              projectId,
              "floors",
            ),
            orderBy("order"),
          ),
        );

      setFloors(
        floorSnapshot.docs.map(
          (floorDoc) => {
            const floorData =
              floorDoc.data();

            return {
              id:
                floorDoc.id,

              label:
                typeof floorData.label ===
                  "string"
                  ? floorData.label
                  : floorDoc.id,

              order:
                typeof floorData.order ===
                  "number"
                  ? floorData.order
                  : 0,
            };
          },
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Project setup could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSetup();
  }, [projectId]);

  async function handleAddFloor():
    Promise<void> {
    if (
      !projectId ||
      !floorId.trim() ||
      !floorLabel.trim()
    ) {
      setError(
        "Enter both a floor ID and floor name.",
      );

      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const savedFloor =
        await upsertProjectFloor(
          projectId,
          floorId.trim(),
          floorLabel.trim(),
          floors.length + 1,
        );

      setFloors((current) => {
        const withoutExisting =
          current.filter(
            (floor) =>
              floor.id !== savedFloor.id,
          );

        return [
          ...withoutExisting,
          savedFloor,
        ].sort(
          (a, b) =>
            a.order - b.order,
        );
      });

      setFloorId("");
      setFloorLabel("");

      setMessage(
        `${savedFloor.label} added successfully.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The floor could not be added.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="project-setup-page">
        Loading project setup…
      </main>
    );
  }

  if (!project) {
    return (
      <main className="project-setup-page">
        {error ||
          "Project could not be loaded."}
      </main>
    );
  }

  return (
    <main className="project-setup-page">
      <header className="project-setup-header">
        <div>
          <p className="eyebrow">
            Project setup
          </p>

          <h1>
            {project.name}
          </h1>

          <p>
            Complete the project
            configuration before
            publishing.
          </p>
        </div>

        <Link
          to="/admin/projects"
          className="secondary-button"
        >
          Back to projects
        </Link>
      </header>

      <nav className="setup-steps">
        <div className="setup-step complete">
          <span>1</span>

          <div>
            <strong>
              Project details
            </strong>

            <small>
              Complete
            </small>
          </div>
        </div>

        <div className="setup-step active">
          <span>2</span>

          <div>
            <strong>
              Floors
            </strong>

            <small>
              {floors.length} added
            </small>
          </div>
        </div>

        <div className="setup-step">
          <span>3</span>

          <div>
            <strong>
              Project files
            </strong>

            <small>
              Not configured
            </small>
          </div>
        </div>

        <div className="setup-step">
          <span>4</span>

          <div>
            <strong>
              Google Sheet
            </strong>

            <small>
              Not configured
            </small>
          </div>
        </div>

        <div className="setup-step">
          <span>5</span>

          <div>
            <strong>
              Validate
            </strong>

            <small>
              Pending
            </small>
          </div>
        </div>

        <div className="setup-step">
          <span>6</span>

          <div>
            <strong>
              Publish
            </strong>

            <small>
              Pending
            </small>
          </div>
        </div>
      </nav>

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

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>
              Floors
            </h2>

            <p>
              Add each floor that will
              appear in the commissioning
              workspace.
            </p>
          </div>
        </div>

        <div className="setup-floor-form">
          <label>
            <span>
              Floor ID
            </span>

            <input
              value={floorId}
              placeholder="03"
              disabled={saving}
              onChange={(event) =>
                setFloorId(
                  event.target.value,
                )
              }
            />

            <small>
              Stable internal ID,
              e.g. 03, 04, L1.
            </small>
          </label>

          <label>
            <span>
              Display name
            </span>

            <input
              value={floorLabel}
              placeholder="Floor 03"
              disabled={saving}
              onChange={(event) =>
                setFloorLabel(
                  event.target.value,
                )
              }
            />

            <small>
              What users see in the
              floor selector.
            </small>
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={
              saving ||
              !floorId.trim() ||
              !floorLabel.trim()
            }
            onClick={() =>
              void handleAddFloor()
            }
          >
            {saving
              ? "Adding…"
              : "+ Add floor"}
          </button>
        </div>

        <div className="setup-floor-list">
          {floors.length === 0 ? (
            <div className="admin-empty-state">
              No floors added yet.
            </div>
          ) : (
            floors.map(
              (
                floor,
                index,
              ) => (
                <div
                  className="setup-floor-row"
                  key={floor.id}
                >
                  <div className="setup-floor-number">
                    {index + 1}
                  </div>

                  <div>
                    <strong>
                      {floor.label}
                    </strong>

                    <span>
                      ID: {floor.id}
                    </span>
                  </div>

                  <span className="admin-status-badge active">
                    Added
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>
              Commissioning data
            </h2>

            <p>
              Complete our Excel template
              and cxTools will convert it
              into the application data
              automatically.
            </p>
          </div>
        </div>

        <div className="commissioning-import-card">
          <div className="commissioning-template-block">
            <div>
              <strong>
                cxTools Excel template
              </strong>

              <p>
                Includes lighting fixtures,
                controls, ELE-panel samples
                and circuit definitions.
              </p>
            </div>

            <a
              className="secondary-button"
              href="/templates/cxTools-commissioning-data-template.xlsx"
              download
            >
              Download Excel template
            </a>
          </div>

          <div className="commissioning-upload-block">
            <label className="commissioning-file-picker">
              <span>
                Upload completed workbook
              </span>

              <input
                type="file"
                accept=".xlsx"
                disabled={
                  validatingImport
                }
                onChange={async (
                  event,
                ) => {
                  const file =
                    event.target
                      .files?.[0];

                  if (!file) {
                    return;
                  }

                  setCommissioningFile(
                    file,
                  );

                  setImportSummary(
                    null,
                  );

                  setError("");
                  setMessage("");

                  setValidatingImport(
                    true,
                  );

                  try {
                    const summary =
                      await validateCommissioningWorkbook(
                        file,
                      );

                    setImportSummary(
                      summary,
                    );
                  } catch (err) {
                    setError(
                      err instanceof
                      Error
                        ? err.message
                        : "The workbook could not be read.",
                    );
                  } finally {
                    setValidatingImport(
                      false,
                    );
                  }
                }}
              />
            </label>

            {commissioningFile && (
              <div className="uploaded-file-name">
                {
                  commissioningFile.name
                }
              </div>
            )}

            {validatingImport && (
              <div className="admin-empty-state">
                Checking workbook…
              </div>
            )}
          </div>
        </div>

        {importSummary && (
          <div className="import-validation-results">
            <div className="import-summary-grid">
              <div>
                <span>
                  Spaces
                </span>

                <strong>
                  {
                    importSummary.spaces
                  }
                </strong>
              </div>

              <div>
                <span>
                  Fixture / control items
                </span>

                <strong>
                  {
                    importSummary
                      .commissioningItems
                  }
                </strong>
              </div>

              <div>
                <span>
                  ELE-panel samples
                </span>

                <strong>
                  {
                    importSummary
                      .panelTests
                  }
                </strong>
              </div>

              <div>
                <span>
                  Panel circuits
                </span>

                <strong>
                  {
                    importSummary
                      .panelCircuits
                  }
                </strong>
              </div>
            </div>

            {importSummary.errors.length ===
            0 ? (
              <div className="admin-success-message">
                Workbook passed
                structural validation.
              </div>
            ) : (
              <div className="import-issue-list">
                <strong>
                  Fix these before import
                </strong>

                {importSummary.errors.map(
                  (
                    issue,
                    index,
                  ) => (
                    <div
                      key={
                        `${issue.sheet}-${issue.row}-${index}`
                      }
                      className="import-error-row"
                    >
                      <span>
                        {
                          issue.sheet
                        }
                        {issue.row
                          ? ` · Row ${issue.row}`
                          : ""}
                      </span>

                      <p>
                        {
                          issue.message
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {floors.length > 0 && (
        <div className="setup-footer">
          <span>
            {floors.length} floor
            {floors.length === 1
              ? ""
              : "s"}{" "}
            configured
          </span>

          <button
            type="button"
            className="primary-button"
            disabled
          >
            Continue to project files →
          </button>
        </div>
      )}
    </main>
  );
}