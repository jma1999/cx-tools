import {
  useEffect,
  useState,
} from "react";

import type {
  ProjectSetupFloor,
} from "../../services/projectAdmin";

import {
  commitProjectFloorAssets,
} from "../../services/projectAdmin";

import {
  listPanelReferenceImages,
  prepareRegionFile,
  uploadFloorVisualAssets,
  uploadPanelReferenceImages,
} from "../../services/projectSetupAssets";

interface FloorFilesCardProps {
  projectId: string;

  floor:
    ProjectSetupFloor;

  onUpdated:
    () => Promise<void>;
}

export default function FloorFilesCard({
  projectId,
  floor,
  onUpdated,
}: FloorFilesCardProps) {
  const [
    planFile,
    setPlanFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    regionFile,
    setRegionFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    panelFiles,
    setPanelFiles,
  ] =
    useState<File[]>([]);

  const [
    uploadedPanelImages,
    setUploadedPanelImages,
  ] =
    useState<string[]>([]);

  const [
    savingVisuals,
    setSavingVisuals,
  ] =
    useState(false);

  const [
    savingPanels,
    setSavingPanels,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function refreshImages():
    Promise<void> {
    try {
      const names =
        await listPanelReferenceImages(
          projectId,
          floor.id,
        );

      setUploadedPanelImages(
        names,
      );
    } catch {
      /*
       * Empty folder is fine during
       * initial project setup.
       */
      setUploadedPanelImages(
        [],
      );
    }
  }

  useEffect(() => {
    void refreshImages();
  }, [
    projectId,
    floor.id,
  ]);

  async function saveVisuals():
    Promise<void> {
    if (
      !planFile ||
      !regionFile
    ) {
      setError(
        "Select both the SVG floor plan and clickable regions file.",
      );

      return;
    }

    setSavingVisuals(
      true,
    );

    setError("");
    setMessage("");

    try {
      const prepared =
        await prepareRegionFile(
          regionFile,
          projectId,
          floor.id,
        );

      const uploaded =
        await uploadFloorVisualAssets(
          projectId,
          floor.id,
          planFile,
          prepared.data,
        );

      await commitProjectFloorAssets(
        projectId,
        floor.id,
        uploaded.planPath,
        uploaded.regionsUrl,
      );

      setMessage(
        `${prepared.regionCount} clickable regions and floor plan saved.`,
      );

      setPlanFile(null);
      setRegionFile(null);

      await onUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Floor files could not be saved.",
      );
    } finally {
      setSavingVisuals(
        false,
      );
    }
  }

  async function savePanelImages():
    Promise<void> {
    if (
      panelFiles.length ===
      0
    ) {
      return;
    }

    setSavingPanels(
      true,
    );

    setError("");
    setMessage("");

    try {
      const count =
        await uploadPanelReferenceImages(
          projectId,
          floor.id,
          panelFiles,
        );

      setPanelFiles([]);

      await refreshImages();

      setMessage(
        `${count} panel reference image${
          count === 1
            ? ""
            : "s"
        } uploaded.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Panel reference images could not be uploaded.",
      );
    } finally {
      setSavingPanels(
        false,
      );
    }
  }

  return (
    <article className="floor-files-card">
      <div className="floor-files-header">
        <div>
          <p className="eyebrow">
            Floor {floor.id}
          </p>

          <h3>
            {floor.label}
          </h3>
        </div>

        <span
          className={
            floor.regionsUrl &&
            floor.planPath
              ? "admin-status-badge active"
              : "admin-status-badge pending"
          }
        >
          {floor.regionsUrl &&
          floor.planPath
            ? "Plan ready"
            : "Needs files"}
        </span>
      </div>

      <div className="floor-file-status-grid">
        <div>
          <span>
            Commissioning data
          </span>

          <strong>
            {floor.spacesUrl
              ? "Imported"
              : "Missing"}
          </strong>
        </div>

        <div>
          <span>
            Floor plan
          </span>

          <strong>
            {floor.planPath
              ? "Uploaded"
              : "Missing"}
          </strong>
        </div>

        <div>
          <span>
            Clickable regions
          </span>

          <strong>
            {floor.regionsUrl
              ? "Uploaded"
              : "Missing"}
          </strong>
        </div>

        <div>
          <span>
            Panel references
          </span>

          <strong>
            {
              uploadedPanelImages.length
            }{" "}
            uploaded
          </strong>
        </div>
      </div>

      <div className="floor-upload-section">
        <h4>
          Floor plan & regions
        </h4>

        <label>
          <span>
            Base floor drawing
          </span>

          <input
            type="file"
            accept=".svg,image/svg+xml"
            disabled={
              savingVisuals
            }
            onChange={(event) =>
              setPlanFile(
                event.target
                  .files?.[0] ??
                  null,
              )
            }
          />
        </label>

        <label>
          <span>
            Clickable regions
          </span>

          <input
            type="file"
            accept=".json,application/json"
            disabled={
              savingVisuals
            }
            onChange={(event) =>
              setRegionFile(
                event.target
                  .files?.[0] ??
                  null,
              )
            }
          />
        </label>

        <button
          type="button"
          className="primary-button"
          disabled={
            savingVisuals ||
            !planFile ||
            !regionFile
          }
          onClick={() =>
            void saveVisuals()
          }
        >
          {savingVisuals
            ? "Saving…"
            : floor.planPath
              ? "Replace floor files"
              : "Save floor files"}
        </button>
      </div>

      <div className="floor-upload-section">
        <h4>
          ELE-panel references
        </h4>

        <p>
          Upload the screenshots
          referenced by the Excel
          workbook. File names must
          match exactly.
        </p>

        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          disabled={
            savingPanels
          }
          onChange={(event) =>
            setPanelFiles(
              Array.from(
                event.target
                  .files ?? [],
              ),
            )
          }
        />

        <button
          type="button"
          className="secondary-button"
          disabled={
            savingPanels ||
            panelFiles.length ===
              0
          }
          onClick={() =>
            void savePanelImages()
          }
        >
          {savingPanels
            ? "Uploading…"
            : `Upload ${
                panelFiles.length ||
                ""
              } reference images`}
        </button>

        {uploadedPanelImages.length >
          0 && (
          <div className="uploaded-panel-file-list">
            {uploadedPanelImages.map(
              (name) => (
                <span key={name}>
                  ✓ {name}
                </span>
              ),
            )}
          </div>
        )}
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
    </article>
  );
}