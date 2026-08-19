import {
  useEffect,
  useState,
  useMemo,
} from "react";

import type {
  ChecklistResult,
  FloorRegion,
  PanelTestDraftResult,
  PanelTestSpace,
} from "../../types/commissioning";

import type {
  SheetPanelIssue,
  SheetPanelTestResult,
} from "../../services/googleSheets";

import {
  loadImageAsset,
} from "../../services/projectAssets"

interface PanelTestingPanelProps {
  space: PanelTestSpace;
  region: FloorRegion;

  savedResults:
    SheetPanelTestResult[];

  issues:
    SheetPanelIssue[];

  googleConnected: boolean;

  readOnly: boolean;
  saving: boolean;

  onSave: (
    results:
      PanelTestDraftResult[],

    issueDescriptions:
      Record<string, string>,
  ) => void;

  onResolveIssue:
    (
      issue:
        SheetPanelIssue,
    ) => void;
}

const RESULT_OPTIONS: Array<{
  value: Exclude<
    ChecklistResult,
    "not_checked"
  >;
  label: string;
}> = [
  {
    value: "pass",
    label: "Pass",
  },
  {
    value: "issue",
    label: "Issue",
  },
  {
    value: "not_applicable",
    label: "N/A",
  },
];

export default function PanelTestingPanel({
  space,
  region,
  readOnly,
  saving,
  onSave,
  savedResults,
  issues,
  googleConnected,
  onResolveIssue,
}: PanelTestingPanelProps) {
  const [draftResults, setDraftResults] =
    useState<PanelTestDraftResult[]>([]);

  const [
    issueDescriptions,
    setIssueDescriptions,
  ] = useState<Record<string, string>>(
    {},
  );

  const [
    validationMessage,
    setValidationMessage,
  ] = useState("");

  const [
    referenceImageUrl,
    setReferenceImageUrl,
  ] = useState("");

  useEffect(() => {
    const savedByCircuitId = new Map(
      savedResults.map((result) => [
        result.circuitId,
        result,
      ]),
    );

    setDraftResults(
      space.circuits.map((circuit) => {
        const saved =
          savedByCircuitId.get(
            circuit.id,
          );

        return {
          circuitId: circuit.id,
          circuitNo: circuit.circuitNo,
          loadDescription:
            circuit.loadDescription,

          result:
            saved?.result ??
            "not_checked",

          notes:
            saved?.notes ?? "",
        };
      }),
    );

    setIssueDescriptions({});
    setValidationMessage("");
  }, [
    space.id,
    space.circuits,
    savedResults,
  ]);

  useEffect(() => {
    if (
      !space.referenceImagePath
    ) {
      setReferenceImageUrl("");
      return;
    }

    let cancelled = false;
    let objectUrl = "";

    async function loadReferenceImage():
      Promise<void> {
      try {
        const asset =
          await loadImageAsset(
            space.referenceImagePath!,
          );

        if (cancelled) {
          if (asset.revoke) {
            URL.revokeObjectURL(
              asset.url,
            );
          }

          return;
        }

        objectUrl =
          asset.revoke
            ? asset.url
            : "";

        setReferenceImageUrl(
          asset.url,
        );
      } catch {
        if (!cancelled) {
          setReferenceImageUrl("");
        }
      }
    }

    void loadReferenceImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, [
    space.referenceImagePath,
  ]);

  const openIssuesByCircuit =
    useMemo(() => {
      const map =
        new Map<
          string,
          SheetPanelIssue[]
        >();

      for (const issue of issues) {
        if (
          issue.status !== "open"
        ) {
          continue;
        }

        const current =
          map.get(
            issue.circuitId,
          ) ?? [];

        current.push(issue);

        map.set(
          issue.circuitId,
          current,
        );
      }

      return map;
    }, [issues]);

  function updateResult(
    circuitId: string,
    update:
      Partial<PanelTestDraftResult>,
  ): void {
    setDraftResults((current) =>
      current.map((result) =>
        result.circuitId === circuitId
          ? {
              ...result,
              ...update,
            }
          : result,
      ),
    );

    setValidationMessage("");
  }
  function chooseResult(
    circuitId: string,
    result: ChecklistResult,
  ): void {
    updateResult(
      circuitId,
      { result },
    );

    if (result !== "issue") {
      setIssueDescriptions(
        (current) => {
          const next = {
            ...current,
          };

          delete next[circuitId];

          return next;
        },
      );
    }
  }
  function validateAndSave(): void {
    for (const result of draftResults) {
      if (
        result.result !== "issue"
      ) {
        continue;
      }

      const hasOpenIssue =
        (
          openIssuesByCircuit.get(
            result.circuitId,
          ) ?? []
        ).length > 0;

      if (
        !hasOpenIssue &&
        !issueDescriptions[
          result.circuitId
        ]?.trim()
      ) {
        setValidationMessage(
          `Describe the failure for Circuit ${result.circuitNo}.`,
        );

        return;
      }
    }

    setValidationMessage("");

    onSave(
      draftResults,
      issueDescriptions,
    );
  }
  return (
    <>
      <div className="panel-heading inspection-panel-heading">
        <p className="eyebrow">
          Electrical panel testing
        </p>

        <h2>
          {space.roomNo ||
            region.label}
        </h2>

        <p>{space.displayName}</p>
      </div>

      {readOnly && (
        <div className="panel-readonly-message">
          <strong>
            Read-only access
          </strong>

          <span>
            You can review panel testing
            information but cannot record
            results.
          </span>
        </div>
      )}

      <div className="panel-test-summary">
        <div>
          <span>Panelboard</span>
          <strong>
            {space.panelboard}
          </strong>
        </div>

        {space.panelLocation && (
          <div>
            <span>Panel location</span>
            <strong>
              {space.panelLocation}
            </strong>
          </div>
        )}

        <div>
          <span>Circuits sampled</span>
          <strong>
            {space.circuits.length}
          </strong>
        </div>
      </div>

      {space.notes && (
        <div className="space-reference-note">
          <span>Testing notes</span>

          <p>{space.notes}</p>
        </div>
      )}

      {referenceImageUrl && (
        <section className="panel-reference-section">
          <div className="inspection-group-heading">
            <h3>
              Electrical plan reference
            </h3>
          </div>

          <img
            className="panel-reference-image"
            src={referenceImageUrl}
            alt={`Electrical plan reference for ${space.displayName}`}
          />
        </section>
      )}

      <section className="inspection-group">
        <div className="inspection-group-heading">
          <h3>
            Branch circuits
          </h3>

          <span>
            {space.circuits.length} circuits
          </span>
        </div>

        <div className="inspection-items">
          {space.circuits.map(
            (circuit) => {
              const draft =
                draftResults.find(
                  (result) =>
                    result.circuitId ===
                    circuit.id,
                );

              const openIssues =
                openIssuesByCircuit.get(
                  circuit.id,
                ) ?? [];

              return (
                <article
                  className="inspection-item-card"
                  key={circuit.id}
                >
                  <div className="inspection-item-title">
                    <div>
                      <strong>
                        Circuit{" "}
                        {circuit.circuitNo}
                      </strong>

                      <span>
                        {circuit.loadDescription}
                      </span>
                    </div>
                  </div>

                  <div className="fixture-reference-note">
                    <span>Test</span>

                    <p>
                      {circuit.testLabel}
                    </p>
                  </div>

                  <div className="fixture-reference-note">
                    <span>
                      Expected result
                    </span>

                    <p>
                      {
                        circuit.expectedResult
                      }
                    </p>
                  </div>

                  <div className="result-selector">
                    {RESULT_OPTIONS.map(
                      (option) => (
                        <button
                          type="button"
                          key={option.value}
                          data-result={option.value}
                          className={
                            draft?.result ===
                            option.value
                              ? "active"
                              : ""
                          }
                          disabled={readOnly}
                          onClick={() =>
                            chooseResult(
                              circuit.id,
                              option.value,
                            )
                          }
                        >
                          {option.label}
                        </button>
                      ),
                    )}

                    {draft &&
                      draft.result !==
                        "not_checked" && (
                        <button
                          type="button"
                          className="clear-result-button"
                          disabled={readOnly}
                          onClick={() =>
                            chooseResult(
                              circuit.id,
                              "not_checked",
                            )
                          }
                        >
                          Clear
                        </button>
                      )}
                  </div>

                  <label className="item-notes-field">
                    <span>Testing notes</span>

                    <textarea
                      rows={2}
                      disabled={readOnly}
                      value={draft?.notes ?? ""}
                      placeholder="Optional observation…"
                      onChange={(event) =>
                        updateResult(
                          circuit.id,
                          {
                            notes:
                              event.target.value,
                          },
                        )
                      }
                    />
                  </label>

                  {openIssues.map(
                    (issue) => (
                      <div
                        className="open-issue-card"
                        key={issue.issueId}
                      >
                        <div>
                          <span>
                            Open panel issue
                          </span>

                          <p>
                            {
                              issue.issueDescription
                            }
                          </p>

                          <small>
                            Raised by{" "}
                            {issue.createdBy}
                          </small>
                        </div>

                        <button
                          type="button"
                          disabled={
                            readOnly ||
                            saving
                          }
                          onClick={() =>
                            onResolveIssue(issue)
                          }
                        >
                          Mark resolved
                        </button>
                      </div>
                    ),
                  )}

                  {draft?.result === "issue" && 
                    openIssues.length === 0 && (
                      <label className="issue-description-field">
                        <span>
                          Failure description
                        </span>

                        <textarea
                          rows={3}
                          disabled={readOnly}
                          value={
                            issueDescriptions[
                              circuit.id
                            ] ?? ""
                          }
                          placeholder="Describe what did not match the intended circuit operation…"
                          onChange={(event) =>
                            setIssueDescriptions(
                              (current) => ({
                                ...current,
                                [circuit.id]:
                                  event.target.value,
                              }),
                            )
                          }
                        />
                      </label>
                    )}

                  {circuit.notes && (
                    <div className="fixture-location-note">
                      <span>
                        Circuit notes
                      </span>

                      <p>
                        {circuit.notes}
                      </p>
                    </div>
                  )}
                </article>
              );
            },
          )}
        </div>
      </section>

      {validationMessage && (
        <div className="inspection-validation-message">
          {validationMessage}
        </div>
      )}

      <div className="inspection-save-bar">
        <button
          type="button"
          className="primary-button full-width"
          disabled={
            readOnly ||
            !googleConnected ||
            saving ||
            draftResults.length === 0
          }
          onClick={validateAndSave}
        >
          {saving
            ? "Saving…"
            : "Save panel testing"}
        </button>
      </div>
    </>
  );
}