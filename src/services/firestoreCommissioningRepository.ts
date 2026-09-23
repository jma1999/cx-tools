import {
    Timestamp,
    addDoc,
    collection,
    doc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where,
  } from "firebase/firestore";
  
  import {
    firebaseAuth,
    firestoreDb,
  } from "../auth/firebase";
  
  import type {
    CommissioningRepository,
    SheetAssignment,
    SheetChecklistResult,
    SheetComment,
    SheetIssue,
    SheetPanelIssue,
    SheetPanelTestResult,
    SheetTestResult,
  } from "./googleSheets";

  interface Actor {
    uid: string;
    email: string;
  }
  
  function requireActor():
    Actor {
    const user =
      firebaseAuth.currentUser;
  
    if (
      !user ||
      !user.email
    ) {
      throw new Error(
        "Your cxTools session has expired. Sign in again.",
      );
    }
  
    return {
      uid:
        user.uid,
  
      email:
        user.email,
    };
  }
  
  function firestoreKey(
    ...parts: string[]
  ): string {
    return parts
      .map(
        (part) =>
          encodeURIComponent(
            part,
          ),
      )
      .join("__");
  }
  
  function floorCollection(
    projectId: string,
    floor: string,
    name: string,
  ) {
    return collection(
      firestoreDb,
      "projects",
      projectId,
      "floors",
      floor,
      name,
    );
  }
  
  function toIso(
    value: unknown,
  ): string {
    if (
      value instanceof
      Timestamp
    ) {
      return value
        .toDate()
        .toISOString();
    }
  
    if (
      typeof value ===
      "string"
    ) {
      return value;
    }
  
    return "";
  }
  
  function numberValue(
    value: unknown,
  ): number {
    const parsed =
      Number(value);
  
    return Number.isFinite(
      parsed,
    )
      ? parsed
      : 0;
  }

  async function appendActivity(
    projectId: string,
    floor: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const actor =
      requireActor();
  
    await addDoc(
      floorCollection(
        projectId,
        floor,
        "activityEvents",
      ),
      {
        eventType,
  
        performedByUid:
          actor.uid,
  
        performedBy:
          actor.email,
  
        payload,
  
        createdAt:
          serverTimestamp(),
      },
    );
  }

  async function loadAssignments(
    projectId: string,
    floor: string,
  ): Promise<
    Record<
      string,
      string | null
    >
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "assignments",
        ),
      );
  
    const assignments:
      Record<
        string,
        string | null
      > = {};
  
    for (
      const result of
      snapshot.docs
    ) {
      const data =
        result.data();
  
      const regionId =
        typeof data.regionId ===
        "string"
          ? data.regionId
          : "";
  
      if (!regionId) {
        continue;
      }
  
      assignments[
        regionId
      ] =
        typeof data.spaceId ===
          "string"
          ? data.spaceId
          : null;
    }
  
    return assignments;
  }

  async function upsertAssignment(
    projectId: string,
    assignment:
      Omit<
        SheetAssignment,
        "updatedAt" |
          "revision"
      >,
  ): Promise<SheetAssignment> {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          assignment.floor,
          "assignments",
        ),
        firestoreKey(
          assignment.regionId,
        ),
      );
  
    const now =
      new Date()
        .toISOString();
  
    let saved:
      SheetAssignment;
  
    await runTransaction(
      firebaseDb,
      async (
        transaction,
      ) => {
        const existing =
          await transaction.get(
            reference,
          );
  
        const revision =
          existing.exists()
            ? numberValue(
                existing.data()
                  .revision,
              ) + 1
            : 1;
  
        saved = {
          ...assignment,
  
          updatedBy:
            actor.email,
  
          updatedAt:
            now,
  
          revision,
        };
  
        transaction.set(
          reference,
          {
            ...saved,
  
            updatedByUid:
              actor.uid,
  
            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );
  
    await appendActivity(
      projectId,
      assignment.floor,
      assignment.spaceId
        ? "assignment_saved"
        : "assignment_cleared",
      saved!,
    );
  
    return saved!;
  }

  async function loadComments(
    projectId: string,
    floor: string,
    regionId: string,
  ): Promise<
    SheetComment[]
  > {
    const snapshot =
      await getDocs(
        query(
          floorCollection(
            projectId,
            floor,
            "comments",
          ),
  
          where(
            "regionId",
            "==",
            regionId,
          ),
        ),
      );
  
    return snapshot.docs
      .map(
        (result) => {
          const data =
            result.data();
  
          return {
            commentId:
              result.id,
  
            floor,
  
            regionId:
              String(
                data.regionId ??
                  "",
              ),
  
            spaceId:
              String(
                data.spaceId ??
                  "",
              ),
  
            roomNo:
              String(
                data.roomNo ??
                  "",
              ),
  
            comment:
              String(
                data.comment ??
                  "",
              ),
  
            createdBy:
              String(
                data.createdBy ??
                  "",
              ),
  
            createdAt:
              toIso(
                data.createdAt,
              ),
  
            category:
              String(
                data.category ??
                  "General",
              ),
          };
        },
      )
      .sort(
        (a, b) =>
          b.createdAt
            .localeCompare(
              a.createdAt,
            ),
      );
  }

  async function addComment(
    projectId: string,
    comment:
      Omit<
        SheetComment,
        "commentId" |
          "createdAt"
      >,
  ): Promise<SheetComment> {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          comment.floor,
          "comments",
        ),
      );
  
    const now =
      new Date()
        .toISOString();
  
    const saved:
      SheetComment = {
      ...comment,
  
      commentId:
        reference.id,
  
      createdBy:
        actor.email,
  
      createdAt:
        now,
    };
  
    await setDoc(
      reference,
      {
        ...saved,
  
        createdByUid:
          actor.uid,
  
        createdAt:
          serverTimestamp(),
      },
    );
  
    await appendActivity(
      projectId,
      comment.floor,
      "comment_added",
      saved,
    );
  
    return saved;
  }

  async function saveRevisionedResults<
  T extends {
    floor: string;
  },
  R,
>(
  projectId: string,
  collectionName: string,
  inputResults: T[],
  keyFor:
    (
      result: T,
    ) => string,
  buildResult:
    (
      input: T,
      updatedBy:
        string,
      updatedAt:
        string,
      revision:
        number,
    ) => R,
): Promise<R[]> {
  if (
    inputResults.length ===
    0
  ) {
    return [];
  }

  const actor =
    requireActor();

  const now =
    new Date()
      .toISOString();

  const references =
    inputResults.map(
      (result) =>
        doc(
          floorCollection(
            projectId,
            result.floor,
            collectionName,
          ),

          keyFor(
            result,
          ),
        ),
    );

  const saved:
    R[] = [];

  await runTransaction(
    firebaseDb,
    async (
      transaction,
    ) => {
      /*
       * Firestore transactions
       * perform every read before
       * any write.
       */
      const existing =
        await Promise.all(
          references.map(
            (reference) =>
              transaction.get(
                reference,
              ),
          ),
        );

      inputResults.forEach(
        (
          input,
          index,
        ) => {
          const revision =
            existing[
              index
            ].exists()
              ? numberValue(
                  existing[
                    index
                  ].data()
                    .revision,
                ) + 1
              : 1;

          const result =
            buildResult(
              input,
              actor.email,
              now,
              revision,
            );

          saved.push(
            result,
          );

          transaction.set(
            references[
              index
            ],
            {
              ...(result as object),

              updatedByUid:
                actor.uid,

              updatedAt:
                serverTimestamp(),
            },
          );
        },
      );
    },
  );

  return saved;
}

async function loadFloorChecklistResults(
    projectId: string,
    floor: string,
  ): Promise<
    SheetChecklistResult[]
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "checklistResults",
        ),
      );
  
    return snapshot.docs.map(
      (result) => {
        const data =
          result.data();
  
        return {
          ...(data as
            SheetChecklistResult),
  
          floor,
  
          updatedAt:
            toIso(
              data.updatedAt,
            ),
        };
      },
    );
  }

  async function saveChecklistResults(
    projectId: string,
    inputResults:
      Array<
        Omit<
          SheetChecklistResult,
          "updatedAt" |
            "revision"
        >
      >,
  ): Promise<
    SheetChecklistResult[]
  > {
    const saved =
      await saveRevisionedResults(
        projectId,
        "checklistResults",
        inputResults,
  
        (result) =>
          firestoreKey(
            result.spaceId,
            result.checklistItemId,
          ),
  
        (
          result,
          updatedBy,
          updatedAt,
          revision,
        ) => ({
          ...result,
          updatedBy,
          updatedAt,
          revision,
        }),
      );
  
    if (
      inputResults[0]
    ) {
      await appendActivity(
        projectId,
        inputResults[0].floor,
        "checklist_results_saved",
        {
          count:
            saved.length,
        },
      );
    }
  
    return saved;
  }

  async function loadFloorTestResults(
    projectId: string,
    floor: string,
  ): Promise<
    SheetTestResult[]
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "testResults",
        ),
      );
  
    return snapshot.docs.map(
      (result) => {
        const data =
          result.data();
  
        return {
          ...(data as
            SheetTestResult),
  
          floor,
  
          updatedAt:
            toIso(
              data.updatedAt,
            ),
        };
      },
    );
  }

  async function saveTestResults(
    projectId: string,
    inputResults:
      Array<
        Omit<
          SheetTestResult,
          "updatedAt" |
            "revision"
        >
      >,
  ): Promise<
    SheetTestResult[]
  > {
    const saved =
      await saveRevisionedResults(
        projectId,
        "testResults",
        inputResults,
  
        (result) =>
          firestoreKey(
            result.spaceId,
            result.checklistItemId,
            result.testId,
          ),
  
        (
          result,
          updatedBy,
          updatedAt,
          revision,
        ) => ({
          ...result,
          updatedBy,
          updatedAt,
          revision,
        }),
      );
  
    if (
      inputResults[0]
    ) {
      await appendActivity(
        projectId,
        inputResults[0].floor,
        "test_results_saved",
        {
          count:
            saved.length,
        },
      );
    }
  
    return saved;
  }

  async function loadFloorIssues(
    projectId: string,
    floor: string,
  ): Promise<
    SheetIssue[]
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "issues",
        ),
      );
  
    return snapshot.docs.map(
      (result) => {
        const data =
          result.data();
  
        return {
          ...(data as
            SheetIssue),
  
          issueId:
            result.id,
  
          floor,
  
          createdAt:
            toIso(
              data.createdAt,
            ),
  
          resolvedAt:
            toIso(
              data.resolvedAt,
            ),
        };
      },
    );
  }

  async function createIssue(
    projectId: string,
    issue:
      Omit<
        SheetIssue,
        | "issueId"
        | "status"
        | "createdAt"
        | "resolvedBy"
        | "resolvedAt"
      >,
  ): Promise<SheetIssue> {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          issue.floor,
          "issues",
        ),
      );
  
    const now =
      new Date()
        .toISOString();
  
    const saved:
      SheetIssue = {
      ...issue,
  
      issueId:
        reference.id,
  
      status:
        "open",
  
      createdBy:
        actor.email,
  
      createdAt:
        now,
  
      resolvedBy:
        "",
  
      resolvedAt:
        "",
    };
  
    await setDoc(
      reference,
      {
        ...saved,
  
        createdByUid:
          actor.uid,
  
        createdAt:
          serverTimestamp(),
      },
    );
  
    await appendActivity(
      projectId,
      issue.floor,
      "issue_created",
      saved,
    );
  
    return saved;
  }

  async function resolveIssue(
    projectId: string,
    floor: string,
    issueId: string,
  ): Promise<SheetIssue> {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          floor,
          "issues",
        ),
        issueId,
      );
  
    const now =
      new Date()
        .toISOString();
  
    let saved:
      SheetIssue;
  
    await runTransaction(
      firebaseDb,
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            reference,
          );
  
        if (
          !snapshot.exists()
        ) {
          throw new Error(
            "The selected issue could not be found.",
          );
        }
  
        const data =
          snapshot.data();
  
        saved = {
          ...(data as
            SheetIssue),
  
          issueId,
  
          floor,
  
          createdAt:
            toIso(
              data.createdAt,
            ),
  
          status:
            "resolved",
  
          resolvedBy:
            actor.email,
  
          resolvedAt:
            now,
        };
  
        transaction.update(
          reference,
          {
            status:
              "resolved",
  
            resolvedBy:
              actor.email,
  
            resolvedByUid:
              actor.uid,
  
            resolvedAt:
              serverTimestamp(),
          },
        );
      },
    );
  
    await appendActivity(
      projectId,
      floor,
      "issue_resolved",
      saved!,
    );
  
    return saved!;
  }

  async function loadFloorPanelTestResults(
    projectId: string,
    floor: string,
  ): Promise<
    SheetPanelTestResult[]
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "panelTestResults",
        ),
      );
  
    return snapshot.docs.map(
      (result) => {
        const data =
          result.data();
  
        return {
          ...(data as
            SheetPanelTestResult),
  
          floor,
  
          updatedAt:
            toIso(
              data.updatedAt,
            ),
        };
      },
    );
  }

  async function savePanelTestResults(
    projectId: string,
    inputResults:
      Array<
        Omit<
          SheetPanelTestResult,
          "updatedAt" |
            "revision"
        >
      >,
  ): Promise<
    SheetPanelTestResult[]
  > {
    const saved =
      await saveRevisionedResults(
        projectId,
        "panelTestResults",
        inputResults,
  
        (result) =>
          firestoreKey(
            result.spaceId,
            result.circuitId,
          ),
  
        (
          result,
          updatedBy,
          updatedAt,
          revision,
        ) => ({
          ...result,
          updatedBy,
          updatedAt,
          revision,
        }),
      );
  
    if (
      inputResults[0]
    ) {
      await appendActivity(
        projectId,
        inputResults[0].floor,
        "panel_test_results_saved",
        {
          count:
            saved.length,
        },
      );
    }
  
    return saved;
  }

  async function loadFloorPanelIssues(
    projectId: string,
    floor: string,
  ): Promise<
    SheetPanelIssue[]
  > {
    const snapshot =
      await getDocs(
        floorCollection(
          projectId,
          floor,
          "panelIssues",
        ),
      );
  
    return snapshot.docs.map(
      (result) => {
        const data =
          result.data();
  
        return {
          ...(data as
            SheetPanelIssue),
  
          issueId:
            result.id,
  
          floor,
  
          createdAt:
            toIso(
              data.createdAt,
            ),
  
          resolvedAt:
            toIso(
              data.resolvedAt,
            ),
        };
      },
    );
  }

  async function createPanelIssue(
    projectId: string,
    issue:
      Omit<
        SheetPanelIssue,
        | "issueId"
        | "status"
        | "createdAt"
        | "resolvedBy"
        | "resolvedAt"
      >,
  ): Promise<
    SheetPanelIssue
  > {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          issue.floor,
          "panelIssues",
        ),
      );
  
    const now =
      new Date()
        .toISOString();
  
    const saved:
      SheetPanelIssue = {
      ...issue,
  
      issueId:
        reference.id,
  
      status:
        "open",
  
      createdBy:
        actor.email,
  
      createdAt:
        now,
  
      resolvedBy:
        "",
  
      resolvedAt:
        "",
    };
  
    await setDoc(
      reference,
      {
        ...saved,
  
        createdByUid:
          actor.uid,
  
        createdAt:
          serverTimestamp(),
      },
    );
  
    await appendActivity(
      projectId,
      issue.floor,
      "panel_issue_created",
      saved,
    );
  
    return saved;
  }

  async function resolvePanelIssue(
    projectId: string,
    floor: string,
    issueId: string,
  ): Promise<
    SheetPanelIssue
  > {
    const actor =
      requireActor();
  
    const reference =
      doc(
        floorCollection(
          projectId,
          floor,
          "panelIssues",
        ),
        issueId,
      );
  
    const now =
      new Date()
        .toISOString();
  
    let saved:
      SheetPanelIssue;
  
    await runTransaction(
      firebaseDb,
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            reference,
          );
  
        if (
          !snapshot.exists()
        ) {
          throw new Error(
            "The selected panel issue could not be found.",
          );
        }
  
        const data =
          snapshot.data();
  
        saved = {
          ...(data as
            SheetPanelIssue),
  
          issueId,
  
          floor,
  
          createdAt:
            toIso(
              data.createdAt,
            ),
  
          status:
            "resolved",
  
          resolvedBy:
            actor.email,
  
          resolvedAt:
            now,
        };
  
        transaction.update(
          reference,
          {
            status:
              "resolved",
  
            resolvedBy:
              actor.email,
  
            resolvedByUid:
              actor.uid,
  
            resolvedAt:
              serverTimestamp(),
          },
        );
      },
    );
  
    await appendActivity(
      projectId,
      floor,
      "panel_issue_resolved",
      saved!,
    );
  
    return saved!;
  }

  export function createFirestoreCommissioningRepository(
    projectId: string,
  ): CommissioningRepository {
    /*
     * Remember which floor contained
     * each issue that has been loaded.
     *
     * This lets us preserve the
     * existing repository interface
     * temporarily.
     */
    const issueFloorById =
      new Map<
        string,
        string
      >();
  
    const panelIssueFloorById =
      new Map<
        string,
        string
      >();
  
    return {
      loadAssignments:
        (floor) =>
          loadAssignments(
            projectId,
            floor,
          ),
  
      upsertAssignment:
        (assignment) =>
          upsertAssignment(
            projectId,
            assignment,
          ),
  
      loadComments:
        (
          floor,
          regionId,
        ) =>
          loadComments(
            projectId,
            floor,
            regionId,
          ),
  
      addComment:
        (comment) =>
          addComment(
            projectId,
            comment,
          ),
  
      loadFloorChecklistResults:
        (floor) =>
          loadFloorChecklistResults(
            projectId,
            floor,
          ),
  
      saveChecklistResults:
        (results) =>
          saveChecklistResults(
            projectId,
            results,
          ),
  
      loadFloorTestResults:
        (floor) =>
          loadFloorTestResults(
            projectId,
            floor,
          ),
  
      saveTestResults:
        (results) =>
          saveTestResults(
            projectId,
            results,
          ),
  
      loadFloorIssues:
        async (
          floor,
        ) => {
          const issues =
            await loadFloorIssues(
              projectId,
              floor,
            );
  
          issues.forEach(
            (issue) =>
              issueFloorById.set(
                issue.issueId,
                floor,
              ),
          );
  
          return issues;
        },
  
      createIssue:
        async (
          issue,
        ) => {
          const saved =
            await createIssue(
              projectId,
              issue,
            );
  
          issueFloorById.set(
            saved.issueId,
            saved.floor,
          );
  
          return saved;
        },
  
      resolveIssue:
        (
          issueId,
          _resolvedBy,
        ) => {
          const floor =
            issueFloorById.get(
              issueId,
            );
  
          if (!floor) {
            throw new Error(
              "The issue floor could not be determined. Reload project data and try again.",
            );
          }
  
          return resolveIssue(
            projectId,
            floor,
            issueId,
          );
        },
  
      loadFloorPanelTestResults:
        (floor) =>
          loadFloorPanelTestResults(
            projectId,
            floor,
          ),
  
      savePanelTestResults:
        (results) =>
          savePanelTestResults(
            projectId,
            results,
          ),
  
      loadFloorPanelIssues:
        async (
          floor,
        ) => {
          const issues =
            await loadFloorPanelIssues(
              projectId,
              floor,
            );
  
          issues.forEach(
            (issue) =>
              panelIssueFloorById.set(
                issue.issueId,
                floor,
              ),
          );
  
          return issues;
        },
  
      createPanelIssue:
        async (
          issue,
        ) => {
          const saved =
            await createPanelIssue(
              projectId,
              issue,
            );
  
          panelIssueFloorById.set(
            saved.issueId,
            saved.floor,
          );
  
          return saved;
        },
  
      resolvePanelIssue:
        (
          issueId,
          _resolvedBy,
        ) => {
          const floor =
            panelIssueFloorById.get(
              issueId,
            );
  
          if (!floor) {
            throw new Error(
              "The panel issue floor could not be determined. Reload project data and try again.",
            );
          }
  
          return resolvePanelIssue(
            projectId,
            floor,
            issueId,
          );
        },
    };
  }