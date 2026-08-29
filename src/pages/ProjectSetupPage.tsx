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
  commitCommissioningImport,
  configureProjectSpreadsheet,
} from "../services/projectAdmin";

import type {
  ProjectSetupFloor,
} from "../services/projectAdmin";

import {
  validateCommissioningWorkbook,
  prepareCommissioningImport,
} from "../services/commissioningImport";

import type {
  CommissioningImportSummary,
} from "../services/commissioningImport";

import {
  uploadCommissioningImport,
} from "../services/projectSetupAssets";

import FloorFilesCard from "../features/projectSetup/FloorFilesCard";

import {
  connectGoogleSheets,
  prepareCxToolsSpreadsheet,
} from "../services/googleSheets";

import type {
  GoogleSheetSetupResult,
  GoogleUser,
} from "../services/googleSheets";

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

  const [
    activeStep,
    setActiveStep,
  ] = useState<2 | 3 | 4>(2);

  const [
    importingWorkbook,
    setImportingWorkbook,
  ] = useState(false);

  const [
    workbookImported,
    setWorkbookImported,
  ] = useState(false);

  const [
    spreadsheetReference,
    setSpreadsheetReference,
  ] = useState(
    project?.spreadsheetId ??
      "",
  );
  
  const [
    setupGoogleUser,
    setSetupGoogleUser,
  ] =
    useState<GoogleUser | null>(
      null,
    );
  
  const [
    sheetSetupResult,
    setSheetSetupResult,
  ] =
    useState<GoogleSheetSetupResult | null>(
      null,
    );
  
  const [
    preparingSheet,
    setPreparingSheet,
  ] =
    useState(false);

  async function loadSetup(
    showPageLoader = true,
  ): Promise<void> {
    if (!projectId) {
      return;
    }

    if (showPageLoader) {
      setLoading(true);
    }

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
              
                spacesUrl:
                  typeof floorData.spacesUrl ===
                  "string"
                    ? floorData.spacesUrl
                    : "",
              
                regionsUrl:
                  typeof floorData.regionsUrl ===
                  "string"
                    ? floorData.regionsUrl
                    : "",
              
                panelTestsUrl:
                  typeof floorData.panelTestsUrl ===
                  "string"
                    ? floorData.panelTestsUrl
                    : "",
              
                planPath:
                  typeof floorData.planPath ===
                  "string"
                    ? floorData.planPath
                    : "",
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
      if (showPageLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadSetup();
  }, [projectId]);

  useEffect(() => {
    if (
      project?.spreadsheetId
    ) {
      setSpreadsheetReference(
        project.spreadsheetId,
      );
    }
  }, [
    project?.spreadsheetId,
  ]);

  const projectFilesReady =
    floors.length > 0 &&
    floors.every(
      (floor) =>
        Boolean(
          floor.spacesUrl,
        ) &&
        Boolean(
          floor.panelTestsUrl,
        ) &&
        Boolean(
          floor.regionsUrl,
        ) &&
        Boolean(
          floor.planPath,
        ),
    );

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

        <div
          className={`setup-step ${
            activeStep === 2
              ? "active"
              : "complete"
          }`}
        >
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

        <div
          className={`setup-step ${
            activeStep === 3
              ? "active"
              : activeStep > 3
                ? "complete"
                : ""
          }`}
        >
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

        <div
          className={`setup-step ${
            activeStep === 4
              ? "active"
              : ""
          }`}
        >
          <span>4</span>

          <div>
            <strong>
              Google Sheet
            </strong>

            <small>
              {project.spreadsheetId
                ? "Configured"
                : "Not configured"}
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

      {activeStep === 2 && (
        <>
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
                onClick={() =>
                  setActiveStep(3)
                }
              >
                Continue to project files →
              </button>
            </div>
          )}
        </>
      )}

      {activeStep === 3 && (
        <>
          <button
            type="button"
            className="setup-back-button"
            onClick={() =>
              setActiveStep(2)
            }
          >
            ← Back to floors
          </button>

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

            {importSummary &&
              importSummary.errors.length ===
                0 &&
              commissioningFile && (
              <div className="setup-import-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    importingWorkbook
                  }
                  onClick={async () => {
                    if (
                      !projectId ||
                      !commissioningFile
                    ) {
                      return;
                    }

                    setImportingWorkbook(
                      true,
                    );

                    setError("");
                    setMessage("");

                    try {
                      const prepared =
                        await prepareCommissioningImport(
                          commissioningFile,
                          projectId,
                          floors.map(
                            (floor) =>
                              floor.id,
                          ),
                        );

                      if (
                        prepared.summary
                          .errors.length >
                        0
                      ) {
                        setImportSummary(
                          prepared.summary,
                        );

                        return;
                      }

                      const uploaded =
                        await uploadCommissioningImport(
                          projectId,
                          commissioningFile,
                          prepared.floors,
                        );

                      await commitCommissioningImport(
                        projectId,
                        uploaded.sourceWorkbookPath,
                        uploaded.floors,
                      );

                      setWorkbookImported(
                        true,
                      );

                      setMessage(
                        "Commissioning data imported successfully.",
                      );
                    } catch (err) {
                      console.error(
                        "Commissioning import failed:",
                        err,
                      );

                      setError(
                        err instanceof Error ?
                          err.message :
                          "Commissioning data could not be imported.",
                      );
                    } finally {
                      setImportingWorkbook(
                        false,
                      );
                    }
                  }}
                >
                  {importingWorkbook ?
                    "Importing…" :
                    "Import validated workbook"}
                </button>
              </div>
            )}

            {workbookImported && (
              <div className="import-complete-card">
                <strong>
                  Commissioning data ready
                </strong>

                <p>
                  cxTools generated and securely
                  stored the lighting, controls
                  and ELE-panel data for this
                  project.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      {activeStep === 3 && (
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>
                Floor files
              </h2>

              <p>
                Add the visual floor files
                and panel references for
                each configured floor.
              </p>
            </div>
          </div>

          <div className="floor-files-list">
            {floors.map(
              (floor) => (
                <FloorFilesCard
                  key={floor.id}
                  projectId={
                    projectId!
                  }
                  floor={floor}
                  onUpdated={() =>
                    loadSetup(false)
                  }
                />
              ),
            )}
          </div>
        </section>
      )}

      {activeStep === 3 && (
        <div className="setup-footer">
          <span>
            {projectFilesReady
              ? "Project files configured"
              : "Complete the required floor files before continuing"}
          </span>

          <button
            type="button"
            className="primary-button"
            disabled={!projectFilesReady}
            onClick={() => setActiveStep(4)}
          >
            Continue to Google Sheet →
          </button>
        </div>
      )}

      {activeStep === 4 && (
        <>
          <button
            type="button"
            className="setup-back-button"
            onClick={() =>
              setActiveStep(3)
            }
          >
            ← Back to project files
          </button>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>
                  Google Sheet
                </h2>

                <p>
                  Connect the shared Sheet
                  where cxTools will store
                  commissioning results,
                  issues and activity.
                </p>
              </div>
            </div>

            <div className="sheet-setup-card">
              <label>
                <span>
                  Google Sheet URL
                </span>

                <input
                  type="text"
                  value={
                    spreadsheetReference
                  }
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  disabled={
                    preparingSheet
                  }
                  onChange={(
                    event,
                  ) => {
                    setSpreadsheetReference(
                      event.target.value,
                    );

                    setSheetSetupResult(
                      null,
                    );
                  }}
                />
              </label>

              <div className="sheet-google-account">
                {setupGoogleUser ? (
                  <div>
                    <span>
                      Connected as
                    </span>

                    <strong>
                      {
                        setupGoogleUser.email
                      }
                    </strong>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      setError("");

                      try {
                        const user =
                          await connectGoogleSheets();

                        setSetupGoogleUser(
                          user,
                        );
                      } catch (err) {
                        setError(
                          err instanceof
                          Error
                            ? err.message
                            : "Google Sheets could not be connected.",
                        );
                      }
                    }}
                  >
                    Connect Google Sheets
                  </button>
                )}
              </div>

              <button
                type="button"
                className="primary-button"
                disabled={
                  preparingSheet ||
                  !setupGoogleUser ||
                  !spreadsheetReference.trim()
                }
                onClick={async () => {
                  if (!projectId) {
                    return;
                  }

                  setPreparingSheet(
                    true,
                  );

                  setError("");
                  setMessage("");
                  setSheetSetupResult(
                    null,
                  );

                  try {
                    const result =
                      await prepareCxToolsSpreadsheet(
                        spreadsheetReference,
                      );

                    setSheetSetupResult(
                      result,
                    );

                    if (
                      result.issues
                        .length === 0
                    ) {
                      await configureProjectSpreadsheet(
                        projectId,
                        result.spreadsheetId,
                        result.spreadsheetTitle,
                      );

                      setMessage(
                        "Google Sheet configured successfully.",
                      );

                      await loadSetup(
                        false,
                      );
                    }
                  } catch (err) {
                    console.error(
                      "Google Sheet setup failed:",
                      err,
                    );

                    setError(
                      err instanceof
                      Error
                        ? err.message
                        : "The Google Sheet could not be prepared.",
                    );
                  } finally {
                    setPreparingSheet(
                      false,
                    );
                  }
                }}
              >
                {preparingSheet
                  ? "Checking & preparing…"
                  : "Verify & prepare Sheet"}
              </button>
            </div>

            {sheetSetupResult && (
              <div className="sheet-validation-results">
                <div className="sheet-summary-grid">
                  <div>
                    <span>
                      Spreadsheet
                    </span>

                    <strong>
                      {
                        sheetSetupResult
                          .spreadsheetTitle
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      cxTools tabs
                    </span>

                    <strong>
                      {
                        sheetSetupResult
                          .readySheets
                          .length
                      }
                      {" / "}
                      {
                        sheetSetupResult
                          .requiredSheetCount
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Created now
                    </span>

                    <strong>
                      {
                        sheetSetupResult
                          .createdSheets
                          .length
                      }
                    </strong>
                  </div>
                </div>

                {sheetSetupResult
                  .issues.length ===
                0 ? (
                  <div className="admin-success-message">
                    Google Sheet is ready
                    for cxTools.
                  </div>
                ) : (
                  <div className="import-issue-list">
                    <strong>
                      Sheet setup needs
                      attention
                    </strong>

                    {sheetSetupResult
                      .issues.map(
                        (
                          issue,
                          index,
                        ) => (
                          <div
                            className="import-error-row"
                            key={`${issue.sheet}-${index}`}
                          >
                            <span>
                              {
                                issue.sheet
                              }
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

          {project.spreadsheetId &&
            sheetSetupResult &&
            sheetSetupResult
              .issues.length ===
              0 && (
              <div className="setup-footer">
                <span>
                  Google Sheet configured
                </span>

                <button
                  type="button"
                  className="primary-button"
                  disabled
                >
                  Continue to validation →
                </button>
              </div>
            )}
        </>
      )}

    </main>
  );
}